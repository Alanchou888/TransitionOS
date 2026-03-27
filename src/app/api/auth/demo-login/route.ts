import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/http";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  if (!userId) {
    return badRequest("userId is required");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, user });
  response.cookies.set("demo_user_id", user.id, {
    httpOnly: false,
    path: "/",
    sameSite: "lax"
  });
  return response;
}

