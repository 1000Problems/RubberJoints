import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function todayPacificStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const todayStr = todayPacificStr();
  const dateParam = req.nextUrl.searchParams.get("date");
  const anchorStr = dateParam || todayStr;
  const anchorDate = new Date(anchorStr + "T00:00:00Z");

  // Calculate Monday of the week containing the anchor date
  const anchorDay = anchorDate.getUTCDay(); // 0=Sun
  const mondayOffset = anchorDay === 0 ? -6 : 1 - anchorDay;
  const monday = new Date(anchorDate);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  // Fetch the entire week's data in bulk
  const [weekPlan, supplements, weekChecks] = await Promise.all([
    prisma.userDailyPlan.findMany({
      where: {
        userId: session.userId,
        date: { gte: monday, lte: sunday },
      },
      include: { exercise: true },
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.userSupplement.findMany({
      where: { userId: session.userId },
      include: { supplement: true },
    }),
    prisma.dailyCheck.findMany({
      where: {
        userId: session.userId,
        date: { gte: monday, lte: sunday },
      },
    }),
  ]);

  // Build per-day data
  const days: Record<string, {
    plan: typeof weekPlan;
    checks: Record<string, boolean>;
    dayType: string;
    dayLabel: string;
    isFuture: boolean;
  }> = {};

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const dStr = d.toISOString().split("T")[0];

    const dayPlan = weekPlan.filter((p) => {
      const pStr = p.date instanceof Date
        ? p.date.toISOString().split("T")[0]
        : String(p.date).split("T")[0];
      return pStr === dStr;
    });

    const dayChecks: Record<string, boolean> = {};
    for (const c of weekChecks) {
      const cStr = c.date instanceof Date
        ? c.date.toISOString().split("T")[0]
        : String(c.date).split("T")[0];
      if (cStr === dStr) {
        dayChecks[`${c.itemType}:${c.itemId}:${c.stepIndex}`] = c.checked;
      }
    }

    const dayType = dayPlan.length > 0 ? (dayPlan[0].dayType || "training") : "rest";
    const dayName = DAY_NAMES[d.getUTCDay()];
    const dayLabel = (dayType === "rest" || dayPlan.length === 0)
      ? `${dayName} . Rest Day`
      : `${dayName} . Training Session`;

    days[dStr] = {
      plan: dayPlan,
      checks: dayChecks,
      dayType,
      dayLabel,
      isFuture: dStr > todayStr,
    };
  }

  // Build weekDays metadata
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const dStr = d.toISOString().split("T")[0];
    weekDays.push({
      date: dStr,
      dayLabel: DAY_SHORT[d.getUTCDay()],
      dayNumber: d.getUTCDate(),
      isToday: dStr === todayStr,
      isSelected: dStr === anchorStr,
      isPast: dStr < todayStr,
    });
  }

  return NextResponse.json({
    days,
    supplements,
    weekDays,
    selectedDate: anchorStr,
    todayStr,
  });
}
