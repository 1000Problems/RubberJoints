import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, createdDate: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId: user.id },
    select: { onboardingStep: true },
  });

  return NextResponse.json({
    user: {
      ...user,
      onboardingStep: prefs?.onboardingStep ?? 0,
    },
  });
}
