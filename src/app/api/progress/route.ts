import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

function utcDate(d: Date): Date {
  return new Date(d.toISOString().split("T")[0] + "T00:00:00Z");
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDaysUTC(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const todayPacificStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const todayUTC = new Date(todayPacificStr + "T00:00:00Z");
  const thisMonday = getMonday(todayUTC);
  const thisSunday = addDaysUTC(thisMonday, 6);

  // Get enrollment
  const enrollment = await prisma.userEnrollment.findFirst({
    where: { userId: session.userId, status: "active" },
    include: { program: true },
  });

  const enrollStart = enrollment ? utcDate(enrollment.startDate) : todayUTC;
  const daysSinceStart = Math.floor(
    (thisMonday.getTime() - enrollStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNumber = enrollment ? Math.max(1, Math.floor(daysSinceStart / 7) + 1) : 1;
  const totalWeeks = enrollment ? Math.ceil(enrollment.program.durationDays / 7) : 4;

  // Fetch all data in parallel
  const [
    thisWeekLogs,
    totalLogs,
    todayPlan,
    todayChecks,
    supplements,
    milestones,
    userMilestones,
  ] = await Promise.all([
    // Session logs this week
    prisma.sessionLog.findMany({
      where: {
        userId: session.userId,
        date: { gte: thisMonday, lte: thisSunday },
      },
    }),
    // Total session logs
    prisma.sessionLog.count({
      where: { userId: session.userId },
    }),
    // Today's plan
    prisma.userDailyPlan.findMany({
      where: { userId: session.userId, date: todayUTC },
    }),
    // Today's checks
    prisma.dailyCheck.findMany({
      where: { userId: session.userId, date: todayUTC },
    }),
    // User supplements
    prisma.userSupplement.findMany({
      where: { userId: session.userId },
    }),
    // All milestones
    prisma.milestone.findMany({
      orderBy: { id: "asc" },
    }),
    // User milestones
    prisma.userMilestone.findMany({
      where: { userId: session.userId },
    }),
  ]);

  // This week sessions (days with any checked items)
  const thisWeekSessions = thisWeekLogs.filter((l) => l.stepsDone > 0).length;

  // Today's workout percentage
  const todaySteps = todayPlan.length;
  const todayDone = todaySteps > 0
    ? todayPlan.filter((p) =>
        todayChecks.some(
          (c) => c.itemType === "step" && c.itemId === p.exerciseId && c.checked
        )
      ).length
    : 0;
  const todayWorkoutPct = todaySteps > 0 ? Math.round((todayDone / todaySteps) * 100) : 0;

  // Vitamins today
  const vitaminsTotal = supplements.length;
  const vitaminsDone = supplements.filter((s) =>
    todayChecks.some(
      (c) => c.itemType === "supplement" && c.itemId === s.supplementId && c.checked
    )
  ).length;

  // Merge milestones with user status
  const userMilestoneMap = new Map(
    userMilestones.map((um) => [um.milestoneId, um])
  );

  const milestonesWithStatus = milestones.map((m) => {
    const um = userMilestoneMap.get(m.id);
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      done: um?.done ?? false,
      achievedDate: um?.achievedDate
        ? um.achievedDate.toISOString().split("T")[0]
        : null,
    };
  });

  return NextResponse.json({
    thisWeekSessions,
    totalSessions: totalLogs,
    todayWorkoutPct,
    vitaminsDone,
    vitaminsTotal,
    milestones: milestonesWithStatus,
    weekNumber,
    totalWeeks,
  });
}
