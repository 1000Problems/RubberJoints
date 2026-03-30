import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash, user.salt);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Upgrade legacy PBKDF2 hash to bcrypt on successful login
  if (!user.passwordHash.startsWith("$2")) {
    const { hash, salt } = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, salt },
    });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
}
