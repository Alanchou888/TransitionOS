import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TaskCreateForm } from "@/components/task-create-form";
import { requirePageRoles } from "@/lib/page-auth";

export default async function CreateTaskPage() {
  await requirePageRoles([Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
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
        <h1 className="page-title">Create Transition Task</h1>
        <p className="page-subtitle">
          Define owner, role target, date range, source connectors, and retrieval scope filters.
        </p>
      </div>
      <TaskCreateForm users={users} sources={sources} />
    </div>
  );
}
