import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApprovalActions } from "@/components/approval-actions";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { requirePageRoles } from "@/lib/page-auth";
import {
  listMissingCitationSections,
  listNeedsHumanFillSections
} from "@/lib/generation/validation";

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRoles([Role.ADMIN, Role.MANAGER]);
  const resolvedParams = await params;
  const task = await prisma.transitionTask.findUnique({
    where: { id: resolvedParams.id },
    include: {
      handoverDrafts: { orderBy: { version: "desc" }, take: 1 },
      onboardingPacks: {
        orderBy: { version: "desc" },
        take: 1,
        include: { checklistItems: true }
      },
      approvals: {
        orderBy: { createdAt: "desc" },
        include: { approver: { select: { name: true, email: true } } }
      }
    }
  });
  if (!task) {
    notFound();
  }

  const latestHandover = task.handoverDrafts[0];
  const latestOnboarding = task.onboardingPacks[0];
  const precheckMessages: string[] = [];
  let missingCitationDetail: string[] = [];
  let needsHumanFillDetail: string[] = [];
  let checklistDetail = "";
  const warningMessages: string[] = [];
  if (!latestHandover || !latestOnboarding) {
    precheckMessages.push("Missing handover draft or onboarding pack.");
  } else {
    missingCitationDetail = [
      ...listMissingCitationSections(latestHandover.structuredJson).map((key) => `handover:${key}`),
      ...listMissingCitationSections(latestOnboarding.structuredJson).map((key) => `onboarding:${key}`)
    ];
    if (missingCitationDetail.length > 0) {
      precheckMessages.push("Missing citations in one or more sections.");
    }
    needsHumanFillDetail = [
      ...listNeedsHumanFillSections(latestHandover.structuredJson).map((key) => `handover:${key}`),
      ...listNeedsHumanFillSections(latestOnboarding.structuredJson).map((key) => `onboarding:${key}`)
    ];
    if (needsHumanFillDetail.length > 0) {
      precheckMessages.push("Document still has needs_human_fill sections.");
    }
    const checklist = latestOnboarding.checklistItems;
    const done = checklist.filter((item) => Boolean(item.completedAt)).length;
    const progress = checklist.length ? Math.round((done / checklist.length) * 100) : 0;
    const configuredThreshold = Number(process.env.APPROVAL_CHECKLIST_MIN_PERCENT ?? "60");
    const threshold = Number.isFinite(configuredThreshold)
      ? Math.min(100, Math.max(0, Math.round(configuredThreshold)))
      : 60;
    checklistDetail = `${progress}% / required ${threshold}%`;
    if (checklist.length > 0 && progress < threshold) {
      precheckMessages.push(`Checklist completion ${progress}% is below threshold ${threshold}%.`);
    }
  }
  const latestGenerationLog = await prisma.auditLog.findFirst({
    where: { transitionTaskId: task.id, action: "TASK_GENERATED" },
    orderBy: { createdAt: "desc" }
  });
  const warnings =
    ((latestGenerationLog?.detailsJson as { warnings?: string[] } | null)?.warnings ?? []).filter(
      (entry): entry is string => typeof entry === "string"
    );
  if (warnings.length > 0) {
    precheckMessages.push("Latest generation has warnings. Resolve them before approval.");
    warningMessages.push(...warnings);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Approval</h1>
          <p className="text-sm text-slate-600">Task {task.id}</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="card space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Approval Readiness</h2>
        {precheckMessages.length === 0 ? (
          <p className="text-sm text-emerald-700">All checks passed. Task is ready for approval.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-amber-800">
            {precheckMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        {missingCitationDetail.length > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <p className="font-semibold">Missing citations:</p>
            <p>{missingCitationDetail.join(", ")}</p>
            <p className="mt-1">
              Fix in <Link href={`/tasks/${task.id}/draft`} className="underline">Draft Review</Link> or{" "}
              <Link href={`/tasks/${task.id}/onboarding`} className="underline">Onboarding Pack</Link>.
            </p>
          </div>
        ) : null}
        {needsHumanFillDetail.length > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <p className="font-semibold">Needs human fill sections:</p>
            <p>{needsHumanFillDetail.join(", ")}</p>
          </div>
        ) : null}
        {checklistDetail ? (
          <p className="text-xs text-slate-600">Checklist progress: {checklistDetail}</p>
        ) : null}
        {warningMessages.length > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <p className="font-semibold">Generation warnings:</p>
            <ul className="list-disc pl-5">
              {warningMessages.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <ApprovalActions taskId={task.id} />

      <div className="card space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Approval History</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {task.approvals.map((approval) => (
            <li key={approval.id}>
              {approval.decision} by {approval.approver.name} ({approval.approver.email}) at{" "}
              {approval.createdAt.toISOString()}
              {approval.comment ? ` - ${approval.comment}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
