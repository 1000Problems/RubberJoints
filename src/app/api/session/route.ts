import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayPacific } from "@/lib/dates";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { stepsDone, stepsTotal } = await req.json();
  const today = todayPacific();

  await prisma.sessionLog.upsert({
    where: {
      userId_date: { userId: session.userId, date: today },
    },
    update: { stepsDone: stepsDone ?? 0, stepsTotal: stepsTotal ?? 0 },
    create: {
      userId: session.userId,
      date: today,
      stepsDone: stepsDone ?? 0,
      stepsTotal: stepsTotal ?? 0,
    },
  });

  return NextResponse.json({ ok: true });
}
