import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { date, itemType, itemId, stepIndex, checked } = await req.json();
  if (!date || !itemType || !itemId) {
    return NextResponse.json({ error: "date, itemType, itemId required" }, { status: 400 });
  }

  const dateObj = new Date(date + "T00:00:00Z");

  await prisma.dailyCheck.upsert({
    where: {
      userId_date_itemType_itemId_stepIndex: {
        userId: session.userId,
        date: dateObj,
        itemType,
        itemId,
        stepIndex: stepIndex ?? 0,
      },
    },
    update: { checked },
    create: {
      userId: session.userId,
      date: dateObj,
      itemType,
      itemId,
      stepIndex: stepIndex ?? 0,
      checked,
    },
  });

  return NextResponse.json({ ok: true });
}
