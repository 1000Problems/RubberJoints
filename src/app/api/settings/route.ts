import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [settings, exercises, supplements, prefs] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: session.userId } }),
    prisma.exercise.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.supplement.findMany({ orderBy: { name: "asc" } }),
    prisma.userPreferences.findUnique({ where: { userId: session.userId } }),
  ]);

  const selectedExercises = prefs?.selectedExercises ? prefs.selectedExercises.split(",") : [];
  const selectedSupplements = prefs?.selectedSupplements ? prefs.selectedSupplements.split(",") : [];

  // Group exercises by category
  const grouped: Record<string, typeof exercises> = {};
  for (const ex of exercises) {
    if (!grouped[ex.category]) grouped[ex.category] = [];
    grouped[ex.category].push(ex);
  }

  return NextResponse.json({
    startDate: settings?.startDate ?? null,
    disabledTools: settings?.disabledTools ?? null,
    exercisesByCategory: grouped,
    supplements,
    selectedExercises,
    selectedSupplements,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { startDate } = await req.json();
  if (!startDate) {
    return NextResponse.json({ error: "startDate required" }, { status: 400 });
  }

  await prisma.userSettings.upsert({
    where: { userId: session.userId },
    update: { startDate: new Date(startDate + "T00:00:00Z") },
    create: { userId: session.userId, startDate: new Date(startDate + "T00:00:00Z") },
  });

  return NextResponse.json({ ok: true });
}
