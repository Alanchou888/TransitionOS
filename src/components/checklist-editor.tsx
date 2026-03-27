"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ChecklistItem = {
  id: string;
  section: string;
  title: string;
  description: string;
  completedAt: Date | string | null;
  mentorNote: string | null;
};

export function ChecklistEditor({ items, canEdit }: { items: ChecklistItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function update(item: ChecklistItem, completed: boolean) {
    setBusyId(item.id);
    await fetch(`/api/checklist-items/${item.id}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed,
        mentorNote: item.mentorNote ?? undefined
      })
    });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="card flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.section}</p>
            <p className="font-medium text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            {item.mentorNote ? <p className="mt-2 text-sm text-indigo-700">Mentor: {item.mentorNote}</p> : null}
          </div>
          {canEdit ? (
            <button
              className={item.completedAt ? "btn-secondary" : "btn"}
              disabled={busyId === item.id}
              onClick={() => update(item, !Boolean(item.completedAt))}
            >
              {busyId === item.id ? "Saving..." : item.completedAt ? "Mark Incomplete" : "Mark Complete"}
            </button>
          ) : (
            <p className="text-xs text-slate-500">Read only</p>
          )}
        </div>
      ))}
    </div>
  );
}
