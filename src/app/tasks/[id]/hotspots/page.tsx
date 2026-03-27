import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildHotspots } from "@/lib/knowledge/insights";
import { TaskStatusBadge } from "@/components/task-status-badge";

export default async function HotspotsPage({ params }: { params: Promise<{ id: string }> }) {
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
  const hotspots = buildHotspots(task.sourceItems);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hotspot Visualization</h1>
          <p className="text-sm text-slate-600">Most discussed or frequently touched artifacts.</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      <div className="space-y-3">
        {hotspots.map((entry) => (
          <div key={entry.key} className="card">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">{entry.key}</p>
              <p className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                score {entry.score}
              </p>
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
              {entry.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

