import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePageRoles } from "@/lib/page-auth";
import { canDeleteTaskForPrincipal, canManageTaskForPrincipal } from "@/lib/permissions";
import { TaskManageForm } from "@/components/task-manage-form";

export default async function TaskManagePage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePageRoles([Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
  const resolved = await params;

  const task = await prisma.transitionTask.findUnique({
    where: { id: resolved.id }
  });
  if (!task) {
    redirect("/dashboard");
  }
  if (!canManageTaskForPrincipal(principal, task.ownerUserId)) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true }
  });
  const sources = await prisma.sourceConnection.findMany({
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    select: { id: true, type: true, enabled: true }
  });

  return (
    <div className="space-y-5">
      <div className="card space-y-2">
        <h1 className="page-title">Manage Transition Task</h1>
        <p className="page-subtitle">Update task metadata, source scope, ownership, or remove this task.</p>
      </div>
      <TaskManageForm
        task={{
          id: task.id,
          type: task.type,
          ownerUserId: task.ownerUserId,
          targetRole: task.targetRole,
          successorUserId: task.successorUserId,
          dateFrom: task.dateFrom.toISOString(),
          dateTo: task.dateTo.toISOString(),
          sourceSelection: task.sourceSelection
        }}
        users={users}
        sources={sources}
        canDelete={canDeleteTaskForPrincipal(principal, task.ownerUserId)}
      />
    </div>
  );
}
