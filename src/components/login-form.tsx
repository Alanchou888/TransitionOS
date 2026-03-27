"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function LoginForm({ users }: { users: UserOption[] }) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit() {
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Login failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Demo User</label>
        <p className="text-xs text-slate-500">建議先用 Admin 驗證全流程，再切換到 Manager/Successor 測權限限制。</p>
      </div>
      <select
        className="input"
        value={selectedUserId}
        onChange={(event) => setSelectedUserId(event.target.value)}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.role}) - {user.email}
          </option>
        ))}
      </select>
      <button className="btn w-full" onClick={onSubmit} disabled={isSubmitting || !selectedUserId}>
        {isSubmitting ? "Signing in..." : "Use This Account"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
