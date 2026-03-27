import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChecklistEditor } from "@/components/checklist-editor";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { getPrincipalFromCookies } from "@/lib/auth";
import { canEditChecklist } from "@/lib/permissions";

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await getPrincipalFromCookies();
  const resolvedParams = await params;
  const task = await prisma.transitionTask.findUnique({
    where: { id: resolvedParams.id },
    include: {
      onboardingPacks: {
        orderBy: { version: "desc" },
        take: 1,
        include: { checklistItems: { orderBy: [{ section: "asc" }, { createdAt: "asc" }] } }
      }
    }
  });
  if (!task) {
    notFound();
  }
  const pack = task.onboardingPacks[0];
  if (!pack) {
    return (
      <div className="card">
        <p className="text-sm text-slate-700">No onboarding pack available yet.</p>
      </div>
    );
  }
  const items = pack.checklistItems;
  const done = items.filter((item) => Boolean(item.completedAt)).length;
  const progress = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Checklist</h1>
          <p className="text-sm text-slate-600">Onboarding completion: {progress}%</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      <ChecklistEditor items={items} canEdit={principal ? canEditChecklist(principal.role) : false} />
    </div>
  );
}
