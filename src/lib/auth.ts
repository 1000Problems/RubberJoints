import { cookies } from "next/headers";
import { prisma } from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SESSION_COOKIE = "rj_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// Simple token-based sessions stored as signed cookies
// Token format: userId:randomBytes:hmac

function signToken(userId: number): string {
  const random = crypto.randomBytes(32).toString("hex");
  const data = `${userId}:${random}`;
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `${data}:${hmac}`;
}

function verifyToken(token: string): number | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [userId, random, hmac] = parts;
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${random}`)
    .digest("hex");
  if (hmac !== expected) return null;
  return parseInt(userId, 10);
}

// ── PBKDF2 (legacy, from original ASP.NET app) ──

function verifyPbkdf2(password: string, storedHash: string, storedSalt: string): boolean {
  const salt = Buffer.from(storedSalt, "base64");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  const expected = Buffer.from(storedHash, "base64");
  if (hash.length !== expected.length) return false;
  return crypto.timingSafeEqual(hash, expected);
}

function isPbkdf2Hash(hash: string): boolean {
  // bcrypt hashes start with "$2a$" or "$2b$", PBKDF2 are base64 (~44 chars)
  return !hash.startsWith("$2");
}

// ── bcrypt (new registrations) ──

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  return { hash, salt };
}

// Verifies against both legacy PBKDF2 and new bcrypt hashes
export async function verifyPassword(password: string, hash: string, salt?: string): Promise<boolean> {
  if (isPbkdf2Hash(hash) && salt) {
    return verifyPbkdf2(password, hash, salt);
  }
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number): Promise<void> {
  const token = signToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifyToken(token);
  if (!userId) return null;
  // Verify user still exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return { userId };
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, createdDate: true },
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
