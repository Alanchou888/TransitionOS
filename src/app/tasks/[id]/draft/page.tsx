import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RunTaskButton } from "@/components/run-task-button";
import { EditMarkdownForm } from "@/components/edit-markdown-form";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { getPrincipalFromCookies } from "@/lib/auth";
import { canApprove, canEditHandover, canRunGeneration } from "@/lib/permissions";
import { SectionRegeneratePanel } from "@/components/section-regenerate-panel";
import type { DocumentSection } from "@/lib/types";

function asSections(input: unknown): DocumentSection[] {
  if (!input || typeof input !== "object") {
    return [];
  }
  const sections = (input as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) {
    return [];
  }
  return sections
    .filter((section): section is Record<string, unknown> => Boolean(section && typeof section === "object"))
    .map((section) => ({
      key: typeof section.key === "string" ? section.key : "unknown",
      title: typeof section.title === "string" ? section.title : "Untitled",
      content: typeof section.content === "string" ? section.content : "",
      sourceItemIds: Array.isArray(section.sourceItemIds)
        ? section.sourceItemIds.filter((id): id is string => typeof id === "string")
        : [],
      needsHumanFill: typeof section.needsHumanFill === "boolean" ? section.needsHumanFill : undefined
    }))
    .filter((section) => section.key !== "unknown");
}

function preview(value: string, size = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= size) {
    return compact;
  }
  return `${compact.slice(0, size)}...`;
}

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await getPrincipalFromCookies();
  const resolvedParams = await params;
  const task = await prisma.transitionTask.findUnique({
    where: { id: resolvedParams.id },
    include: {
      handoverDrafts: { orderBy: { version: "desc" }, take: 2 },
      jobs: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });
  if (!task) {
    notFound();
  }

  const draft = task.handoverDrafts[0];
  const previousDraft = task.handoverDrafts[1];
  const citations = draft
    ? await prisma.citation.findMany({
        where: { handoverDraftId: draft.id },
        include: { sourceItem: true },
        orderBy: [{ sectionKey: "asc" }, { createdAt: "asc" }]
      })
    : [];
  const groupedCitations = citations.reduce(
    (acc, citation) => {
      const key = citation.sectionKey;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(citation);
      return acc;
    },
    {} as Record<string, typeof citations>
  );

  const latestGenerationLog = await prisma.auditLog.findFirst({
    where: {
      transitionTaskId: task.id,
      action: "TASK_GENERATED"
    },
    orderBy: { createdAt: "desc" }
  });
  const details = (latestGenerationLog?.detailsJson ?? {}) as {
    warnings?: string[];
    generationMode?: string;
    handoverMode?: string;
    onboardingMode?: string;
  };
  const warnings = Array.isArray(details.warnings) ? details.warnings : [];
  const generationMode = typeof details.generationMode === "string" ? details.generationMode : "unknown";
  const handoverMode = typeof details.handoverMode === "string" ? details.handoverMode : "unknown";
  const onboardingMode = typeof details.onboardingMode === "string" ? details.onboardingMode : "unknown";

  const sections = draft ? asSections(draft.structuredJson) : [];
  const previousSections = previousDraft ? asSections(previousDraft.structuredJson) : [];
  const previousByKey = new Map(previousSections.map((section) => [section.key, section]));
  const changedSections = sections
    .map((section) => {
      const prev = previousByKey.get(section.key);
      if (!prev) {
        return { section, prev: null };
      }
      if (prev.content === section.content) {
        return null;
      }
      return { section, prev };
    })
    .filter((entry): entry is { section: DocumentSection; prev: DocumentSection | null } => Boolean(entry));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Draft Review</h1>
          <p className="text-sm text-slate-600">Task {task.id}</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Generation</h2>
        {principal && canRunGeneration(principal.role) ? (
          <RunTaskButton taskId={task.id} />
        ) : (
          <p className="text-sm text-slate-500">You do not have permission to run generation.</p>
        )}
        <div className="text-sm text-slate-600">
          Latest jobs:{" "}
          {task.jobs.map((job) => `${job.status} (${job.updatedAt.toISOString()})`).join(" | ") || "none"}
        </div>
        <p className="text-sm text-slate-600">
          Latest generation mode: <span className="font-medium">{generationMode}</span> (handover: {handoverMode},
          onboarding: {onboardingMode})
        </p>
        {warnings.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Ingestion warnings</p>
            <ul className="mt-1 list-disc pl-5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Handover Draft {draft ? `(v${draft.version})` : ""}
        </h2>
        {draft && principal && canEditHandover(principal.role) ? (
          <EditMarkdownForm patchUrl={`/api/handover-drafts/${draft.id}`} initialValue={draft.contentMarkdown} />
        ) : draft ? (
          <pre className="whitespace-pre-wrap rounded-md bg-slate-100 p-3 text-xs text-slate-800">
            {draft.contentMarkdown}
          </pre>
        ) : (
          <p className="text-sm text-slate-600">No draft generated yet. Click Generate / Refresh first.</p>
        )}
      </div>

      {draft ? (
        <div className="card space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Section Regeneration</h2>
          <SectionRegeneratePanel
            endpoint={`/api/handover-drafts/${draft.id}/regenerate-section`}
            sections={sections.map((section) => ({
              key: section.key,
              title: section.title,
              needsHumanFill: section.needsHumanFill
            }))}
            canRegenerate={principal ? canEditHandover(principal.role) : false}
          />
        </div>
      ) : null}

      <div className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Citations by Section</h2>
        {Object.keys(groupedCitations).length === 0 ? (
          <p className="text-sm text-slate-600">No citations available yet.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedCitations).map(([sectionKey, items]) => (
              <div key={sectionKey} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{sectionKey}</p>
                <ul className="mt-2 space-y-2 text-xs text-slate-700">
                  {items.map((citation) => (
                    <li key={citation.id} className="rounded bg-slate-50 p-2">
                      <p className="font-medium">{citation.sourceItem.title}</p>
                      <p>Source ID: {citation.sourceItemId}</p>
                      <p>Author: {citation.sourceItem.author ?? "unknown"}</p>
                      <p>Confidence: {citation.confidenceScore ?? "-"}</p>
                      {citation.sourceItem.url ? (
                        <a
                          href={citation.sourceItem.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 underline"
                        >
                          Open source link
                        </a>
                      ) : (
                        <p>No URL</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Version Diff</h2>
        {!draft || !previousDraft ? (
          <p className="text-sm text-slate-600">Need at least two draft versions to show differences.</p>
        ) : changedSections.length === 0 ? (
          <p className="text-sm text-slate-600">No section content changes detected between latest two versions.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {changedSections.map(({ section, prev }) => (
              <div key={section.key} className="rounded-md border border-slate-200 p-3">
                <p className="font-medium text-slate-900">{section.title}</p>
                <p className="text-xs text-slate-500">key: {section.key}</p>
                <p className="mt-1 text-xs text-slate-600">Previous: {preview(prev?.content ?? "(new section)")}</p>
                <p className="mt-1 text-xs text-slate-900">Latest: {preview(section.content)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 text-sm">
        <Link href={`/tasks/${task.id}/onboarding`}>Go to Onboarding Pack</Link>
        {principal && canApprove(principal.role) ? <Link href={`/tasks/${task.id}/approval`}>Go to Approval</Link> : null}
        <Link href={`/tasks/${task.id}/timeline`}>Timeline</Link>
        <Link href={`/tasks/${task.id}/ghost-chat`}>Ghost Chat</Link>
      </div>
    </div>
  );
}
