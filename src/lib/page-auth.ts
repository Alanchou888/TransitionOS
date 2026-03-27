import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getPrincipalFromCookies } from "@/lib/auth";
import { isRoleAllowed } from "@/lib/rbac";

export async function requirePageRoles(allowed: Role[]) {
  const principal = await getPrincipalFromCookies();
  if (!principal) {
    redirect("/login");
  }
  if (!isRoleAllowed(principal.role, allowed)) {
    redirect("/dashboard");
  }
  return principal;
}
