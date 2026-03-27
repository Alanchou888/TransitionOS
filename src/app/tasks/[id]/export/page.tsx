import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExportActions } from "@/components/export-actions";
import { TaskStatusBadge } from "@/components/task-status-badge";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const task = await prisma.transitionTask.findUnique({ where: { id: resolvedParams.id } });
  if (!task) {
    notFound();
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Export</h1>
          <p className="text-sm text-slate-600">Task {task.id}</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      <ExportActions taskId={task.id} />
    </div>
  );
}
