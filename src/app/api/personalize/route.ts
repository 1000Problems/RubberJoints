import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generatePlanForUser } from "@/lib/plan";
import { todayPacific } from "@/lib/dates";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { selectedExercises, selectedSupplements, daysPerWeek } = await req.json();

  if (!Array.isArray(selectedExercises) || !Array.isArray(selectedSupplements) || typeof daysPerWeek !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const userId = session.userId;

  // Update preferences
  await prisma.userPreferences.upsert({
    where: { userId },
    update: {
      selectedExercises: selectedExercises.join(","),
      selectedSupplements: selectedSupplements.join(","),
      daysPerWeek,
    },
    create: {
      userId,
      selectedExercises: selectedExercises.join(","),
      selectedSupplements: selectedSupplements.join(","),
      daysPerWeek,
    },
  });

  // Clear old user supplements and create new ones
  await prisma.userSupplement.deleteMany({ where: { userId } });

  if (selectedSupplements.length > 0) {
    // Fetch supplement details to get timeGroup
    const supps = await prisma.supplement.findMany({
      where: { id: { in: selectedSupplements } },
    });

    for (const supp of supps) {
      await prisma.userSupplement.create({
        data: {
          userId,
          supplementId: supp.id,
          timeGroup: supp.timeGroup,
        },
      });
    }
  }

  // Delete future plan entries and regenerate
  const today = todayPacific();
  await prisma.userDailyPlan.deleteMany({
    where: { userId, date: { gte: today } },
  });

  // Get active enrollment
  const enrollment = await prisma.userEnrollment.findFirst({
    where: { userId, status: "active" },
    include: { program: true },
  });

  if (enrollment) {
    // Regenerate plan
    await generatePlanForUser(userId, enrollment.programId, today);

    // Now remove exercises that are NOT in selectedExercises from today onward
    if (selectedExercises.length > 0) {
      await prisma.userDailyPlan.deleteMany({
        where: {
          userId,
          date: { gte: today },
          exerciseId: { notIn: selectedExercises },
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
