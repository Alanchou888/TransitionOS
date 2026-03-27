import type { SourceItem } from "@prisma/client";
import type { SourceMaterial } from "@/lib/types";
import type { SourceFilters } from "@/lib/task-source-selection";

function toWords(input: string): string[] {
  return input
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeFilterList(list: string[] | undefined): string[] {
  if (!list) {
    return [];
  }
  const expanded = list.flatMap((entry) => toWords(entry));
  return expanded.map((entry) => entry.toLowerCase());
}

function toMetadataObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function extractLabels(metadata: Record<string, unknown>): string[] {
  const labels = metadata.labels;
  if (!Array.isArray(labels)) {
    return [];
  }
  return labels
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        if (typeof obj.name === "string") {
          return obj.name;
        }
      }
      return "";
    })
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());
}

function containsAny(haystack: string, needles: string[]): boolean {
  if (needles.length === 0) {
    return true;
  }
  return needles.some((needle) => haystack.includes(needle));
}

export function applySourceFilters<T extends SourceMaterial | SourceItem>(items: T[], filters: SourceFilters): T[] {
  const authorFilter = filters.author?.toLowerCase().trim();
  const branchFilter = filters.branch?.toLowerCase().trim();
  const labelFilter = normalizeFilterList(filters.labels);
  const keywordFilter = normalizeFilterList(filters.keywords);

  return items.filter((item) => {
    const author = (item.author ?? "").toLowerCase();
    if (authorFilter && !author.includes(authorFilter)) {
      return false;
    }

    const metadata = toMetadataObject((item as SourceMaterial).metadata ?? (item as SourceItem).metadataJson);
    if (branchFilter) {
      const branch = typeof metadata.branch === "string" ? metadata.branch.toLowerCase() : "";
      if (!branch.includes(branchFilter)) {
        return false;
      }
    }

    if (labelFilter.length > 0) {
      const labels = extractLabels(metadata);
      const matched = labelFilter.some((needle) => labels.some((label) => label.includes(needle)));
      if (!matched) {
        return false;
      }
    }

    if (keywordFilter.length > 0) {
      const text = `${item.title}\n${item.rawContent}`.toLowerCase();
      if (!containsAny(text, keywordFilter)) {
        return false;
      }
    }

    return true;
  });
}
