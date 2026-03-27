import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/status";

describe("workflow integration checks", () => {
  it("supports reject loop from IN_REVIEW to CHANGES_REQUESTED and back", () => {
    expect(canTransition("IN_REVIEW", "CHANGES_REQUESTED")).toBe(true);
    expect(canTransition("CHANGES_REQUESTED", "IN_REVIEW")).toBe(true);
  });
});

