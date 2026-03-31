import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayPacific } from "@/lib/dates";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { type, id, enabled } = await req.json();
  if (!type || !id) {
    return NextResponse.json({ error: "type and id required" }, { status: 400 });
  }

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId: session.userId },
  });
  if (!prefs) {
    return NextResponse.json({ error: "No preferences found" }, { status: 404 });
  }

  const today = todayPacific();

  if (type === "exercise") {
    // Update preferences
    const current = prefs.selectedExercises ? prefs.selectedExercises.split(",").filter(Boolean) : [];
    const updated = enabled
      ? [...new Set([...current, id])]
      : current.filter((e) => e !== id);

    await prisma.userPreferences.update({
      where: { userId: session.userId },
      data: { selectedExercises: updated.join(",") },
    });

    if (enabled) {
      // TURNING ON: Add exercise to all future plan days that have exercises
      const exercise = await prisma.exercise.findUnique({ where: { id } });
      if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

      const enrollment = await prisma.userEnrollment.findFirst({
        where: { userId: session.userId, status: "active" },
      });
      if (enrollment) {
        // Get all future dates that already have plan entries (active training days)
        const futureDates = await prisma.userDailyPlan.findMany({
          where: { userId: session.userId, date: { gte: today } },
          select: { date: true },
          distinct: ["date"],
        });

        for (const fd of futureDates) {
          const maxSort = await prisma.userDailyPlan.aggregate({
            where: { userId: session.userId, date: fd.date },
            _max: { sortOrder: true },
          });
          await prisma.userDailyPlan.upsert({
            where: {
              userId_date_exerciseId: {
                userId: session.userId,
                date: fd.date,
                exerciseId: id,
              },
            },
            update: {},
            create: {
              userId: session.userId,
              programId: enrollment.programId,
              date: fd.date,
              dayType: "custom",
              exerciseId: id,
              category: exercise.category,
              sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
              rx: exercise.defaultRx,
            },
          });
        }
      }
    } else {
      // TURNING OFF: Remove exercise from all future plan days
      await prisma.userDailyPlan.deleteMany({
        where: {
          userId: session.userId,
          exerciseId: id,
          date: { gte: today },
        },
      });
    }
  } else if (type === "supplement") {
    const current = prefs.selectedSupplements ? prefs.selectedSupplements.split(",").filter(Boolean) : [];
    const updated = enabled
      ? [...new Set([...current, id])]
      : current.filter((s) => s !== id);

    await prisma.userPreferences.update({
      where: { userId: session.userId },
      data: { selectedSupplements: updated.join(",") },
    });

    if (enabled) {
      // Add supplement to user's active list
      const supplement = await prisma.supplement.findUnique({ where: { id } });
      if (supplement) {
        await prisma.userSupplement.upsert({
          where: { userId_supplementId: { userId: session.userId, supplementId: id } },
          update: { timeGroup: supplement.timeGroup },
          create: { userId: session.userId, supplementId: id, timeGroup: supplement.timeGroup },
        });
      }
    } else {
      // Remove supplement from user's active list
      await prisma.userSupplement.deleteMany({
        where: { userId: session.userId, supplementId: id },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
