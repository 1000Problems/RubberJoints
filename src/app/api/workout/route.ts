import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam
    ? new Date(dateParam + "T00:00:00Z")
    : new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z");

  const [plan, supplements, dailyChecks] = await Promise.all([
    prisma.userDailyPlan.findMany({
      where: { userId: session.userId, date },
      include: { exercise: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.userSupplement.findMany({
      where: { userId: session.userId },
      include: { supplement: true },
    }),
    prisma.dailyCheck.findMany({
      where: { userId: session.userId, date },
    }),
  ]);

  // Build check state map
  const checks: Record<string, boolean> = {};
  for (const c of dailyChecks) {
    checks[`${c.itemType}:${c.itemId}:${c.stepIndex}`] = c.checked;
  }

  // Determine day type and label from the plan entries
  const dayType = plan.length > 0 ? (plan[0].dayType || "training") : "rest";
  const dayName = DAY_NAMES[date.getUTCDay()];

  let dayLabel: string;
  if (dayType === "rest" || plan.length === 0) {
    dayLabel = `${dayName} . Rest Day`;
  } else {
    const totalExercises = plan.length;
    const estMinutes = totalExercises * 5;
    dayLabel = `${dayName} . Training Session`;
    if (estMinutes > 0) {
      dayLabel = `${dayName} . Training Session`;
    }
  }

  // Build week days array (Mon-Sun around the selected date)
  const todayStr = new Date().toISOString().split("T")[0];
  const selectedDay = date.getUTCDay(); // 0=Sun
  // Find the Monday of this week
  const mondayOffset = selectedDay === 0 ? -6 : 1 - selectedDay;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);

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
      isSelected: dStr === (dateParam || todayStr),
      isPast: dStr < todayStr,
    });
  }

  const isFuture = (dateParam || todayStr) > todayStr;

  return NextResponse.json({
    plan,
    supplements,
    checks,
    dayType,
    dayLabel,
    weekDays,
    isFuture,
  });
}
