import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayPacific } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(dateParam + "T00:00:00") : todayPacific();
  date.setHours(0, 0, 0, 0);

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

  return NextResponse.json({ plan, supplements, checks });
}
