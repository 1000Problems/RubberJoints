import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayPacific } from "@/lib/dates";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const today = todayPacific();
  const userId = session.userId;

  const [planItems, exerciseChecks, supplements, supplementChecks] = await Promise.all([
    prisma.userDailyPlan.findMany({
      where: { userId, date: today },
    }),
    prisma.dailyCheck.findMany({
      where: { userId, date: today, itemType: "step", checked: true },
    }),
    prisma.userSupplement.findMany({
      where: { userId },
    }),
    prisma.dailyCheck.findMany({
      where: { userId, date: today, itemType: "supplement", checked: true },
    }),
  ]);

  // Unique exercises done (by itemId)
  const exercisesDoneIds = new Set(exerciseChecks.map((c) => c.itemId));

  return NextResponse.json({
    exercisesDone: exercisesDoneIds.size,
    exercisesTotal: planItems.length,
    supplementsDone: supplementChecks.length,
    supplementsTotal: supplements.length,
  });
}
