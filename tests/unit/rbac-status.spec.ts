import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { isRoleAllowed } from "@/lib/rbac";
import { canTransition } from "@/lib/status";

describe("rbac and state transitions", () => {
  it("rbac allows manager for manager routes", () => {
    expect(isRoleAllowed(Role.MANAGER, [Role.MANAGER, Role.ADMIN])).toBe(true);
  });

  it("rbac rejects successor for manager routes", () => {
    expect(isRoleAllowed(Role.SUCCESSOR, [Role.MANAGER, Role.ADMIN])).toBe(false);
  });

  it("task flow supports DRAFT -> INGESTING -> GENERATED -> IN_REVIEW -> APPROVED -> EXPORTED", () => {
    expect(canTransition("DRAFT", "INGESTING")).toBe(true);
    expect(canTransition("INGESTING", "GENERATED")).toBe(true);
    expect(canTransition("GENERATED", "IN_REVIEW")).toBe(true);
    expect(canTransition("IN_REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "EXPORTED")).toBe(true);
  });

  it("task flow rejects invalid shortcut transitions", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("INGESTING", "IN_REVIEW")).toBe(false);
  });
});

