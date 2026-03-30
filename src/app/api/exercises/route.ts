import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const category = req.nextUrl.searchParams.get("category");
  const where = category ? { category } : {};

  const exercises = await prisma.exercise.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json({ exercises });
}
