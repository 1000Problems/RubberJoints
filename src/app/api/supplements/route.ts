import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET: available supplements, optionally filtered by timeGroup
// If ?all=true, returns all supplements (for personalization picker)
// Otherwise filters out supplements already in user's list
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const timeGroup = req.nextUrl.searchParams.get("timeGroup");
  const all = req.nextUrl.searchParams.get("all");

  const where: Record<string, unknown> = {};

  if (!all) {
    const userSupps = await prisma.userSupplement.findMany({
      where: { userId: session.userId },
      select: { supplementId: true },
    });
    const userSuppIds = userSupps.map((s) => s.supplementId);
    where.id = { notIn: userSuppIds };
  }

  if (timeGroup) where.timeGroup = timeGroup;

  const supplements = await prisma.supplement.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json({ supplements });
}

// POST: add supplement to user's active list
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { supplementId, timeGroup } = await req.json();
  if (!supplementId || !timeGroup) {
    return NextResponse.json({ error: "supplementId and timeGroup required" }, { status: 400 });
  }

  await prisma.userSupplement.upsert({
    where: { userId_supplementId: { userId: session.userId, supplementId } },
    update: { timeGroup },
    create: { userId: session.userId, supplementId, timeGroup },
  });

  return NextResponse.json({ ok: true });
}
