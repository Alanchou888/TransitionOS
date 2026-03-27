import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildKnowledgeGraph } from "@/lib/knowledge/insights";
import { TaskStatusBadge } from "@/components/task-status-badge";

export default async function GraphPage({ params }: { params: Promise<{ id: string }> }) {
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
  const graph = buildKnowledgeGraph(task.sourceItems);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">GraphRAG View</h1>
          <p className="text-sm text-slate-600">People-artifact-issue relationship graph.</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">Nodes ({graph.nodes.length})</h2>
          <ul className="mt-2 max-h-96 space-y-1 overflow-auto text-sm text-slate-700">
            {graph.nodes.map((node) => (
              <li key={node.id}>
                [{node.type}] {node.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">Edges ({graph.edges.length})</h2>
          <ul className="mt-2 max-h-96 space-y-1 overflow-auto text-sm text-slate-700">
            {graph.edges.map((edge, idx) => (
              <li key={`${edge.from}-${edge.to}-${idx}`}>
                {edge.from} --{edge.label}→ {edge.to}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

