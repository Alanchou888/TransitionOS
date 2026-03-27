import { describe, expect, it } from "vitest";
import { SourceType, TaskType, TaskStatus } from "@prisma/client";
import { GithubAdapter } from "@/lib/connectors/github";
import { NotionAdapter } from "@/lib/connectors/notion";

const demoTask = {
  id: "task-1",
  type: TaskType.BOTH,
  ownerUserId: "owner-1",
  targetRole: "Backend Engineer",
  successorUserId: null,
  dateFrom: new Date("2026-01-01T00:00:00.000Z"),
  dateTo: new Date("2026-01-31T00:00:00.000Z"),
  sourceSelection: null,
  status: TaskStatus.DRAFT,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("connector normalization", () => {
  it("GithubAdapter returns sample repo items when token is missing", async () => {
    const adapter = new GithubAdapter();
    const materials = await adapter.fetchItems(
      {
        id: "c1",
        type: SourceType.GITHUB_REPO,
        enabled: true,
        createdBy: "u1",
        configJson: { owner: "demo-org", repo: "transitionos", token: "" },
        createdAt: new Date()
      },
      demoTask
    );
    expect(materials.length).toBeGreaterThan(0);
    expect(materials[0].sourceType).toBe("GITHUB_REPO");
  });

  it("GithubAdapter returns sample issue items for issue connector", async () => {
    const adapter = new GithubAdapter();
    const materials = await adapter.fetchItems(
      {
        id: "c2",
        type: SourceType.GITHUB_ISSUE,
        enabled: true,
        createdBy: "u1",
        configJson: { owner: "demo-org", repo: "transitionos", token: "" },
        createdAt: new Date()
      },
      demoTask
    );
    expect(materials.length).toBeGreaterThan(0);
    expect(materials[0].sourceType).toBe("GITHUB_ISSUE");
  });

  it("NotionAdapter returns sample pages when token is missing", async () => {
    const adapter = new NotionAdapter();
    const materials = await adapter.fetchItems(
      {
        id: "c3",
        type: SourceType.NOTION_PAGE,
        enabled: true,
        createdBy: "u1",
        configJson: { databaseId: "db", token: "" },
        createdAt: new Date()
      },
      demoTask
    );
    expect(materials.length).toBeGreaterThan(0);
    expect(materials[0].sourceType).toBe("NOTION_PAGE");
  });
});

