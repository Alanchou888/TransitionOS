import { SourceConnection, TransitionTask } from "@prisma/client";
import type { SourceMaterial } from "@/lib/types";
import type { SourceFilters } from "@/lib/task-source-selection";

export type ConnectorFetchOptions = {
  filters?: SourceFilters;
};

export interface ConnectorAdapter {
  canHandle(connection: SourceConnection): boolean;
  fetchItems(
    connection: SourceConnection,
    task: TransitionTask,
    options?: ConnectorFetchOptions
  ): Promise<SourceMaterial[]>;
}

export function withinDateRange(value: Date | undefined, from: Date, to: Date) {
  if (!value) {
    return true;
  }
  return value >= from && value <= to;
}
