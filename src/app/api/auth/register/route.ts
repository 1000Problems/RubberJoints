import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { generatePlanForUser } from "@/lib/plan";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const { hash, salt } = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, passwordHash: hash, salt },
  });

  // Auto-enroll in first available program and generate plan
  const program = await prisma.program.findFirst();
  if (program) {
    const today = new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z");
    await prisma.userEnrollment.create({
      data: { userId: user.id, programId: program.id, startDate: today },
    });
    generatePlanForUser(user.id, program.id, today).catch(console.error);
  }

  // Create initial preferences (onboarding complete)
  await prisma.userPreferences.create({
    data: { userId: user.id, onboardingStep: 7 },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
}
