import { SourceConnection, SourceType, TransitionTask } from "@prisma/client";
import type { SourceMaterial } from "@/lib/types";
import type { ConnectorAdapter, ConnectorFetchOptions } from "@/lib/connectors/base";

type JiraConfig = {
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  jql?: string;
};

function toConfig(raw: unknown): JiraConfig {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as JiraConfig;
}

function sampleJiraItems(task: TransitionTask): SourceMaterial[] {
  return [
    {
      sourceType: "JIRA_ISSUE",
      sourceObjectId: "jira:DEMO-42",
      title: "DEMO-42: Stabilize onboarding sync job",
      url: "https://example.atlassian.net/browse/DEMO-42",
      author: "manager@transitionos.local",
      createdAtSource: task.dateTo,
      rawContent:
        "Issue tracked race condition in checklist completion endpoint. Fix deployed with idempotency guard.",
      metadata: {
        status: "Done",
        priority: "High"
      }
    }
  ];
}

async function fetchJiraIssues(config: JiraConfig) {
  const encodedAuth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const body = {
    jql: config.jql ?? "ORDER BY updated DESC",
    maxResults: 25,
    fields: ["summary", "description", "priority", "status", "assignee", "updated"]
  };
  const res = await fetch(`${config.baseUrl}/rest/api/3/search`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedAuth}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Jira API failed (${res.status})`);
  }
  const payload = (await res.json()) as Record<string, unknown>;
  return (payload.issues as Array<Record<string, unknown>>) ?? [];
}

export class JiraAdapter implements ConnectorAdapter {
  canHandle(connection: SourceConnection): boolean {
    return connection.type === SourceType.JIRA_ISSUE;
  }

  async fetchItems(
    connection: SourceConnection,
    task: TransitionTask,
    _options?: ConnectorFetchOptions
  ): Promise<SourceMaterial[]> {
    const config = toConfig(connection.configJson);
    if (!config.baseUrl || !config.email || !config.apiToken) {
      return sampleJiraItems(task);
    }
    const issues = await fetchJiraIssues(config);
    const materials: SourceMaterial[] = [];
    for (const issue of issues) {
      const fields = (issue.fields as Record<string, unknown> | undefined) ?? {};
      const updated = fields.updated ? new Date(String(fields.updated)) : undefined;
      if (updated && (updated < task.dateFrom || updated > task.dateTo)) {
        continue;
      }
      const key = String(issue.key ?? "");
      const summary = String(fields.summary ?? key);
      const descObj = fields.description as Record<string, unknown> | undefined;
      const descText = JSON.stringify(descObj ?? {});
      materials.push({
        sourceType: "JIRA_ISSUE",
        sourceObjectId: `jira:${key}`,
        title: `${key}: ${summary}`,
        url: `${config.baseUrl}/browse/${key}`,
        author: String((fields.assignee as Record<string, unknown> | undefined)?.displayName ?? "unknown"),
        createdAtSource: updated,
        rawContent: descText,
        metadata: {
          status: (fields.status as Record<string, unknown> | undefined)?.name ?? null,
          priority: (fields.priority as Record<string, unknown> | undefined)?.name ?? null
        }
      });
    }
    return materials;
  }
}
