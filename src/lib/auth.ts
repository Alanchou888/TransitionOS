import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DemoPrincipal } from "@/lib/types";

export async function getPrincipalFromRequest(req: NextRequest): Promise<DemoPrincipal | null> {
  const headerUserId = req.headers.get("x-demo-user-id");
  const cookieUserId = req.cookies.get("demo_user_id")?.value;
  const userId = headerUserId ?? cookieUserId;

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      return { id: user.id, email: user.email, role: user.role };
    }
  }

  const allowFallback = process.env.DEMO_ALLOW_UNAUTH_FALLBACK === "true";
  if (!allowFallback) {
    return null;
  }

  const fallback = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!fallback) {
    return null;
  }
  return { id: fallback.id, email: fallback.email, role: fallback.role };
}

export async function getPrincipalFromCookies(): Promise<DemoPrincipal | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("demo_user_id")?.value;
  if (!userId) {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }
  return { id: user.id, email: user.email, role: user.role };
}

export function roleLabel(role: Role): string {
  const map: Record<Role, string> = {
    ADMIN: "Admin",
    EMPLOYEE: "Employee",
    MANAGER: "Manager",
    SUCCESSOR: "Successor",
    MENTOR: "Mentor"
  };
  return map[role];
}
