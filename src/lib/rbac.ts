import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getPrincipalFromRequest } from "@/lib/auth";

export function isRoleAllowed(role: Role, allowed: Role[]) {
  return allowed.includes(role);
}

export async function requireRoles(req: NextRequest, allowed: Role[]) {
  const principal = await getPrincipalFromRequest(req);
  if (!principal) {
    return {
      principal: null,
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }
  if (!isRoleAllowed(principal.role, allowed)) {
    return {
      principal,
      denied: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }
  return { principal, denied: null as NextResponse | null };
}
