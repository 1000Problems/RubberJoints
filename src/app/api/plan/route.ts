import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayPacific } from "@/lib/dates";

// POST: add exercise to user's daily plan + all future days + sync preferences
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
    include: { program: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "No active enrollment" }, { status: 400 });
  }

  const targetDate = date ? new Date(date + "T00:00:00Z") : todayPacific();
  const today = todayPacific();

  // Add to the target date
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

  // Add to ALL future plan days that already have exercises
  // (i.e., days that have a plan — skip rest days with no entries)
  const futureDates = await prisma.userDailyPlan.findMany({
    where: { userId: session.userId, date: { gt: today } },
    select: { date: true },
    distinct: ["date"],
  });

  for (const fd of futureDates) {
    const fdMaxSort = await prisma.userDailyPlan.aggregate({
      where: { userId: session.userId, date: fd.date },
      _max: { sortOrder: true },
    });
    await prisma.userDailyPlan.upsert({
      where: {
        userId_date_exerciseId: {
          userId: session.userId,
          date: fd.date,
          exerciseId,
        },
      },
      update: {},
      create: {
        userId: session.userId,
        programId: enrollment.programId,
        date: fd.date,
        dayType: "custom",
        exerciseId,
        category: exercise.category,
        sortOrder: (fdMaxSort._max.sortOrder ?? 0) + 1,
        rx: exercise.defaultRx,
        isManual: true,
      },
    });
  }

  // Sync preferences: add exerciseId to selectedExercises
  const prefs = await prisma.userPreferences.findUnique({ where: { userId: session.userId } });
  if (prefs) {
    const current = prefs.selectedExercises ? prefs.selectedExercises.split(",").filter(Boolean) : [];
    if (!current.includes(exerciseId)) {
      current.push(exerciseId);
      await prisma.userPreferences.update({
        where: { userId: session.userId },
        data: { selectedExercises: current.join(",") },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE: remove exercise from today + all future plan days + sync preferences
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { exerciseId } = await req.json();
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }

  const today = todayPacific();

  // Remove from today and all future plan days
  await prisma.userDailyPlan.deleteMany({
    where: {
      userId: session.userId,
      exerciseId,
      date: { gte: today },
    },
  });

  // Sync preferences: remove exerciseId from selectedExercises
  const prefs = await prisma.userPreferences.findUnique({ where: { userId: session.userId } });
  if (prefs && prefs.selectedExercises) {
    const updated = prefs.selectedExercises.split(",").filter((id) => id !== exerciseId);
    await prisma.userPreferences.update({
      where: { userId: session.userId },
      data: { selectedExercises: updated.join(",") },
    });
  }

  return NextResponse.json({ ok: true });
}
