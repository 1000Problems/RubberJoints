import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

function utcDate(d: Date): Date {
  return new Date(d.toISOString().split("T")[0] + "T00:00:00Z");
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
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

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

const dayTypeLabels: Record<string, { label: string; duration: string }> = {
  training: { label: "Training Session", duration: "~45 min" },
  recovery: { label: "Rest + Passive Recovery", duration: "~20 min" },
  active_recovery: { label: "Active Recovery", duration: "~30 min" },
  rest: { label: "Rest Day", duration: "~10 min" },
  custom: { label: "Custom Session", duration: "~30 min" },
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);

  // Get enrollment
  const enrollment = await prisma.userEnrollment.findFirst({
    where: { userId: session.userId, status: "active" },
    include: { program: true },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "No active enrollment" }, { status: 400 });
  }

  const enrollStart = utcDate(enrollment.startDate);
  const todayPacificStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const todayUTC = new Date(todayPacificStr + "T00:00:00Z");
  const thisMonday = getMonday(todayUTC);
  const targetMonday = addDaysUTC(thisMonday, offset * 7);
  const targetSunday = addDaysUTC(targetMonday, 6);

  // Calculate week number (1-based from enrollment start)
  const daysSinceStart = Math.floor(
    (targetMonday.getTime() - enrollStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNumber = Math.max(1, Math.floor(daysSinceStart / 7) + 1);
  const totalWeeks = Math.ceil(enrollment.program.durationDays / 7);

  // Fetch plan items + checks + supplements for the whole week
  const [planItems, dailyChecks, supplements] = await Promise.all([
    prisma.userDailyPlan.findMany({
      where: {
        userId: session.userId,
        date: { gte: targetMonday, lte: targetSunday },
      },
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.dailyCheck.findMany({
      where: {
        userId: session.userId,
        date: { gte: targetMonday, lte: targetSunday },
      },
    }),
    prisma.userSupplement.findMany({
      where: { userId: session.userId },
    }),
  ]);

  // Build per-day data
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDaysUTC(targetMonday, i);
    const dateStr = fmtDate(d);
    const isToday = dateStr === fmtDate(todayUTC);
    const isFuture = d.getTime() > todayUTC.getTime();

    // Filter plan items for this day
    const dayPlan = planItems.filter(
      (p) => fmtDate(p.date) === dateStr
    );
    const dayChecks = dailyChecks.filter(
      (c) => fmtDate(c.date) === dateStr
    );

    // Determine day type from plan
    const dayType = dayPlan.length > 0 ? dayPlan[0].dayType : "rest";
    const info = dayTypeLabels[dayType] || dayTypeLabels.training;

    // Category progress
    const categories: Record<string, { done: number; total: number }> = {};
    const catOrder = ["warmup_tool", "mobility", "recovery_tool"];
    for (const cat of catOrder) {
      const items = dayPlan.filter((p) => p.category === cat);
      if (items.length === 0) continue;
      const done = items.filter((item) =>
        dayChecks.some(
          (c) =>
            c.itemType === "step" &&
            c.itemId === item.exerciseId &&
            c.checked
        )
      ).length;
      categories[cat] = { done, total: items.length };
    }

    // Supplements progress
    let vitaminsDone = 0;
    const vitaminsTotal = supplements.length;
    if (vitaminsTotal > 0) {
      vitaminsDone = supplements.filter((s) =>
        dayChecks.some(
          (c) =>
            c.itemType === "supplement" &&
            c.itemId === s.supplementId &&
            c.checked
        )
      ).length;
    }

    days.push({
      date: dateStr,
      dayName: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
      dayShort: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      isToday,
      isFuture,
      dayType,
      label: info.label,
      duration: info.duration,
      categories,
      vitaminsDone,
      vitaminsTotal,
      hasPlan: dayPlan.length > 0,
    });
  }

  return NextResponse.json({
    days,
    weekNumber,
    totalWeeks,
    offset,
  });
}
