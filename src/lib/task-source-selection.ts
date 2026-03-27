import { z } from "zod";

const filtersSchema = z
  .object({
    branch: z.string().trim().min(1).optional(),
    author: z.string().trim().min(1).optional(),
    labels: z.array(z.string().trim().min(1)).optional(),
    keywords: z.array(z.string().trim().min(1)).optional()
  })
  .partial();

const selectionObjectSchema = z.object({
  connectionIds: z.array(z.string().min(1)).default([]),
  filters: filtersSchema.optional()
});

export type SourceFilters = z.infer<typeof filtersSchema>;

export type ParsedSourceSelection = {
  connectionIds: string[];
  filters: SourceFilters;
};

function normalizeFilters(input: SourceFilters | undefined): SourceFilters {
  const labels = (input?.labels ?? []).filter((entry) => entry.trim().length > 0);
  const keywords = (input?.keywords ?? []).filter((entry) => entry.trim().length > 0);
  return {
    ...(input?.branch ? { branch: input.branch.trim() } : {}),
    ...(input?.author ? { author: input.author.trim() } : {}),
    ...(labels.length > 0 ? { labels } : {}),
    ...(keywords.length > 0 ? { keywords } : {})
  };
}

export function parseTaskSourceSelection(raw: unknown): ParsedSourceSelection {
  if (Array.isArray(raw)) {
    const ids = raw.filter((value): value is string => typeof value === "string" && value.length > 0);
    return {
      connectionIds: ids,
      filters: {}
    };
  }
  const parsed = selectionObjectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      connectionIds: [],
      filters: {}
    };
  }
  return {
    connectionIds: parsed.data.connectionIds,
    filters: normalizeFilters(parsed.data.filters)
  };
}

export function buildTaskSourceSelection(input: {
  connectionIds: string[];
  filters?: SourceFilters;
}) {
  return {
    connectionIds: input.connectionIds,
    filters: normalizeFilters(input.filters)
  };
}
