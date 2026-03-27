import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditMarkdownForm } from "@/components/edit-markdown-form";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { getPrincipalFromCookies } from "@/lib/auth";
import { canApprove, canEditOnboarding } from "@/lib/permissions";
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

export default async function OnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await getPrincipalFromCookies();
  const resolvedParams = await params;
  const task = await prisma.transitionTask.findUnique({
    where: { id: resolvedParams.id },
    include: {
      onboardingPacks: {
        orderBy: { version: "desc" },
        take: 2,
        include: { checklistItems: true }
      }
    }
  });
  if (!task) {
    notFound();
  }
  const pack = task.onboardingPacks[0];
  const previousPack = task.onboardingPacks[1];
  const citations = pack
    ? await prisma.citation.findMany({
        where: { onboardingPackId: pack.id },
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
  const sections = pack ? asSections(pack.structuredJson) : [];
  const previousSections = previousPack ? asSections(previousPack.structuredJson) : [];
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
          <h1 className="text-2xl font-semibold text-slate-900">Onboarding Pack</h1>
          <p className="text-sm text-slate-600">Task {task.id}</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Onboarding Content {pack ? `(v${pack.version})` : ""}
        </h2>
        {pack && principal && canEditOnboarding(principal.role) ? (
          <EditMarkdownForm patchUrl={`/api/onboarding-packs/${pack.id}`} initialValue={pack.contentMarkdown} />
        ) : pack ? (
          <pre className="whitespace-pre-wrap rounded-md bg-slate-100 p-3 text-xs text-slate-800">
            {pack.contentMarkdown}
          </pre>
        ) : (
          <p className="text-sm text-slate-600">No onboarding pack yet. Run generation from Draft Review.</p>
        )}
      </div>

      {pack ? (
        <div className="card space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Section Regeneration</h2>
          <SectionRegeneratePanel
            endpoint={`/api/onboarding-packs/${pack.id}/regenerate-section`}
            sections={sections.map((section) => ({
              key: section.key,
              title: section.title,
              needsHumanFill: section.needsHumanFill
            }))}
            canRegenerate={principal ? canEditOnboarding(principal.role) : false}
          />
        </div>
      ) : null}

      <div className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Citation Map</h2>
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
        {!pack || !previousPack ? (
          <p className="text-sm text-slate-600">Need at least two onboarding versions to show differences.</p>
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
        <Link href={`/tasks/${task.id}/checklist`}>Go to Checklist</Link>
        {principal && canApprove(principal.role) ? <Link href={`/tasks/${task.id}/approval`}>Go to Approval</Link> : null}
      </div>
    </div>
  );
}
