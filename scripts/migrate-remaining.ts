/**
 * Migration script (part 2): Insert failed UserDailyPlan rows + remaining tables.
 *
 * The 7 missing exercises were already inserted into Postgres by the first run.
 * This script now:
 *   1. Re-inserts only the ~17 UserDailyPlan rows that failed due to FK violations
 *      (exercises: gentle-swimming, swimming-pool-warm-up, tens-unit)
 *   2. Migrates UserSupplements (20 rows)
 *   3. Migrates DailyChecks (8 rows)
 *   4. Migrates SessionLogs (4 rows)
 *   5. Migrates UserMilestones (1 row)
 *
 * Usage:
 *   npx tsx scripts/migrate-remaining.ts
 */

import "dotenv/config";
import sql from "mssql";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ── Azure SQL config ──

const azureConfig: sql.config = {
  server: process.env.DB_SERVER!,
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

// ── Prisma (Neon Postgres) ──

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// ── Helpers ──

function toDate(val: unknown): Date | null {
  if (val == null || val === "") return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function toDateRequired(val: unknown, context = ""): Date {
  const d = toDate(val);
  if (!d) throw new Error(`Required date is null/invalid: ${val} (${context})`);
  return d;
}

// ── Main ──

async function main() {
  for (const key of ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD", "DATABASE_URL"]) {
    if (!process.env[key]) {
      console.error(`ERROR: Missing env var ${key}`);
      process.exit(1);
    }
  }

  console.log("Connecting to Azure SQL...");
  const pool = await sql.connect(azureConfig);
  console.log("Connected.\n");

  console.log("Connecting to Neon Postgres...");
  const prisma = createPrisma();
  console.log("Connected.\n");

  // ── Build username -> Postgres user ID map ──
  const pgUsers = await prisma.user.findMany({ select: { id: true, username: true } });
  const usernameToNewId = new Map<string, number>();
  for (const u of pgUsers) {
    usernameToNewId.set(u.username.toLowerCase(), u.id);
  }
  console.log(`Loaded ${pgUsers.length} users from Postgres.\n`);

  function resolveUserId(usernameVal: string): number | null {
    if (!usernameVal) return null;
    return usernameToNewId.get(usernameVal.toLowerCase()) ?? null;
  }

  // ══════════════════════════════════════════════════════
  // 1. Re-insert failed UserDailyPlan rows
  //    Only the rows referencing the 3 exercises that were missing
  // ══════════════════════════════════════════════════════
  console.log("=== 1. Re-inserting failed UserDailyPlan rows ===");

  const failedExerciseIds = ["gentle-swimming", "swimming-pool-warm-up", "tens-unit"];
  const placeholders = failedExerciseIds.map((_, i) => `@ex${i}`).join(",");

  const planReq = pool.request();
  failedExerciseIds.forEach((id, i) => planReq.input(`ex${i}`, sql.VarChar, id));
  const failedPlans = await planReq.query(
    `SELECT * FROM UserDailyPlan WHERE ExerciseId IN (${placeholders})`
  );
  console.log(`  Found ${failedPlans.recordset.length} rows with previously-missing exerciseIds`);

  let planInserted = 0;
  let planFailed = 0;

  for (const row of failedPlans.recordset) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }

    const date = toDateRequired(row.Date, `UserDailyPlan.Id=${row.Id}`);
    const exerciseId: string = row.ExerciseId;

    try {
      await prisma.userDailyPlan.upsert({
        where: {
          userId_date_exerciseId: { userId: newUserId, date, exerciseId },
        },
        update: {},
        create: {
          userId: newUserId,
          programId: row.ProgramId,
          date,
          dayType: row.DayType ?? "",
          exerciseId,
          category: row.Category ?? "",
          sortOrder: row.SortOrder ?? 0,
          rx: row.Rx || null,
          aiAdjusted: row.AiAdjusted ?? false,
          isManual: row.IsManual ?? false,
        },
      });
      planInserted++;
      console.log(`  Inserted plan: user="${row.UserId}" date=${row.Date} exercise="${exerciseId}"`);
    } catch (err: any) {
      console.log(`  FAIL plan Id=${row.Id}: ${err.message}`);
      planFailed++;
    }
  }
  console.log(`  Done. inserted=${planInserted}, failed=${planFailed}\n`);

  // Build planIdToExerciseId lookup for DailyChecks resolution
  const allPlansResult = await pool.request().query(`SELECT Id, ExerciseId FROM UserDailyPlan`);
  const planIdToExerciseId = new Map<string, string>();
  for (const row of allPlansResult.recordset) {
    planIdToExerciseId.set(String(row.Id), row.ExerciseId);
  }

  // ══════════════════════════════════════════════════════
  // 2. Migrate UserSupplements
  // ══════════════════════════════════════════════════════
  console.log("=== 2. Migrating UserSupplements ===");
  const oldSupps = await pool.request().query(`SELECT * FROM UserSupplements`);
  console.log(`  Found ${oldSupps.recordset.length} rows`);

  let suppInserted = 0;
  for (const row of oldSupps.recordset) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }
    try {
      await prisma.userSupplement.upsert({
        where: {
          userId_supplementId: {
            userId: newUserId,
            supplementId: row.SupplementId,
          },
        },
        update: {},
        create: {
          userId: newUserId,
          supplementId: row.SupplementId,
          timeGroup: row.TimeGroup ?? "am",
          addedDate: toDate(row.AddedDate) ?? new Date(),
        },
      });
      suppInserted++;
      console.log(`  Migrated supplement "${row.SupplementId}" for "${row.UserId}"`);
    } catch (err: any) {
      console.log(`  FAIL supplement "${row.SupplementId}": ${err.message}`);
    }
  }
  console.log(`  Done. inserted=${suppInserted}\n`);

  // ══════════════════════════════════════════════════════
  // 3. Migrate DailyChecks
  //    The DailyCheck table has polymorphic FKs on itemId pointing to BOTH
  //    Exercise and Supplement. This is incompatible — a supplement itemId
  //    can't exist in Exercise. We drop the two FKs, insert data, then
  //    leave them dropped (they're application-level concerns).
  // ══════════════════════════════════════════════════════
  console.log("=== 3. Migrating DailyChecks ===");

  // Drop the conflicting FKs using raw SQL via pg client
  const pgClient = new (await import("pg")).default.Client(process.env.DATABASE_URL);
  await pgClient.connect();
  console.log("  Dropping conflicting FK constraints on DailyCheck...");
  await pgClient.query(`ALTER TABLE "DailyCheck" DROP CONSTRAINT IF EXISTS "dailycheck_exercise_fk"`);
  await pgClient.query(`ALTER TABLE "DailyCheck" DROP CONSTRAINT IF EXISTS "dailycheck_supplement_fk"`);
  console.log("  Dropped dailycheck_exercise_fk and dailycheck_supplement_fk.");
  await pgClient.end();

  const oldChecks = await pool.request().query(`SELECT * FROM DailyChecks`);
  console.log(`  Found ${oldChecks.recordset.length} rows`);

  let checksInserted = 0;
  let checksFailed = 0;

  for (const row of oldChecks.recordset) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) continue;

    const date = toDateRequired(row.Date, `DailyChecks.Id=${row.Id}`);
    const itemType: string = row.ItemType;
    let itemId: string = row.ItemId;

    if (itemType === "step") {
      const resolved = planIdToExerciseId.get(itemId);
      if (!resolved) {
        console.log(`  WARN: cannot resolve step planId=${itemId} -> exerciseId, skipping`);
        checksFailed++;
        continue;
      }
      itemId = resolved;
    }

    try {
      await prisma.dailyCheck.upsert({
        where: {
          userId_date_itemType_itemId_stepIndex: {
            userId: newUserId,
            date,
            itemType,
            itemId,
            stepIndex: row.StepIndex ?? 0,
          },
        },
        update: {},
        create: {
          userId: newUserId,
          date,
          itemType,
          itemId,
          stepIndex: row.StepIndex ?? 0,
          checked: row.Checked ?? false,
        },
      });
      checksInserted++;
      console.log(`  Migrated check: type="${itemType}" itemId="${itemId}" date=${row.Date}`);
    } catch (err: any) {
      console.log(`  FAIL check Id=${row.Id}: ${err.message}`);
      checksFailed++;
    }
  }
  console.log(`  Done. inserted=${checksInserted}, failed=${checksFailed}\n`);

  // ══════════════════════════════════════════════════════
  // 4. Migrate SessionLogs
  // ══════════════════════════════════════════════════════
  console.log("=== 4. Migrating SessionLogs ===");
  const oldLogs = await pool.request().query(`SELECT * FROM SessionLogs`);
  console.log(`  Found ${oldLogs.recordset.length} rows`);

  let logsInserted = 0;
  for (const row of oldLogs.recordset) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }

    const date = toDateRequired(row.Date, `SessionLogs.Id=${row.Id}`);

    await prisma.sessionLog.upsert({
      where: { userId_date: { userId: newUserId, date } },
      update: {},
      create: {
        userId: newUserId,
        date,
        stepsDone: row.StepsDone ?? 0,
        stepsTotal: row.StepsTotal ?? 0,
      },
    });
    logsInserted++;
    console.log(`  Migrated log: user="${row.UserId}" date=${row.Date}`);
  }
  console.log(`  Done. inserted=${logsInserted}\n`);

  // ══════════════════════════════════════════════════════
  // 5. Migrate UserMilestones
  // ══════════════════════════════════════════════════════
  console.log("=== 5. Migrating UserMilestones ===");
  const oldMilestones = await pool.request().query(`SELECT * FROM UserMilestones`);
  console.log(`  Found ${oldMilestones.recordset.length} rows`);

  let milestonesInserted = 0;
  for (const row of oldMilestones.recordset) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }

    const milestoneId: string = row.MilestoneId;

    try {
      await prisma.userMilestone.upsert({
        where: {
          userId_milestoneId: { userId: newUserId, milestoneId },
        },
        update: {},
        create: {
          userId: newUserId,
          milestoneId,
          done: row.Done ?? false,
          achievedDate: toDate(row.AchievedDate),
        },
      });
      milestonesInserted++;
      console.log(`  Migrated milestone "${milestoneId}" for "${row.UserId}"`);
    } catch (err: any) {
      console.log(`  FAIL milestone "${milestoneId}": ${err.message}`);
    }
  }
  console.log(`  Done. inserted=${milestonesInserted}\n`);

  // ══════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════
  console.log("=== REMAINING MIGRATION COMPLETE ===");
  console.log(`  UserDailyPlan (failed rows): ${planInserted} inserted`);
  console.log(`  UserSupplements:             ${suppInserted} inserted`);
  console.log(`  DailyChecks:                 ${checksInserted} inserted`);
  console.log(`  SessionLogs:                 ${logsInserted} inserted`);
  console.log(`  UserMilestones:              ${milestonesInserted} inserted`);

  await pool.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
