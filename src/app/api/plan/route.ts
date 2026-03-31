import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayPacific } from "@/lib/dates";

// POST: add exercise to user's daily plan
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { exerciseId, date } = await req.json();
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }

  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  const enrollment = await prisma.userEnrollment.findFirst({
    where: { userId: session.userId, status: "active" },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "No active enrollment" }, { status: 400 });
  }

  const targetDate = date ? new Date(date + "T00:00:00Z") : todayPacific();

  // Get max sort order for this day
  const maxSort = await prisma.userDailyPlan.aggregate({
    where: { userId: session.userId, date: targetDate },
    _max: { sortOrder: true },
  });

  await prisma.userDailyPlan.upsert({
    where: {
      userId_date_exerciseId: {
        userId: session.userId,
        date: targetDate,
        exerciseId,
      },
    },
    update: {},
    create: {
      userId: session.userId,
      programId: enrollment.programId,
      date: targetDate,
      dayType: "custom",
      exerciseId,
      category: exercise.category,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      rx: exercise.defaultRx,
      isManual: true,
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE: remove exercise from today + all future plan days
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { exerciseId } = await req.json();
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }

  const today = todayPacific();

  await prisma.userDailyPlan.deleteMany({
    where: {
      userId: session.userId,
      exerciseId,
      date: { gte: today },
    },
  });

  return NextResponse.json({ ok: true });
}
