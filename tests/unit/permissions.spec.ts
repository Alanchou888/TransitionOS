import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  canApprove,
  canCreateTask,
  canManageSources,
  canManageTaskForPrincipal
} from "@/lib/permissions";

describe("permissions", () => {
  it("allows create task only for admin/employee/manager", () => {
    expect(canCreateTask(Role.ADMIN)).toBe(true);
    expect(canCreateTask(Role.EMPLOYEE)).toBe(true);
    expect(canCreateTask(Role.MANAGER)).toBe(true);
    expect(canCreateTask(Role.SUCCESSOR)).toBe(false);
    expect(canCreateTask(Role.MENTOR)).toBe(false);
  });

  it("allows admin to manage sources", () => {
    expect(canManageSources(Role.ADMIN)).toBe(true);
    expect(canManageSources(Role.MANAGER)).toBe(false);
  });

  it("approval is only for admin/manager", () => {
    expect(canApprove(Role.ADMIN)).toBe(true);
    expect(canApprove(Role.MANAGER)).toBe(true);
    expect(canApprove(Role.EMPLOYEE)).toBe(false);
  });

  it("employee can only manage own tasks", () => {
    const employee = { id: "u-1", email: "e@local", role: Role.EMPLOYEE };
    const manager = { id: "u-2", email: "m@local", role: Role.MANAGER };
    expect(canManageTaskForPrincipal(employee, "u-1")).toBe(true);
    expect(canManageTaskForPrincipal(employee, "u-2")).toBe(false);
    expect(canManageTaskForPrincipal(manager, "u-2")).toBe(true);
  });
});
