import { describe, expect, it } from "vitest";
import { SourceType } from "@prisma/client";
import {
  SECRET_MASK,
  maskSourceConfig,
  mergeSecretConfigWithExisting
} from "@/lib/source-secrets";

describe("source secret helpers", () => {
  it("masks configured token fields for display", () => {
    const masked = maskSourceConfig(SourceType.GITHUB_REPO, {
      owner: "alan",
      repo: "meet-flow",
      token: "ghp_real_secret_token"
    });
    expect(masked.token).toBe(SECRET_MASK);
    expect(masked.owner).toBe("alan");
  });

  it("preserves existing secret when masked placeholder is submitted", () => {
    const merged = mergeSecretConfigWithExisting({
      type: SourceType.NOTION_PAGE,
      incoming: { databaseId: "db-1", token: SECRET_MASK },
      existing: { databaseId: "db-1", token: "secret_real_value" }
    });
    expect(merged.token).toBe("secret_real_value");
  });

  it("replaces existing secret when new value is provided", () => {
    const merged = mergeSecretConfigWithExisting({
      type: SourceType.JIRA_ISSUE,
      incoming: { baseUrl: "https://example.atlassian.net", email: "a@b.com", apiToken: "new_token" },
      existing: { baseUrl: "https://example.atlassian.net", email: "a@b.com", apiToken: "old_token" }
    });
    expect(merged.apiToken).toBe("new_token");
  });
});
