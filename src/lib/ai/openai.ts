type JsonSchemaConfig = {
  name: string;
  schema: Record<string, unknown>;
};

type OpenAiMessage = {
  role: "system" | "user";
  content: string;
};

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

function getApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY?.trim();
  return raw ? raw : null;
}

function getModel(): string {
  const raw = process.env.OPENAI_MODEL?.trim();
  return raw || DEFAULT_MODEL;
}

function stripCodeFence(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, "");
  return withoutStart.replace(/\s*```$/, "").trim();
}

function extractMessageText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const choices = (payload as { choices?: unknown[] }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        return String((entry as { text?: unknown }).text ?? "");
      })
      .join("\n");
  }
  return "";
}

async function runChatCompletion(
  messages: OpenAiMessage[],
  extras?: Record<string, unknown>
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0.2,
        messages,
        ...extras
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof (payload as { error?: { message?: string } }).error?.message === "string"
          ? (payload as { error: { message: string } }).error.message
          : `OpenAI request failed (${res.status})`;
      throw new Error(message);
    }

    const text = extractMessageText(payload);
    return text ? text.trim() : null;
  } finally {
    clearTimeout(timeout);
  }
}

export function isOpenAiEnabled() {
  return Boolean(getApiKey());
}

export function getOpenAiModel() {
  return getModel();
}

export async function createOpenAiText(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string | null> {
  return runChatCompletion(
    [
      { role: "system", content: args.system },
      { role: "user", content: args.user }
    ],
    args.maxTokens ? { max_tokens: args.maxTokens } : undefined
  );
}

export async function createOpenAiJson<T>(args: {
  system: string;
  user: string;
  schema: JsonSchemaConfig;
  maxTokens?: number;
}): Promise<T | null> {
  const text = await runChatCompletion(
    [
      { role: "system", content: args.system },
      { role: "user", content: args.user }
    ],
    {
      ...(args.maxTokens ? { max_tokens: args.maxTokens } : {}),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: args.schema.name,
          strict: true,
          schema: args.schema.schema
        }
      }
    }
  );
  if (!text) {
    return null;
  }
  const normalized = stripCodeFence(text);
  return JSON.parse(normalized) as T;
}
