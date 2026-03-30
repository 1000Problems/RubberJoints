import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const template = await prisma.programTemplate.findMany({
    where: { programId: 1 },
    orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }],
  });
  console.log(`Template: ${template.length} entries`);

  const seahat = await prisma.user.findUnique({ where: { username: "seahat" } });
  if (!seahat) { console.log("seahat not found"); return; }

  const enrollment = await prisma.userEnrollment.findFirst({
    where: { userId: seahat.id, status: "active" },
  });
  if (!enrollment) { console.log("no active enrollment"); return; }

  const program = await prisma.program.findUnique({ where: { id: enrollment.programId } });
  if (!program) { console.log("no program"); return; }

  console.log(`Generating ${program.durationDays}-day plan starting ${enrollment.startDate.toISOString().split("T")[0]}`);

  let count = 0;
  for (let day = 1; day <= program.durationDays; day++) {
    const date = new Date(enrollment.startDate);
    date.setUTCDate(date.getUTCDate() + day - 1);
    date.setUTCHours(0, 0, 0, 0);

    const dayTemplates = template.filter((t) => t.dayNumber === day);
    for (const t of dayTemplates) {
      try {
        await prisma.userDailyPlan.upsert({
          where: {
            userId_date_exerciseId: {
              userId: seahat.id,
              date,
              exerciseId: t.exerciseId,
            },
          },
          update: {},
          create: {
            userId: seahat.id,
            programId: enrollment.programId,
            date,
            dayType: t.dayType,
            exerciseId: t.exerciseId,
            category: t.category,
            sortOrder: t.sortOrder,
            rx: t.rx,
          },
        });
        count++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message.slice(0, 80) : String(e);
        console.error(`  skip ${t.exerciseId}: ${msg}`);
      }
    }
  }

  console.log(`Generated ${count} plan entries for seahat`);

  const todayPlans = await prisma.userDailyPlan.findMany({
    where: { userId: seahat.id, date: new Date("2026-03-30T00:00:00Z") },
  });
  console.log(`seahat today: ${todayPlans.length} exercises`);

  await prisma.$disconnect();
}

main();
