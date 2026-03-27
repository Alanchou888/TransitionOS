import { SourceConnection, TransitionTask } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GithubAdapter } from "@/lib/connectors/github";
import { NotionAdapter } from "@/lib/connectors/notion";
import { SlackAdapter } from "@/lib/connectors/slack";
import { JiraAdapter } from "@/lib/connectors/jira";
import type { SourceMaterial } from "@/lib/types";
import type { ConnectorAdapter } from "@/lib/connectors/base";
import { redactPII } from "@/lib/knowledge/redaction";
import { extractDecisionStitchMeta } from "@/lib/knowledge/decision-stitch";
import { parseTaskSourceSelection } from "@/lib/task-source-selection";
import { applySourceFilters } from "@/lib/connectors/filter";

export const connectorAdapters: ConnectorAdapter[] = [
  new GithubAdapter(),
  new NotionAdapter(),
  new SlackAdapter(),
  new JiraAdapter()
];

export function resolveConnectorAdapter(connection: SourceConnection) {
  return connectorAdapters.find((entry) => entry.canHandle(connection));
}

export async function ingestSourcesForTask(taskId: string): Promise<{
  imported: number;
  warnings: string[];
}> {
  const task = await prisma.transitionTask.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Task not found");
  }

  const sourceSelection = parseTaskSourceSelection(task.sourceSelection);
  const allConnections = await prisma.sourceConnection.findMany({ where: { enabled: true } });
  const selectedConnections = sourceSelection.connectionIds.length > 0
    ? allConnections.filter((connection) => sourceSelection.connectionIds.includes(connection.id))
    : allConnections;

  let imported = 0;
  const warnings: string[] = [];
  let redactionCount = 0;

  await prisma.sourceItem.deleteMany({ where: { transitionTaskId: taskId } });

  for (const connection of selectedConnections) {
    const adapter = resolveConnectorAdapter(connection);
    if (!adapter) {
      warnings.push(`No adapter for source ${connection.type}`);
      continue;
    }
    try {
      const materials = await adapter.fetchItems(connection, task, {
        filters: sourceSelection.filters
      });
      const filteredMaterials = applySourceFilters(materials, sourceSelection.filters);
      for (const item of filteredMaterials) {
        const redaction = redactPII(item.rawContent);
        if (redaction.redactedFields.length > 0) {
          redactionCount += redaction.redactedFields.length;
        }
        const stitchMeta = extractDecisionStitchMeta(redaction.text);
        await prisma.sourceItem.create({
          data: {
            transitionTaskId: taskId,
            sourceType: item.sourceType,
            sourceObjectId: item.sourceObjectId,
            title: item.title,
            url: item.url,
            author: item.author,
            createdAtSource: item.createdAtSource,
            rawContent: redaction.text,
            metadataJson: {
              ...item.metadata,
              redactedFields: redaction.redactedFields,
              ...stitchMeta
            }
          }
        });
        imported += 1;
      }
      if (materials.length > filteredMaterials.length) {
        warnings.push(
          `[${connection.type}] ${materials.length - filteredMaterials.length} items skipped by source filters.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown adapter error";
      warnings.push(`[${connection.type}] ${message}`);
    }
  }

  if (redactionCount > 0) {
    warnings.push(`PII redaction applied to ${redactionCount} field matches.`);
  }

  return { imported, warnings };
}
