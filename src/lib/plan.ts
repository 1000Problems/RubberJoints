import { prisma } from "./db";

export async function generatePlanForUser(userId: number, programId: number, startDate: Date) {
  // Get program template
  const template = await prisma.programTemplate.findMany({
    where: { programId },
    orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }],
  });

  if (template.length === 0) return;

  // Get program duration
  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return;

  // Build plan entries for each day (full program duration)
  const entries = [];
  for (let day = 1; day <= program.durationDays; day++) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + day - 1);
    date.setUTCHours(0, 0, 0, 0);

    const dayTemplates = template.filter((t) => t.dayNumber === day);
    for (const t of dayTemplates) {
      entries.push({
        userId,
        programId,
        date: new Date(date), // clone to avoid mutation
        dayType: t.dayType,
        exerciseId: t.exerciseId,
        category: t.category,
        sortOrder: t.sortOrder,
        rx: t.rx,
      });
    }
  }

  // Insert all plan entries, skip duplicates
  for (const entry of entries) {
    await prisma.userDailyPlan.upsert({
      where: {
        userId_date_exerciseId: {
          userId: entry.userId,
          date: entry.date,
          exerciseId: entry.exerciseId,
        },
      },
      update: {},
      create: entry,
    });
  }

  return entries.length;
}
