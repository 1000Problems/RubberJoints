import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await Promise.all([
    prisma.dailyCheck.deleteMany({ where: { userId: session.userId } }),
    prisma.sessionLog.deleteMany({ where: { userId: session.userId } }),
    prisma.userMilestone.deleteMany({ where: { userId: session.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
