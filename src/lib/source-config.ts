import { SourceType } from "@prisma/client";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isGithubSlug(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function validateAndNormalizeSourceConfig(type: SourceType, config: Record<string, unknown>) {
  if (type === SourceType.GITHUB_REPO || type === SourceType.GITHUB_ISSUE) {
    const owner = asTrimmedString(config.owner);
    const repo = asTrimmedString(config.repo);
    const token = asTrimmedString(config.token);

    if (!owner || !repo || !token) {
      return { error: "GitHub config requires non-empty owner, repo, and token." as const };
    }
    if (isHttpUrl(repo)) {
      return {
        error:
          "GitHub repo must be only repository name (e.g. 'meet-flow'), not full URL." as const
      };
    }
    if (repo.includes("/")) {
      return { error: "GitHub repo should not contain '/'." as const };
    }
    if (!isGithubSlug(owner) || !isGithubSlug(repo)) {
      return {
        error:
          "GitHub owner/repo may only include letters, numbers, dot, underscore, and hyphen." as const
      };
    }

    return {
      normalizedConfig: { owner, repo, token } as Record<string, unknown>
    };
  }

  if (type === SourceType.NOTION_PAGE) {
    const databaseId = asTrimmedString(config.databaseId);
    const token = asTrimmedString(config.token);
    if (!databaseId || !token) {
      return { error: "Notion config requires non-empty databaseId and token." as const };
    }
    return {
      normalizedConfig: { databaseId, token } as Record<string, unknown>
    };
  }

  if (type === SourceType.SLACK_MESSAGE) {
    const token = asTrimmedString(config.token);
    const workspaceDomain = asTrimmedString(config.workspaceDomain);
    const channelsRaw = Array.isArray(config.channels) ? config.channels : [];
    const channels = channelsRaw
      .map((value) => asTrimmedString(value))
      .filter((value) => value.length > 0 && !value.startsWith("D"));

    if (!token || channels.length === 0) {
      return {
        error:
          "Slack config requires non-empty token and channels array (channel IDs only, no DMs)." as const
      };
    }

    return {
      normalizedConfig: { token, channels, workspaceDomain } as Record<string, unknown>
    };
  }

  if (type === SourceType.JIRA_ISSUE) {
    const baseUrl = asTrimmedString(config.baseUrl);
    const email = asTrimmedString(config.email);
    const apiToken = asTrimmedString(config.apiToken);
    const jql = asTrimmedString(config.jql) || "ORDER BY updated DESC";
    if (!baseUrl || !email || !apiToken) {
      return {
        error: "Jira config requires non-empty baseUrl, email, and apiToken." as const
      };
    }
    if (!isHttpUrl(baseUrl)) {
      return { error: "Jira baseUrl must start with http:// or https://." as const };
    }
    return {
      normalizedConfig: { baseUrl, email, apiToken, jql } as Record<string, unknown>
    };
  }

  return { normalizedConfig: config };
}
