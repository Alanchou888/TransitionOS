import { describe, expect, it } from "vitest";
import { redactPII } from "@/lib/knowledge/redaction";
import { extractDecisionStitchMeta } from "@/lib/knowledge/decision-stitch";
import { pickRelevantByQuery } from "@/lib/knowledge/retrieval";

describe("knowledge pipeline helpers", () => {
  it("redacts email, phone, and salary-like amounts", () => {
    const input = "Contact me at alice@example.com or +886 912 345 678. Salary is NT$ 150,000.";
    const result = redactPII(input);
    expect(result.text).toContain("[REDACTED_EMAIL]");
    expect(result.text).toContain("[REDACTED_PHONE]");
    expect(result.text).toContain("[REDACTED_AMOUNT]");
  });

  it("extracts issue and file references", () => {
    const meta = extractDecisionStitchMeta("See PROJ-123 and #42 in src/app/api/route.ts");
    expect(meta.issueRefs).toContain("PROJ-123");
    expect(meta.issueRefs).toContain("#42");
    expect(meta.fileRefs).toContain("src/app/api/route.ts");
  });

  it("retrieves relevant items for query", () => {
    const now = new Date("2026-03-26T00:00:00.000Z");
    const items = [
      {
        id: "1",
        title: "Caching strategy decision",
        rawContent: "We changed cache ttl due to traffic spike and latency.",
        createdAtSource: now,
        createdAt: now
      },
      {
        id: "2",
        title: "Payroll checklist",
        rawContent: "Monthly payroll process details.",
        createdAtSource: now,
        createdAt: now
      }
    ] as any[];
    const picked = pickRelevantByQuery(items, "why cache latency spiked", now, 1);
    expect(picked[0].id).toBe("1");
  });
});

