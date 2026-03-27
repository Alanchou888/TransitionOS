import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { getPrincipalFromCookies } from "@/lib/auth";
import {
  canApprove,
  canCreateTask,
  canDeleteTaskForPrincipal,
  canEditChecklist,
  canManageTaskForPrincipal
} from "@/lib/permissions";

export default async function DashboardPage() {
  const principal = await getPrincipalFromCookies();
  const tasks = await prisma.transitionTask.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      owner: { select: { id: true, name: true } },
      onboardingPacks: {
        orderBy: { version: "desc" },
        take: 1,
        include: { checklistItems: true }
      }
    }
  });

  const inReviewCount = tasks.filter((task) => task.status === "IN_REVIEW").length;
  const approvedCount = tasks.filter((task) => task.status === "APPROVED").length;
  const averageChecklist =
    tasks.length === 0
      ? 0
      : Math.round(
          tasks.reduce((acc, task) => {
            const checklist = task.onboardingPacks[0]?.checklistItems ?? [];
            const done = checklist.filter((entry) => Boolean(entry.completedAt)).length;
            const progress = checklist.length ? Math.round((done / checklist.length) * 100) : 0;
            return acc + progress;
          }, 0) / tasks.length
        );

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">Transition Dashboard</h1>
            <p className="page-subtitle">
              Track transition health, review readiness, and onboarding completion across active tasks.
            </p>
          </div>
          {principal && canCreateTask(principal.role) ? (
            <Link href="/tasks/new" className="btn">
              Create Transition Task
            </Link>
          ) : null}
        </div>
        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-label">Active Tasks</p>
            <p className="kpi-value">{tasks.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">In Review</p>
            <p className="kpi-value">{inReviewCount}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Approved</p>
            <p className="kpi-value">{approvedCount}</p>
          </div>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Average Onboarding Completion</p>
          <p className="kpi-value">{averageChecklist}%</p>
          <div className="mt-2 progress-track">
            <div className="progress-fill" style={{ width: `${averageChecklist}%` }} />
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {tasks.length === 0 ? (
          <div className="card">
            <p className="text-sm text-slate-600">No tasks yet. Create your first transition task to get started.</p>
          </div>
        ) : null}

        {tasks.map((task) => {
          const checklist = task.onboardingPacks[0]?.checklistItems ?? [];
          const done = checklist.filter((entry) => Boolean(entry.completedAt)).length;
          const progress = checklist.length ? Math.round((done / checklist.length) * 100) : 0;
          const canManage = principal ? canManageTaskForPrincipal(principal, task.owner.id) : false;
          const canDelete = principal ? canDeleteTaskForPrincipal(principal, task.owner.id) : false;

          return (
            <article key={task.id} className="card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{task.type}</p>
                  <h2 className="text-xl font-semibold text-slate-900">{task.targetRole}</h2>
                  <p className="text-sm text-slate-600">Owner: {task.owner.name}</p>
                </div>
                <TaskStatusBadge status={task.status} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Onboarding Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="link-list flex flex-wrap gap-1">
                <Link href={`/tasks/${task.id}/draft`}>Draft Review</Link>
                <Link href={`/tasks/${task.id}/onboarding`}>Onboarding Pack</Link>
                {principal && canEditChecklist(principal.role) ? (
                  <Link href={`/tasks/${task.id}/checklist`}>Checklist ({progress}%)</Link>
                ) : null}
                {principal && canApprove(principal.role) ? (
                  <Link href={`/tasks/${task.id}/approval`}>Approval</Link>
                ) : null}
                <Link href={`/tasks/${task.id}/timeline`}>Timeline</Link>
                <Link href={`/tasks/${task.id}/hotspots`}>Hotspots</Link>
                <Link href={`/tasks/${task.id}/graph`}>GraphRAG</Link>
                <Link href={`/tasks/${task.id}/ghost-chat`}>Ghost Chat</Link>
                <Link href={`/tasks/${task.id}/export`}>Export</Link>
                {canManage ? <Link href={`/tasks/${task.id}/manage`}>Manage Task</Link> : null}
              </div>

              {canDelete ? (
                <p className="text-xs text-slate-400">Delete action is available in Manage Task.</p>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
