"use client";

import { useState } from "react";

type Citation = {
  sourceItemId: string;
  title: string;
  sourceType: string;
  url: string | null;
};

type ChatResult = {
  mode?: "ai" | "fallback";
  answer: string;
  citations: Citation[];
};

export function GhostChat({ taskId }: { taskId: string }) {
  const [question, setQuestion] = useState("Why did we choose this architecture and what risks remain?");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChatResult | null>(null);

  async function ask() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/transition-tasks/${taskId}/ghost-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Ghost chat failed");
      }
      const data = (await res.json()) as ChatResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ghost chat failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-base font-semibold text-slate-900">Ghost Chat (Virtual Predecessor)</h2>
      <textarea
        className="input min-h-24"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
      />
      <button className="btn" onClick={ask} disabled={busy}>
        {busy ? "Thinking..." : "Ask"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {result ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Mode: {result.mode === "ai" ? "AI (OpenAI)" : "Fallback (retrieval template)"}
          </p>
          <pre className="whitespace-pre-wrap rounded-md bg-slate-100 p-3 text-sm text-slate-800">
            {result.answer}
          </pre>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Citations</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {result.citations.map((citation) => (
                <li key={citation.sourceItemId}>
                  [{citation.sourceType}] {citation.title}{" "}
                  {citation.url ? (
                    <a href={citation.url} target="_blank" rel="noreferrer">
                      (open)
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
