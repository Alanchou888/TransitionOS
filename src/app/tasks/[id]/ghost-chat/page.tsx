import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { GhostChat } from "@/components/ghost-chat";

export default async function GhostChatPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const task = await prisma.transitionTask.findUnique({
    where: { id: resolved.id }
  });
  if (!task) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ghost Chat</h1>
          <p className="text-sm text-slate-600">Ask historical why/how questions to the indexed knowledge base.</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      <GhostChat taskId={task.id} />
    </div>
  );
}

