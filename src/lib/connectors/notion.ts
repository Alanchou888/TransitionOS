import { SourceConnection, SourceType, TransitionTask } from "@prisma/client";
import type { SourceMaterial } from "@/lib/types";
import type { ConnectorAdapter, ConnectorFetchOptions } from "@/lib/connectors/base";

type NotionConfig = {
  databaseId?: string;
  token?: string;
};

function toConfig(raw: unknown): NotionConfig {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as NotionConfig;
}

async function notionQueryDatabase(databaseId: string, token: string) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    body: JSON.stringify({ page_size: 20 }),
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Notion API failed (${res.status})`);
  }
  return res.json();
}

function sampleNotionItems(task: TransitionTask): SourceMaterial[] {
  return [
    {
      sourceType: "NOTION_PAGE",
      sourceObjectId: "notion:runbook-001",
      title: "On-call runbook: incident triage",
      url: "https://www.notion.so/demo/runbook-001",
      author: "mentor@transitionos.local",
      createdAtSource: task.dateTo,
      rawContent: "Triage severity first, then map service owner, then notify manager with issue link.",
      metadata: { tags: ["runbook", "operations"] }
    },
    {
      sourceType: "NOTION_PAGE",
      sourceObjectId: "notion:sop-002",
      title: "Deployment SOP",
      url: "https://www.notion.so/demo/sop-002",
      author: "admin@transitionos.local",
      createdAtSource: task.dateTo,
      rawContent: "Deploy via CI pipeline, verify health endpoint, monitor logs for 15 minutes.",
      metadata: { tags: ["sop", "deployment"] }
    }
  ];
}

export class NotionAdapter implements ConnectorAdapter {
  canHandle(connection: SourceConnection): boolean {
    return connection.type === SourceType.NOTION_PAGE;
  }

  async fetchItems(
    connection: SourceConnection,
    task: TransitionTask,
    _options?: ConnectorFetchOptions
  ): Promise<SourceMaterial[]> {
    const config = toConfig(connection.configJson);
    if (!config.databaseId || !config.token) {
      return sampleNotionItems(task);
    }
    const result = (await notionQueryDatabase(config.databaseId, config.token)) as Record<string, unknown>;
    const pages = (result.results as Array<Record<string, unknown>> | undefined) ?? [];
    return pages.map((page) => {
      const properties = (page.properties as Record<string, unknown> | undefined) ?? {};
      const titleProp = (properties.Name as Record<string, unknown> | undefined)?.title as
        | Array<Record<string, unknown>>
        | undefined;
      const title =
        titleProp?.[0] && (titleProp[0].plain_text as string | undefined)
          ? (titleProp[0].plain_text as string)
          : "Untitled page";
      return {
        sourceType: "NOTION_PAGE",
        sourceObjectId: `notion:${String(page.id ?? "")}`,
        title,
        url: String(page.url ?? ""),
        createdAtSource: page.created_time ? new Date(String(page.created_time)) : undefined,
        author: undefined,
        rawContent: JSON.stringify(properties),
        metadata: { icon: page.icon, archived: page.archived }
      } satisfies SourceMaterial;
    });
  }
}
