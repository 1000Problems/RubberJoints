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
