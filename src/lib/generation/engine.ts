import { OnboardingPack, SourceItem, TransitionTask } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  HANDOVER_SECTION_KEYS,
  ONBOARDING_SECTION_KEYS,
  type DocumentSection,
  type GeneratedDocument
} from "@/lib/types";
import { toMarkdown } from "@/lib/generation/markdown";
import { pickRelevantSources } from "@/lib/knowledge/retrieval";
import { createOpenAiJson, isOpenAiEnabled } from "@/lib/ai/openai";

type SectionPlan = {
  key: string;
  title: string;
  candidates: SourceItem[];
  needsHumanFill: boolean;
};

export type DocumentGenerationMode = "openai" | "retrieval";
export type OverallGenerationMode = DocumentGenerationMode | "mixed";

type LlmSection = {
  key: string;
  content: string;
};

type LlmDocument = {
  sections: LlmSection[];
};

const LLM_DOCUMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string" },
          content: { type: "string" }
        },
        required: ["key", "content"]
      }
    }
  },
  required: ["sections"]
} satisfies Record<string, unknown>;

function metaFrom(item: SourceItem): Record<string, unknown> {
  if (!item.metadataJson || typeof item.metadataJson !== "object") {
    return {};
  }
  return item.metadataJson as Record<string, unknown>;
}

function formatSnippet(item: SourceItem) {
  const sourceLabel = item.sourceType;
  const base = `- [${sourceLabel}] ${item.title}: ${item.rawContent.slice(0, 220)}`;
  const meta = metaFrom(item);
  const issueRefs = Array.isArray(meta.issueRefs) ? (meta.issueRefs as string[]) : [];
  const fileRefs = Array.isArray(meta.fileRefs) ? (meta.fileRefs as string[]) : [];
  const refs: string[] = [];
  if (issueRefs.length > 0) {
    refs.push(`issueRefs=${issueRefs.slice(0, 3).join(", ")}`);
  }
  if (fileRefs.length > 0) {
    refs.push(`fileRefs=${fileRefs.slice(0, 2).join(", ")}`);
  }
  return refs.length > 0 ? `${base} (${refs.join(" | ")})` : base;
}

function buildSectionContent(sectionTitle: string, sourceItems: SourceItem[]): string {
  const snippets = sourceItems.slice(0, 3).map((item) => formatSnippet(item));
  if (snippets.length === 0) {
    return `${sectionTitle} requires manual input because no source items were ingested.`;
  }
  return [
    "Auto-summarized from source material with time-weighted retrieval:",
    ...snippets
  ].join("\n");
}

function compactSourceForPrompt(item: SourceItem) {
  return {
    id: item.id,
    sourceType: item.sourceType,
    title: item.title,
    url: item.url,
    createdAtSource: item.createdAtSource?.toISOString() ?? null,
    rawContent: item.rawContent.slice(0, 1400)
  };
}

