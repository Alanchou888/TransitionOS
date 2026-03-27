import { SourceConnection, SourceType, TransitionTask } from "@prisma/client";
import type { SourceMaterial } from "@/lib/types";
import type { ConnectorAdapter, ConnectorFetchOptions } from "@/lib/connectors/base";

type SlackConfig = {
  token?: string;
  channels?: string[];
  workspaceDomain?: string;
};

function toConfig(raw: unknown): SlackConfig {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as SlackConfig;
}

function sampleSlackItems(task: TransitionTask): SourceMaterial[] {
  return [
    {
      sourceType: "SLACK_MESSAGE",
      sourceObjectId: "slack:C123:1731420000.1234",
      title: "Caching strategy discussion",
      url: "https://example.slack.com/archives/C123/p1731420000123400",
      author: "platform-team",
      createdAtSource: task.dateTo,
      rawContent:
        "We rejected approach A because cold-start latency spiked to 1.5s. Chose approach B with pre-warm worker.",
      metadata: {
        channel: "arch-discussion",
        thread: true,
        participants: ["platform-team", "backend-team"]
      }
    }
  ];
}

async function fetchSlackHistory(token: string, channel: string) {
  const params = new URLSearchParams({
    channel,
    limit: "30"
  });
  const res = await fetch(`https://slack.com/api/conversations.history?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Slack API failed (${res.status})`);
  }
  const payload = (await res.json()) as Record<string, unknown>;
  if (!payload.ok) {
    throw new Error(`Slack API error: ${String(payload.error ?? "unknown")}`);
  }
  return (payload.messages as Array<Record<string, unknown>>) ?? [];
}

export class SlackAdapter implements ConnectorAdapter {
  canHandle(connection: SourceConnection): boolean {
    return connection.type === SourceType.SLACK_MESSAGE;
  }

  async fetchItems(
    connection: SourceConnection,
    task: TransitionTask,
    _options?: ConnectorFetchOptions
  ): Promise<SourceMaterial[]> {
    const config = toConfig(connection.configJson);
    const token = config.token?.trim();
    const channels = (config.channels ?? []).filter(Boolean);

    if (!token || channels.length === 0) {
      return sampleSlackItems(task);
    }

    const materials: SourceMaterial[] = [];
    for (const channel of channels) {
      if (channel.startsWith("D")) {
        continue;
      }
      const messages = await fetchSlackHistory(token, channel);
      for (const message of messages) {
        const text = String(message.text ?? "").trim();
        if (!text) {
          continue;
        }
        const ts = String(message.ts ?? "");
        const createdAtSource = ts ? new Date(Number(ts.split(".")[0]) * 1000) : undefined;
        if (createdAtSource && (createdAtSource < task.dateFrom || createdAtSource > task.dateTo)) {
          continue;
        }
        materials.push({
          sourceType: "SLACK_MESSAGE",
          sourceObjectId: `slack:${channel}:${ts}`,
          title: text.slice(0, 80),
          url:
            config.workspaceDomain && ts
              ? `https://${config.workspaceDomain}.slack.com/archives/${channel}/p${ts.replace(".", "")}`
              : undefined,
          author: String(message.user ?? "unknown"),
          createdAtSource,
          rawContent: text,
          metadata: {
            channel,
            threadTs: message.thread_ts ?? null,
            subtype: message.subtype ?? null
          }
        });
      }
    }
    return materials;
  }
}
