import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { milestoneId } = await req.json();
  if (!milestoneId) {
    return NextResponse.json({ error: "milestoneId required" }, { status: 400 });
  }

  await prisma.userMilestone.upsert({
    where: {
      userId_milestoneId: { userId: session.userId, milestoneId },
    },
    update: { done: true, achievedDate: new Date() },
    create: {
      userId: session.userId,
      milestoneId,
      done: true,
      achievedDate: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