async function generateDocumentWithOpenAi(args: {
  docType: "handover" | "onboarding";
  task: TransitionTask;
  plans: SectionPlan[];
}): Promise<Map<string, string> | null> {
  if (!isOpenAiEnabled()) {
    return null;
  }
  const sectionsWithSources = args.plans.filter((plan) => plan.candidates.length > 0);
  if (sectionsWithSources.length === 0) {
    return null;
  }

  const system = [
    "You are an internal knowledge transfer analyst.",
    "Write concise, practical sections for enterprise handover/onboarding documents.",
    "Never fabricate facts beyond provided sources.",
    "If evidence is weak, explicitly note uncertainty."
  ].join(" ");

  const user = JSON.stringify(
    {
      documentType: args.docType,
      task: {
        id: args.task.id,
        targetRole: args.task.targetRole,
        dateFrom: args.task.dateFrom.toISOString(),
        dateTo: args.task.dateTo.toISOString()
      },
      instructions: [
        "Return only JSON that matches the schema.",
        "For each section, produce 2-5 sentences in markdown-ready plain text.",
        "Reference concrete facts from candidate sources but do not add fake links."
      ],
      sections: sectionsWithSources.map((section) => ({
        key: section.key,
        title: section.title,
        candidateSources: section.candidates.map(compactSourceForPrompt)
      }))
    },
    null,
    2
  );

  try {
    const output = await createOpenAiJson<LlmDocument>({
      system,
      user,
      schema: {
        name: `transitionos_${args.docType}_sections`,
        schema: LLM_DOCUMENT_SCHEMA
      },
      maxTokens: 2200
    });
    if (!output || !Array.isArray(output.sections)) {
      return null;
    }
    const keys = new Set(args.plans.map((plan) => plan.key));
    const mapped = new Map<string, string>();
    for (const section of output.sections) {
      if (!section || typeof section.key !== "string" || typeof section.content !== "string") {
        continue;
      }
      if (!keys.has(section.key)) {
        continue;
      }
      const content = section.content.trim();
      if (!content) {
        continue;
      }
      mapped.set(section.key, content);
    }
    return mapped.size > 0 ? mapped : null;
  } catch (error) {
    console.warn(
      `[TransitionOS] OpenAI ${args.docType} generation failed, fallback to retrieval template:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

async function mapSections(
  task: TransitionTask,
  keys: readonly string[],
  sourceItems: SourceItem[],
  titlePrefix: string,
  targetDate: Date,
  docType: "handover" | "onboarding"
): Promise<{ generated: GeneratedDocument; mode: DocumentGenerationMode }> {
  const plans: SectionPlan[] = keys.map((key, index) => {
    const candidates = pickRelevantSources(sourceItems, key, targetDate, 3);
    return {
      key,
      title: `${titlePrefix} ${index + 1}: ${key.replaceAll("_", " ")}`,
      candidates,
      needsHumanFill: candidates.length === 0
    };
  });

  const aiSections = await generateDocumentWithOpenAi({
    docType,
    task,
    plans
  });

  return {
    generated: {
      sections: plans.map((plan) => {
        const fallbackContent = buildSectionContent(plan.key, plan.candidates);
        const aiContent = aiSections?.get(plan.key);
        return {
          key: plan.key,
          title: plan.title,
          content: aiContent ?? fallbackContent,
          sourceItemIds: plan.candidates.map((item) => item.id),
          needsHumanFill: plan.needsHumanFill
        };
      })
    },
    mode: aiSections ? "openai" : "retrieval"
  };
}

function hasMissingCitations(document: GeneratedDocument): boolean {
  return document.sections.some((section) => section.sourceItemIds.length === 0);
}

async function createHandover(task: TransitionTask, sourceItems: SourceItem[]) {
  const latest = await prisma.handoverDraft.findFirst({
    where: { transitionTaskId: task.id },
    orderBy: { version: "desc" }
  });
  const version = (latest?.version ?? 0) + 1;
  const result = await mapSections(
    task,
    HANDOVER_SECTION_KEYS,
    sourceItems,
    "Handover",
    task.dateTo,
    "handover"
  );
  const generated = result.generated;

  const draft = await prisma.handoverDraft.create({
    data: {
      transitionTaskId: task.id,
      version,
      status: "IN_REVIEW",
      structuredJson: generated,
      contentMarkdown: toMarkdown(`Handover Draft v${version}`, generated)
    }
  });

  for (const section of generated.sections) {
    for (const sourceItemId of section.sourceItemIds) {
      await prisma.citation.create({
        data: {
          documentType: "handover",
          documentId: draft.id,
          sectionKey: section.key,
          sourceItemId,
          excerpt: "Auto-linked source reference",
          confidenceScore: 0.7,
          handoverDraftId: draft.id
        }
      });
    }
  }

  return { draft, generated, mode: result.mode };
}

async function createOnboarding(task: TransitionTask, sourceItems: SourceItem[]) {
  const latest = await prisma.onboardingPack.findFirst({
    where: { transitionTaskId: task.id },
    orderBy: { version: "desc" }
  });
  const version = (latest?.version ?? 0) + 1;
  const result = await mapSections(
    task,
    ONBOARDING_SECTION_KEYS,
    sourceItems,
    "Onboarding",
    task.dateTo,
    "onboarding"
  );
  const generated = result.generated;

  const pack = await prisma.onboardingPack.create({
    data: {
      transitionTaskId: task.id,
      version,
      status: "IN_REVIEW",
      structuredJson: generated,
      contentMarkdown: toMarkdown(`Onboarding Pack v${version}`, generated)
    }
  });

  for (const section of generated.sections) {
    for (const sourceItemId of section.sourceItemIds) {
      await prisma.citation.create({
        data: {
          documentType: "onboarding",
          documentId: pack.id,
          sectionKey: section.key,
          sourceItemId,
          excerpt: "Auto-linked source reference",
          confidenceScore: 0.7,
          onboardingPackId: pack.id
        }
      });
    }
  }

  const checklistSection = generated.sections.find((section) => section.key === "30_60_90_day_learning_checklist");
  const checklistContent = checklistSection?.content ?? "";
  const checklistSeed = [
    { section: "30-day", title: "Understand current project architecture", description: checklistContent },
    { section: "60-day", title: "Complete on-call shadowing", description: checklistContent },
    { section: "90-day", title: "Own one production release", description: checklistContent }
  ];
  for (const item of checklistSeed) {
    await prisma.checklistItem.create({
      data: {
        onboardingPackId: pack.id,
        section: item.section,
        title: item.title,
        description: item.description || "Auto-generated checklist item",
        priority: 2
      }
    });
  }

  return { pack, generated, mode: result.mode };
}

export async function generateDocumentsForTask(taskId: string) {
  const task = await prisma.transitionTask.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Task not found");
  }
  const sourceItems = await prisma.sourceItem.findMany({
    where: { transitionTaskId: task.id },
    orderBy: { createdAtSource: "desc" }
  });

  const handover = await createHandover(task, sourceItems);
  const onboarding = await createOnboarding(task, sourceItems);

  const hasCitationGap =
    hasMissingCitations(handover.generated) || hasMissingCitations(onboarding.generated);
  const generationMode: OverallGenerationMode =
    handover.mode === onboarding.mode ? handover.mode : "mixed";

  await prisma.transitionTask.update({
    where: { id: task.id },
    data: {
      status: "GENERATED"
    }
  });

  return {
    handoverDraftId: handover.draft.id,
    onboardingPackId: onboarding.pack.id,
    hasCitationGap,
    generationMode,
    handoverMode: handover.mode,
    onboardingMode: onboarding.mode
  };
}

function asDocumentSections(input: unknown): DocumentSection[] | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const sections = (input as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) {
    return null;
  }
  const parsed: DocumentSection[] = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") {
      return null;
    }
    const row = section as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key : null;
    const title = typeof row.title === "string" ? row.title : null;
    const content = typeof row.content === "string" ? row.content : null;
    const sourceItemIds = Array.isArray(row.sourceItemIds)
      ? row.sourceItemIds.filter((item): item is string => typeof item === "string")
      : null;
    if (!key || !title || !content || sourceItemIds === null) {
      return null;
    }
    parsed.push({
      key,
      title,
      content,
      sourceItemIds,
      needsHumanFill: typeof row.needsHumanFill === "boolean" ? row.needsHumanFill : undefined
    });
  }
  return parsed;
}

function mergeSectionInDocument(args: {
  base: GeneratedDocument;
  replacement: DocumentSection;
  orderedKeys: readonly string[];
}): GeneratedDocument {
  const byKey = new Map(args.base.sections.map((section) => [section.key, section]));
  byKey.set(args.replacement.key, args.replacement);
  const merged: DocumentSection[] = [];
  for (const key of args.orderedKeys) {
    const section = byKey.get(key);
    if (section) {
      merged.push(section);
    }
  }
  return { sections: merged };
}

export async function regenerateDocumentSectionForTask(args: {
  transitionTaskId: string;
  documentType: "handover" | "onboarding";
  sectionKey: string;
  baseDocument: unknown;
}): Promise<{
  generated: GeneratedDocument;
  section: DocumentSection;
  mode: DocumentGenerationMode;
}> {
  const task = await prisma.transitionTask.findUnique({
    where: { id: args.transitionTaskId }
  });
  if (!task) {
    throw new Error("Task not found");
  }
  const sourceItems = await prisma.sourceItem.findMany({
    where: { transitionTaskId: args.transitionTaskId },
    orderBy: { createdAtSource: "desc" }
  });

  const keys =
    args.documentType === "handover" ? HANDOVER_SECTION_KEYS : ONBOARDING_SECTION_KEYS;
  const titlePrefix = args.documentType === "handover" ? "Handover" : "Onboarding";
  const keyList = [...keys] as string[];
  if (!keyList.includes(args.sectionKey)) {
    throw new Error("Unknown section key");
  }

  const regeneration = await mapSections(
    task,
    keys,
    sourceItems,
    titlePrefix,
    task.dateTo,
    args.documentType
  );
  const nextSection = regeneration.generated.sections.find(
    (section) => section.key === args.sectionKey
  );
  if (!nextSection) {
    throw new Error("Failed to regenerate section");
  }

  const currentSections = asDocumentSections(args.baseDocument);
  const base: GeneratedDocument = currentSections
    ? { sections: currentSections }
    : regeneration.generated;
  const merged = mergeSectionInDocument({
    base,
    replacement: nextSection,
    orderedKeys: keys
  });

  return {
    generated: merged,
    section: nextSection,
    mode: regeneration.mode
  };
}

export function onboardingProgress(onboardingPack: OnboardingPack & { checklistItems: { completedAt: Date | null }[] }) {
  const total = onboardingPack.checklistItems.length;
  if (total === 0) {
    return 0;
  }
  const done = onboardingPack.checklistItems.filter((item) => Boolean(item.completedAt)).length;
  return Math.round((done / total) * 100);
}
