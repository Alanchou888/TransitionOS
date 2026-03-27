import { describe, expect, it } from "vitest";
import { hasMissingCitationSections } from "@/lib/generation/validation";

describe("citation validation", () => {
  it("flags missing citations", () => {
    const input = {
      sections: [
        { key: "a", sourceItemIds: ["s1"] },
        { key: "b", sourceItemIds: [] }
      ]
    };
    expect(hasMissingCitationSections(input)).toBe(true);
  });

  it("passes complete citation map", () => {
    const input = {
      sections: [
        { key: "a", sourceItemIds: ["s1"] },
        { key: "b", sourceItemIds: ["s2"] }
      ]
    };
    expect(hasMissingCitationSections(input)).toBe(false);
  });
});

