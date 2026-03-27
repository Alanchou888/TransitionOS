import { Role } from "@prisma/client";
import type { DemoPrincipal } from "@/lib/types";

function hasRole(role: Role, allowed: Role[]) {
  return allowed.includes(role);
}

export function canCreateTask(role: Role) {
  return hasRole(role, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
}

export function canManageSources(role: Role) {
  return role === Role.ADMIN;
}

export function canRunGeneration(role: Role) {
  return hasRole(role, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
}

export function canEditHandover(role: Role) {
  return hasRole(role, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.MENTOR]);
}

export function canEditOnboarding(role: Role) {
  return hasRole(role, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.MENTOR]);
}

export function canEditChecklist(role: Role) {
  return hasRole(role, [Role.ADMIN, Role.MANAGER, Role.SUCCESSOR, Role.MENTOR]);
}

export function canApprove(role: Role) {
  return hasRole(role, [Role.ADMIN, Role.MANAGER]);
}

export function canManageTaskRole(role: Role) {
  return hasRole(role, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
}

export function canDeleteTaskRole(role: Role) {
  return hasRole(role, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
}

export function canManageTaskForPrincipal(principal: DemoPrincipal, ownerUserId: string) {
  if (!canManageTaskRole(principal.role)) {
    return false;
  }
  if (principal.role === Role.EMPLOYEE) {
    return principal.id === ownerUserId;
  }
  return true;
}

export function canDeleteTaskForPrincipal(principal: DemoPrincipal, ownerUserId: string) {
  if (!canDeleteTaskRole(principal.role)) {
    return false;
  }
  if (principal.role === Role.EMPLOYEE) {
    return principal.id === ownerUserId;
  }
  return true;
}
