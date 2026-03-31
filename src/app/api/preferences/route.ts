import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST: toggle exercise/supplement in user preferences
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

  if (type === "exercise") {
    const current = prefs.selectedExercises ? prefs.selectedExercises.split(",") : [];
    const updated = enabled
      ? [...new Set([...current, id])]
      : current.filter((e) => e !== id);

    await prisma.userPreferences.update({
      where: { userId: session.userId },
      data: { selectedExercises: updated.join(",") },
    });

    // Regenerate future plan days based on updated exercise selection
    await regenerateFuturePlan(session.userId, new Set(updated));
  } else if (type === "supplement") {
    const current = prefs.selectedSupplements ? prefs.selectedSupplements.split(",") : [];
    const updated = enabled
      ? [...new Set([...current, id])]
      : current.filter((s) => s !== id);

    await prisma.userPreferences.update({
      where: { userId: session.userId },
      data: { selectedSupplements: updated.join(",") },
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * After a preference toggle, sync future UserDailyPlan rows:
 *  - Remove plan entries for exercises no longer selected
 *  - Add plan entries for newly selected exercises (using the program template)
 */
async function regenerateFuturePlan(userId: number, selectedExercises: Set<string>) {
  const todayStr = new Date().toISOString().split("T")[0] + "T00:00:00Z";
  const today = new Date(todayStr);

  // Find the user's active enrollment
  const enrollment = await prisma.userEnrollment.findFirst({
    where: { userId, status: "active" },
    include: { program: true },
  });
  if (!enrollment) return;

  const { programId, startDate, program } = enrollment;

  // Delete future plan entries for exercises that are no longer selected
  // (but keep manually added ones)
  await prisma.userDailyPlan.deleteMany({
    where: {
      userId,
      date: { gte: today },
      isManual: false,
      exerciseId: { notIn: [...selectedExercises] },
    },
  });

  // Get the program template to know which exercises belong on which days
  const template = await prisma.programTemplate.findMany({
    where: { programId },
    orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }],
  });
  if (template.length === 0) return;

  // Calculate day range for future dates within the program
  const enrollStart = new Date(startDate);
  enrollStart.setUTCHours(0, 0, 0, 0);

  for (let day = 1; day <= program.durationDays; day++) {
    const planDate = new Date(enrollStart);
    planDate.setUTCDate(planDate.getUTCDate() + day - 1);
    planDate.setUTCHours(0, 0, 0, 0);

    // Only touch future dates
    if (planDate < today) continue;

    const dayTemplates = template.filter((t) => t.dayNumber === day);
    for (const t of dayTemplates) {
      // Only add entries for exercises that are selected
      if (!selectedExercises.has(t.exerciseId)) continue;

      await prisma.userDailyPlan.upsert({
        where: {
          userId_date_exerciseId: {
            userId,
            date: planDate,
            exerciseId: t.exerciseId,
          },
        },
        update: {},
        create: {
          userId,
          programId,
          date: planDate,
          dayType: t.dayType,
          exerciseId: t.exerciseId,
          category: t.category,
          sortOrder: t.sortOrder,
          rx: t.rx,
        },
      });
    }
  }
}
