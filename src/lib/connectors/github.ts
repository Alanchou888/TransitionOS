import { SourceConnection, SourceType, TransitionTask } from "@prisma/client";
import type { SourceMaterial } from "@/lib/types";
import type { ConnectorAdapter, ConnectorFetchOptions } from "@/lib/connectors/base";

type GithubConfig = {
  owner?: string;
  repo?: string;
  token?: string;
};

async function fetchGithubJson(url: string, token?: string, repoRef?: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    cache: "no-store"
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : "unknown error";
    const scope = repoRef ? ` [${repoRef}]` : "";
    throw new Error(`GitHub API failed (${res.status})${scope}: ${message}`);
  }
  return payload;
}

function toConfig(raw: unknown): GithubConfig {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as GithubConfig;
}

function sampleRepoItems(task: TransitionTask): SourceMaterial[] {
  return [
    {
      sourceType: "GITHUB_REPO",
      sourceObjectId: "commit:demo-1",
      title: "Refactor billing service retry logic",
      url: "https://github.com/demo-org/transitionos/commit/demo-1",
      author: "employee@transitionos.local",
      createdAtSource: task.dateTo,
      rawContent: "Adjusted retry policy and added circuit-breaker fallback for billing sync.",
      metadata: { branch: "main" }
    },
    {
      sourceType: "GITHUB_REPO",
      sourceObjectId: "pr:42",
      title: "PR #42 - Improve onboarding checklist API stability",
      url: "https://github.com/demo-org/transitionos/pull/42",
      author: "employee@transitionos.local",
      createdAtSource: task.dateTo,
      rawContent: "Fixed race condition when checklist completion updates in parallel requests.",
      metadata: { branch: "main" }
    }
  ];
}

function sampleIssueItems(task: TransitionTask): SourceMaterial[] {
  return [
    {
      sourceType: "GITHUB_ISSUE",
      sourceObjectId: "issue:315",
      title: "Issue #315 - Missing citation in generated blockers section",
      url: "https://github.com/demo-org/transitionos/issues/315",
      author: "manager@transitionos.local",
      createdAtSource: task.dateTo,
      rawContent: "Blockers section occasionally contains no source links when source range is too narrow.",
      metadata: { labels: ["bug", "handover"] }
    }
  ];
}

export class GithubAdapter implements ConnectorAdapter {
  canHandle(connection: SourceConnection): boolean {
    return connection.type === SourceType.GITHUB_REPO || connection.type === SourceType.GITHUB_ISSUE;
  }

  async fetchItems(
    connection: SourceConnection,
    task: TransitionTask,
    options?: ConnectorFetchOptions
  ): Promise<SourceMaterial[]> {
    const config = toConfig(connection.configJson);
    const owner = config.owner;
    const repo = config.repo;
    const token = config.token;
    const branch = options?.filters?.branch?.trim();
    if (!owner || !repo || !token) {
      return connection.type === SourceType.GITHUB_ISSUE ? sampleIssueItems(task) : sampleRepoItems(task);
    }

    if (connection.type === SourceType.GITHUB_REPO) {
      const params = new URLSearchParams({
        since: task.dateFrom.toISOString(),
        until: task.dateTo.toISOString(),
        per_page: "20"
      });
      if (branch) {
        params.set("sha", branch);
      }
      const commits = (await fetchGithubJson(
        `https://api.github.com/repos/${owner}/${repo}/commits?${params.toString()}`,
        token,
        `${owner}/${repo}`
      )) as Array<Record<string, unknown>>;
      return commits.map((commit) => {
        const sha = String(commit.sha ?? "");
        const commitObj = (commit.commit ?? {}) as Record<string, unknown>;
        const message = String(commitObj.message ?? "");
        const authorObj = (commitObj.author ?? {}) as Record<string, unknown>;
        const authoredAt = authorObj.date ? new Date(String(authorObj.date)) : undefined;
        return {
          sourceType: "GITHUB_REPO",
          sourceObjectId: `commit:${sha}`,
          title: message.split("\n")[0] || `Commit ${sha.slice(0, 7)}`,
          url: String(commit.html_url ?? ""),
          author: String((authorObj.name as string) ?? ""),
          createdAtSource: authoredAt,
          rawContent: message,
          metadata: { sha, branch: branch ?? null }
        } satisfies SourceMaterial;
      });
    }

    const issues = (await fetchGithubJson(
      `https://api.github.com/repos/${owner}/${repo}/issues?since=${task.dateFrom.toISOString()}&state=all&per_page=20`,
      token,
      `${owner}/${repo}`
    )) as Array<Record<string, unknown>>;
    return issues
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        sourceType: "GITHUB_ISSUE",
        sourceObjectId: `issue:${String(issue.number ?? "")}`,
        title: String(issue.title ?? ""),
        url: String(issue.html_url ?? ""),
        author: String((issue.user as Record<string, unknown> | undefined)?.login ?? ""),
        createdAtSource: issue.created_at ? new Date(String(issue.created_at)) : undefined,
        rawContent: String(issue.body ?? ""),
        metadata: { state: issue.state, labels: issue.labels }
      }));
  }
}
