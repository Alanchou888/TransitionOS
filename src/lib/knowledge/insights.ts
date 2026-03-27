import type { SourceItem } from "@prisma/client";

export type TimelineEntry = {
  id: string;
  date: string;
  title: string;
  sourceType: string;
  url: string | null;
  author: string | null;
};

export type HotspotEntry = {
  key: string;
  score: number;
  reasons: string[];
};

export type GraphNode = {
  id: string;
  label: string;
  type: "person" | "artifact" | "issue";
};

export type GraphEdge = {
  from: string;
  to: string;
  label: string;
};

function toMeta(item: SourceItem): Record<string, unknown> {
  if (!item.metadataJson || typeof item.metadataJson !== "object") {
    return {};
  }
  return item.metadataJson as Record<string, unknown>;
}

export function buildTimeline(sourceItems: SourceItem[]): TimelineEntry[] {
  return sourceItems
    .map((item) => ({
      id: item.id,
      date: (item.createdAtSource ?? new Date()).toISOString(),
      title: item.title,
      sourceType: item.sourceType,
      url: item.url,
      author: item.author
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function buildHotspots(sourceItems: SourceItem[]): HotspotEntry[] {
  const scoreMap = new Map<string, { score: number; reasons: string[] }>();

  for (const item of sourceItems) {
    const meta = toMeta(item);
    const key = String(meta.filePath ?? item.sourceObjectId ?? item.title);
    const record = scoreMap.get(key) ?? { score: 0, reasons: [] };
    record.score += 1;
    record.reasons.push(`${item.sourceType}:${item.title}`);
    scoreMap.set(key, record);

    const issueRefs = Array.isArray(meta.issueRefs) ? (meta.issueRefs as string[]) : [];
    for (const ref of issueRefs) {
      const issueKey = `issue:${ref}`;
      const issueRecord = scoreMap.get(issueKey) ?? { score: 0, reasons: [] };
      issueRecord.score += 1.2;
      issueRecord.reasons.push(`Referenced by ${item.title}`);
      scoreMap.set(issueKey, issueRecord);
    }
  }

  return [...scoreMap.entries()]
    .map(([key, value]) => ({
      key,
      score: Number(value.score.toFixed(2)),
      reasons: value.reasons.slice(0, 5)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

export function buildKnowledgeGraph(sourceItems: SourceItem[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  function ensureNode(node: GraphNode) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
  }

  for (const item of sourceItems) {
    const artifactNode: GraphNode = {
      id: `artifact:${item.id}`,
      label: item.title,
      type: "artifact"
    };
    ensureNode(artifactNode);

    if (item.author) {
      const personNode: GraphNode = {
        id: `person:${item.author}`,
        label: item.author,
        type: "person"
      };
      ensureNode(personNode);
      edges.push({ from: personNode.id, to: artifactNode.id, label: "authored" });
    }

    const meta = toMeta(item);
    const issueRefs = Array.isArray(meta.issueRefs) ? (meta.issueRefs as string[]) : [];
    for (const ref of issueRefs) {
      const issueNode: GraphNode = {
        id: `issue:${ref}`,
        label: ref,
        type: "issue"
      };
      ensureNode(issueNode);
      edges.push({ from: artifactNode.id, to: issueNode.id, label: "references" });
    }
  }

  return { nodes: [...nodeMap.values()], edges };
}
