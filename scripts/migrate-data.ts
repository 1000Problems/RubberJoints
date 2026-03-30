/**
 * Migration script: Azure SQL (1000Problems) -> Neon Postgres (RubberJoints)
 *
 * Usage:
 *   npx tsx scripts/migrate-data.ts [--dry-run]
 *
 * Required env vars:
 *   DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD  (Azure SQL - from B3tz/.env)
 *   DATABASE_URL                              (Neon Postgres - from rubber-joints/.env)
 *
 * Key mapping notes (discovered from Azure SQL inspection):
 *   - Azure SQL stores UserId as username STRING (e.g. "angel") in all
 *     child tables, but Users.Id is an INT. The new Postgres schema uses
 *     integer FKs everywhere. We build a username->newId map from Users.
 *   - DailyChecks.ItemId for itemType="step" references UserDailyPlan.Id
 *     (an int cast to string). We resolve this to the underlying ExerciseId
 *     via a lookup into the UserDailyPlan table.
 *   - All date columns in Azure SQL are nvarchar, not datetime.
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

const DRY_RUN = process.argv.includes("--dry-run");

// ── Prisma (Neon Postgres) ──

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// ── Helpers ──

async function fetchAll(pool: sql.ConnectionPool, table: string) {
  const result = await pool.request().query(`SELECT * FROM [dbo].[${table}]`);
  return result.recordset;
}

/** Parse an nvarchar date string into a Date, or null */
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
  // Validate env
  for (const key of ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD", "DATABASE_URL"]) {
    if (!process.env[key]) {
      console.error(`ERROR: Missing env var ${key}`);
      process.exit(1);
    }
  }

  if (DRY_RUN) console.log("*** DRY RUN MODE — no writes to Postgres ***\n");

  // ── Connect Azure SQL ──
  console.log("Connecting to Azure SQL...");
  console.log(`  Server:   ${process.env.DB_SERVER}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log(`  User:     ${process.env.DB_USER}`);
  const pool = await sql.connect(azureConfig);
  console.log("Connected.\n");

  // ── Connect Postgres ──
  console.log("Connecting to Neon Postgres...");
  const prisma = createPrisma();
  console.log("Connected.\n");

  // ══════════════════════════════════════════════════════
  // 1. USERS
  // ══════════════════════════════════════════════════════
  console.log("=== Migrating Users ===");
  const oldUsers = await fetchAll(pool, "Users");
  console.log(`  Found ${oldUsers.length} users in Azure SQL`);

  // Map: username (lowercase) -> new Postgres user ID
  const usernameToNewId = new Map<string, number>();

  for (const row of oldUsers) {
    const username: string = row.Username;
    const passwordHash: string = row.PasswordHash;
    const salt: string = row.Salt ?? "";
    const createdDate = toDate(row.CreatedDate) ?? new Date();

    if (DRY_RUN) {
      console.log(`  [DRY] Would upsert user: ${username}`);
      usernameToNewId.set(username.toLowerCase(), row.Id);
      continue;
    }

    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, passwordHash, salt, createdDate },
    });
    usernameToNewId.set(username.toLowerCase(), user.id);
    console.log(`  Migrated: ${username} -> id=${user.id}`);
  }

  /** Resolve a UserId (username string) to the new integer id */
  function resolveUserId(usernameVal: string): number | null {
    if (!usernameVal) return null;
    return usernameToNewId.get(usernameVal.toLowerCase()) ?? null;
  }

  // ══════════════════════════════════════════════════════
  // 2. USER SETTINGS
  // ══════════════════════════════════════════════════════
  console.log("\n=== Migrating UserSettings ===");
  const oldSettings = await fetchAll(pool, "UserSettings");
  console.log(`  Found ${oldSettings.length} rows`);

  for (const row of oldSettings) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [DRY] Would upsert settings for user "${row.UserId}"`);
      continue;
    }
    await prisma.userSettings.upsert({
      where: { userId: newUserId },
      update: {},
      create: {
        userId: newUserId,
        startDate: toDate(row.StartDate),
        disabledTools: row.DisabledTools || null,
      },
    });
    console.log(`  Migrated settings for "${row.UserId}"`);
  }

  // ══════════════════════════════════════════════════════
  // 3. USER PREFERENCES
  // ══════════════════════════════════════════════════════
  console.log("\n=== Migrating UserPreferences ===");
  const oldPrefs = await fetchAll(pool, "UserPreferences");
  console.log(`  Found ${oldPrefs.length} rows`);

  for (const row of oldPrefs) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [DRY] Would upsert preferences for "${row.UserId}"`);
      continue;
    }
    await prisma.userPreferences.upsert({
      where: { userId: newUserId },
      update: {},
      create: {
        userId: newUserId,
        hasGym: row.HasGym ?? false,
        daysPerWeek: row.DaysPerWeek ?? 5,
        onboardingStep: row.OnboardingStep ?? 0,
        selectedExercises: row.SelectedExercises || null,
        selectedSupplements: row.SelectedSupplements || null,
        profileNotes: row.ProfileNotes || null,
      },
    });
    console.log(`  Migrated preferences for "${row.UserId}"`);
  }

  // ══════════════════════════════════════════════════════
  // 4. USER ENROLLMENTS
  // ══════════════════════════════════════════════════════
  console.log("\n=== Migrating UserEnrollments ===");
  const oldEnrollments = await fetchAll(pool, "UserEnrollments");
  console.log(`  Found ${oldEnrollments.length} rows`);

  for (const row of oldEnrollments) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [DRY] Would create enrollment for "${row.UserId}" program=${row.ProgramId}`);
      continue;
    }
    await prisma.userEnrollment.create({
      data: {
        userId: newUserId,
        programId: row.ProgramId,
        startDate: toDateRequired(row.StartDate, `UserEnrollments.Id=${row.Id}`),
        status: row.Status ?? "active",
      },
    });
    console.log(`  Migrated enrollment: "${row.UserId}" program=${row.ProgramId} status=${row.Status}`);
  }

  // ══════════════════════════════════════════════════════
  // 5. USER DAILY PLAN
  //    Also build a lookup: oldPlanId -> exerciseId for DailyChecks
  // ══════════════════════════════════════════════════════
  console.log("\n=== Migrating UserDailyPlan ===");
  const oldPlans = await fetchAll(pool, "UserDailyPlan");
  console.log(`  Found ${oldPlans.length} rows`);

  // Lookup: old UserDailyPlan.Id (string) -> ExerciseId
  const planIdToExerciseId = new Map<string, string>();

  let planMigrated = 0;
  let planSkipped = 0;

  for (const row of oldPlans) {
    // Build lookup regardless of migration success
    planIdToExerciseId.set(String(row.Id), row.ExerciseId);

    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      planSkipped++;
      continue;
    }

    const date = toDateRequired(row.Date, `UserDailyPlan.Id=${row.Id}`);
    const exerciseId: string = row.ExerciseId;

    if (DRY_RUN) {
      planMigrated++;
      continue;
    }

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
      planMigrated++;
    } catch (err) {
      console.log(`  WARN: failed plan row Id=${row.Id}: ${err}`);
      planSkipped++;
    }
  }
  console.log(`  Done. migrated=${planMigrated}, skipped=${planSkipped}`);

  // ══════════════════════════════════════════════════════
  // 6. USER SUPPLEMENTS
  // ══════════════════════════════════════════════════════
  console.log("\n=== Migrating UserSupplements ===");
  const oldSupps = await fetchAll(pool, "UserSupplements");
  console.log(`  Found ${oldSupps.length} rows`);

  for (const row of oldSupps) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [DRY] Would upsert supplement "${row.SupplementId}" for "${row.UserId}"`);
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
    } catch (err) {
      console.log(`  WARN: failed supplement "${row.SupplementId}" for "${row.UserId}": ${err}`);
    }
  }
  console.log(`  Done.`);

  // ══════════════════════════════════════════════════════
  // 7. DAILY CHECKS
  //    ItemId for "step" type = old UserDailyPlan.Id (resolve to ExerciseId)
  //    ItemId for "supplement" type = Supplement.Id (already correct)
  // ══════════════════════════════════════════════════════
  console.log("\n=== Migrating DailyChecks ===");
  const oldChecks = await fetchAll(pool, "DailyChecks");
  console.log(`  Found ${oldChecks.length} rows`);

  let checksMigrated = 0;
  let checksSkipped = 0;

  for (const row of oldChecks) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      checksSkipped++;
      continue;
    }

    const date = toDateRequired(row.Date, `DailyChecks.Id=${row.Id}`);
    const itemType: string = row.ItemType;
    let itemId: string = row.ItemId;

    // Resolve step ItemId from old UserDailyPlan.Id -> ExerciseId
    if (itemType === "step") {
      const resolved = planIdToExerciseId.get(itemId);
      if (!resolved) {
        console.log(`  WARN: cannot resolve step planId=${itemId} -> exerciseId, skipping`);
        checksSkipped++;
        continue;
      }
      itemId = resolved;
    }

    if (DRY_RUN) {
      checksMigrated++;
      continue;
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
      checksMigrated++;
    } catch (err) {
      console.log(`  WARN: failed check Id=${row.Id}: ${err}`);
      checksSkipped++;
    }
  }
  console.log(`  Done. migrated=${checksMigrated}, skipped=${checksSkipped}`);

  // ══════════════════════════════════════════════════════
  // 8. SESSION LOGS
  // ══════════════════════════════════════════════════════
  console.log("\n=== Migrating SessionLogs ===");
  const oldLogs = await fetchAll(pool, "SessionLogs");
  console.log(`  Found ${oldLogs.length} rows`);

  for (const row of oldLogs) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }

    const date = toDateRequired(row.Date, `SessionLogs.Id=${row.Id}`);

    if (DRY_RUN) {
      console.log(`  [DRY] Would upsert session log for "${row.UserId}" date=${row.Date}`);
      continue;
    }

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
    console.log(`  Migrated log for "${row.UserId}" date=${row.Date}`);
  }

  // ══════════════════════════════════════════════════════
  // 9. USER MILESTONES
  // ══════════════════════════════════════════════════════
  console.log("\n=== Migrating UserMilestones ===");
  const oldMilestones = await fetchAll(pool, "UserMilestones");
  console.log(`  Found ${oldMilestones.length} rows`);

  for (const row of oldMilestones) {
    const newUserId = resolveUserId(row.UserId);
    if (!newUserId) {
      console.log(`  SKIP: unknown user "${row.UserId}"`);
      continue;
    }

    const milestoneId: string = row.MilestoneId;

    if (DRY_RUN) {
      console.log(`  [DRY] Would upsert milestone "${milestoneId}" for "${row.UserId}"`);
      continue;
    }

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
      console.log(`  Migrated milestone "${milestoneId}" for "${row.UserId}"`);
    } catch (err) {
      console.log(`  WARN: failed milestone "${milestoneId}" for "${row.UserId}": ${err}`);
    }
  }

  // ══════════════════════════════════════════════════════
  // DONE
  // ══════════════════════════════════════════════════════
  console.log("\n=== MIGRATION COMPLETE ===\n");

  await pool.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
