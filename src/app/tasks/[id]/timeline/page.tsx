import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildTimeline } from "@/lib/knowledge/insights";
import { TaskStatusBadge } from "@/components/task-status-badge";

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const task = await prisma.transitionTask.findUnique({
    where: { id: resolved.id },
    include: {
      sourceItems: {
        orderBy: { createdAtSource: "desc" }
      }
    }
  });
  if (!task) {
    notFound();
  }
  const timeline = buildTimeline(task.sourceItems);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Interactive Timeline</h1>
          <p className="text-sm text-slate-600">Decision and implementation evolution by time.</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      <div className="space-y-3">
        {timeline.map((entry) => (
          <div key={entry.id} className="card">
            <p className="text-xs text-slate-500">{entry.date}</p>
            <p className="font-medium text-slate-900">{entry.title}</p>
            <p className="text-sm text-slate-600">{entry.sourceType}</p>
            {entry.url ? (
              <a className="text-sm" href={entry.url} target="_blank" rel="noreferrer">
                Open source
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

