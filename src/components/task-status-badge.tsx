import { TaskStatus } from "@prisma/client";

const styleMap: Record<TaskStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  INGESTING: "border-amber-200 bg-amber-100 text-amber-800",
  GENERATED: "border-cyan-200 bg-cyan-100 text-cyan-800",
  IN_REVIEW: "border-indigo-200 bg-indigo-100 text-indigo-800",
  CHANGES_REQUESTED: "border-rose-200 bg-rose-100 text-rose-800",
  APPROVED: "border-emerald-200 bg-emerald-100 text-emerald-800",
  EXPORTED: "border-green-200 bg-green-100 text-green-800"
};

const dotMap: Record<TaskStatus, string> = {
  DRAFT: "bg-slate-500",
  INGESTING: "bg-amber-500",
  GENERATED: "bg-cyan-500",
  IN_REVIEW: "bg-indigo-500",
  CHANGES_REQUESTED: "bg-rose-500",
  APPROVED: "bg-emerald-500",
  EXPORTED: "bg-green-500"
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styleMap[status]}`}>
      <span className={`status-dot ${dotMap[status]}`} />
      {status}
    </span>
  );
}
