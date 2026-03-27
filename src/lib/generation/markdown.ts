import type { GeneratedDocument } from "@/lib/types";

export function toMarkdown(documentTitle: string, generated: GeneratedDocument): string {
  const lines: string[] = [`# ${documentTitle}`, ""];
  for (const section of generated.sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
    const citationLine = section.sourceItemIds.length
      ? `Sources: ${section.sourceItemIds.map((id) => `\`${id}\``).join(", ")}`
      : "Sources: none";
    lines.push(citationLine);
    lines.push("");
  }
  return lines.join("\n");
}

