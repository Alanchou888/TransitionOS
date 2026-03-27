"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApprovalActions({ taskId }: { taskId: string }) {
  const [rejectComment, setRejectComment] = useState("Need more detail in blockers and owner mapping.");
  const [isSubmitting, setIsSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function approve() {
    setIsSubmitting("approve");
    setError("");
    try {
      const res = await fetch(`/api/transition-tasks/${taskId}/approve`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Approve failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setIsSubmitting(null);
    }
  }

  async function reject() {
    setIsSubmitting("reject");
    setError("");
    try {
      const res = await fetch(`/api/transition-tasks/${taskId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: rejectComment })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Reject failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setIsSubmitting(null);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn min-w-28" disabled={isSubmitting !== null} onClick={approve}>
          {isSubmitting === "approve" ? "Approving..." : "Approve"}
        </button>
        <button className="btn-secondary min-w-28" disabled={isSubmitting !== null} onClick={reject}>
          {isSubmitting === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Reject Comment</label>
        <textarea
          className="input min-h-24"
          value={rejectComment}
          onChange={(event) => setRejectComment(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
