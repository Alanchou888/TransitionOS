import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { pickRelevantByQuery } from "@/lib/knowledge/retrieval";
import { createOpenAiText, isOpenAiEnabled } from "@/lib/ai/openai";

const bodySchema = z.object({
  question: z.string().min(2).max(2000)
});

function makeAnswer(question: string, snippets: { title: string; rawContent: string; sourceType: string }[]) {
  if (snippets.length === 0) {
    return `No relevant historical context was found for: "${question}". Add more source connectors or widen date range.`;
  }
  const lines = snippets.slice(0, 4).map((item) => `- [${item.sourceType}] ${item.title}: ${item.rawContent.slice(0, 180)}`);
  return [
    `Ghost Chat response for: "${question}"`,
    "Based on indexed records, the likely decision context is:",
    ...lines
  ].join("\n");
}

async function makeAiAnswer(question: string, snippets: { id: string; title: string; rawContent: string; sourceType: string }[]) {
  if (!isOpenAiEnabled() || snippets.length === 0) {
    return null;
  }

  const system = [
    "You are TransitionOS Ghost Chat, a predecessor knowledge assistant.",
    "Answer only from the provided snippets.",
    "Be concise and practical.",
    "When uncertain, explicitly say what is missing."
  ].join(" ");
  const user = JSON.stringify(
    {
      question,
      snippets: snippets.map((snippet, index) => ({
        ref: `S${index + 1}`,
        sourceItemId: snippet.id,
        sourceType: snippet.sourceType,
        title: snippet.title,
        rawContent: snippet.rawContent.slice(0, 1000)
      })),
      format: "Use bullet points and cite references like [S1], [S2]."
    },
    null,
    2
  );

  try {
    return await createOpenAiText({
      system,
      user,
      maxTokens: 900
    });
  } catch (error) {
    console.warn(
      "[TransitionOS] OpenAI ghost chat failed, fallback to retrieval answer:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.SUCCESSOR, Role.MENTOR]);
  if (auth.denied) {
    return auth.denied;
  }
  const resolved = await params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sourceItems = await prisma.sourceItem.findMany({
    where: { transitionTaskId: resolved.id },
    orderBy: { createdAtSource: "desc" }
  });
  const relevant = pickRelevantByQuery(sourceItems, parsed.data.question, new Date(), 5);
  const aiAnswer = await makeAiAnswer(
    parsed.data.question,
    relevant.map((item) => ({
      id: item.id,
      title: item.title,
      rawContent: item.rawContent,
      sourceType: item.sourceType
    }))
  );
  const answer = aiAnswer ?? makeAnswer(parsed.data.question, relevant);

  return NextResponse.json({
    taskId: resolved.id,
    mode: aiAnswer ? "ai" : "fallback",
    answer,
    citations: relevant.map((item) => ({
      sourceItemId: item.id,
      title: item.title,
      sourceType: item.sourceType,
      url: item.url
    }))
  });
}
