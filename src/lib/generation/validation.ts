export function hasMissingCitationSections(document: unknown): boolean {
  if (!document || typeof document !== "object") {
    return true;
  }
  const sections = (document as { sections?: Array<{ sourceItemIds?: string[] }> }).sections;
  if (!sections || sections.length === 0) {
    return true;
  }
  return sections.some((section) => !section.sourceItemIds || section.sourceItemIds.length === 0);
}

export function hasNeedsHumanFillSections(document: unknown): boolean {
  if (!document || typeof document !== "object") {
    return true;
  }
  const sections = (document as { sections?: Array<{ needsHumanFill?: boolean }> }).sections;
  if (!sections || sections.length === 0) {
    return true;
  }
  return sections.some((section) => section.needsHumanFill === true);
}

export function listMissingCitationSections(document: unknown): string[] {
  if (!document || typeof document !== "object") {
    return [];
  }
  const sections = (document as { sections?: Array<{ key?: string; sourceItemIds?: string[] }> }).sections;
  if (!sections || sections.length === 0) {
    return [];
  }
  return sections
    .filter((section) => !section.sourceItemIds || section.sourceItemIds.length === 0)
    .map((section) => section.key)
    .filter((key): key is string => typeof key === "string");
}

export function listNeedsHumanFillSections(document: unknown): string[] {
  if (!document || typeof document !== "object") {
    return [];
  }
  const sections = (document as { sections?: Array<{ key?: string; needsHumanFill?: boolean }> }).sections;
  if (!sections || sections.length === 0) {
    return [];
  }
  return sections
    .filter((section) => section.needsHumanFill === true)
    .map((section) => section.key)
    .filter((key): key is string => typeof key === "string");
}
