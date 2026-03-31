import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generatePlanForUser } from "@/lib/plan";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [enrollment, programs] = await Promise.all([
    prisma.userEnrollment.findFirst({
      where: { userId: session.userId, status: "active" },
      include: { program: true },
    }),
    prisma.program.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ enrollment, programs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { programId, startDate, restart } = await req.json();
  if (!programId) {
    return NextResponse.json({ error: "programId required" }, { status: 400 });
  }

  const date = startDate ? new Date(startDate + "T00:00:00Z") : new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z");

  if (restart) {
    // Deactivate existing enrollments
    await prisma.userEnrollment.updateMany({
      where: { userId: session.userId, status: "active" },
      data: { status: "completed" },
    });

    // Delete existing plan entries
    await prisma.userDailyPlan.deleteMany({
      where: { userId: session.userId },
    });
  } else {
    // Deactivate any existing active enrollment
    await prisma.userEnrollment.updateMany({
      where: { userId: session.userId, status: "active" },
      data: { status: "completed" },
    });
  }

  // Create new enrollment
  await prisma.userEnrollment.create({
    data: {
      userId: session.userId,
      programId,
      startDate: date,
      status: "active",
    },
  });

  // Update start date in settings
  await prisma.userSettings.upsert({
    where: { userId: session.userId },
    update: { startDate: date },
    create: { userId: session.userId, startDate: date },
  });

  // Generate the plan
  const count = await generatePlanForUser(session.userId, programId, date);

  return NextResponse.json({ ok: true, planEntries: count });
}
