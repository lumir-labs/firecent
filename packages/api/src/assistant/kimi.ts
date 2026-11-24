import "@app/env";

const DEFAULT_INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "moonshotai/kimi-k3.1-pro";

export type KimiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type KimiToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type KimiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | KimiContentPart[] }
  | {
      role: "assistant";
      content: string | null;
      reasoning_content?: string | null;
      tool_calls?: KimiToolCall[];
    }
  | {
      role: "tool";
      tool_call_id: string;
      name: string;
      content: string;
    };

export type KimiToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type KimiUsage = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

export type KimiCompletionResult = {
  content: string;
  reasoningContent: string | null;
  toolCalls: KimiToolCall[];
  finishReason: string | null;
  usage: KimiUsage;
};

export type KimiStreamCallbacks = {
  onTextDelta?: (delta: string) => void;
  onReasoningDelta?: (delta: string) => void;
  onToolCallStarted?: (name: string) => void;
  onToolCallProgress?: (info: {
    name: string;
    argChars: number;
    txCountEstimate: number;
  }) => void;
};

function getKimiConfig() {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured in environment");
  }
  return {
    apiKey,
    invokeUrl: process.env.NVIDIA_API_URL?.trim() || DEFAULT_INVOKE_URL,
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

/**
 * Streams a chat completion from NVIDIA NIM (Kimi K3.1 Pro) using native `fetch`.
 * Collects streamed text deltas, reasoning_content, tool_calls, and usage stats.
 */
export async function streamKimiCompletion(opts: {
  messages: KimiMessage[];
  tools?: KimiToolDefinition[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  maxTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  callbacks?: KimiStreamCallbacks;
}): Promise<KimiCompletionResult> {
  const { apiKey, invokeUrl, model } = getKimiConfig();

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 16384,
    stream: true,
    stream_options: { include_usage: true },
    reasoning_effort: opts.reasoningEffort ?? "low",
  };

  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? "auto";
  }

  const timeoutSignal = AbortSignal.timeout(opts.timeoutMs ?? 240_000);
  const combinedSignal = opts.signal
    ? AbortSignal.any([opts.signal, timeoutSignal])
    : timeoutSignal;

  const res = await fetch(invokeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: combinedSignal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Kimi API error (${res.status}): ${errText.slice(0, 400) || res.statusText}`,
    );
  }

  if (!res.body) {
    throw new Error("Kimi API returned empty response body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let content = "";
  let reasoningContent = "";
  let finishReason: string | null = null;

  const toolCallsByIndex = new Map<
    number,
    {
      id: string;
      name: string;
      arguments: string;
      announced: boolean;
      lastReportedAt: number;
      lastTxEstimate: number;
    }
  >();

  const usage: KimiUsage = {
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line || !line.startsWith("data:")) return;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") return;

    let chunk: {
      choices?: Array<{
        finish_reason?: string | null;
        delta?: {
          content?: string | null;
          reasoning_content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };

    try {
      chunk = JSON.parse(dataStr);
    } catch {
      return;
    }

    if (chunk.usage) {
      usage.promptTokens = chunk.usage.prompt_tokens ?? usage.promptTokens;
      usage.completionTokens =
        chunk.usage.completion_tokens ?? usage.completionTokens;
      usage.totalTokens = chunk.usage.total_tokens ?? usage.totalTokens;
      usage.cachedTokens =
        chunk.usage.prompt_tokens_details?.cached_tokens ?? usage.cachedTokens;
      usage.reasoningTokens =
        chunk.usage.completion_tokens_details?.reasoning_tokens ??
        usage.reasoningTokens;
    }

    const choice = chunk.choices?.[0];
    if (!choice) return;

    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }

    const delta = choice.delta;
    if (!delta) return;

    if (delta.reasoning_content) {
      reasoningContent += delta.reasoning_content;
      opts.callbacks?.onReasoningDelta?.(delta.reasoning_content);
    }

    if (delta.content) {
      content += delta.content;
      opts.callbacks?.onTextDelta?.(delta.content);
    }

    if (delta.tool_calls && delta.tool_calls.length > 0) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        let entry = toolCallsByIndex.get(idx);
        if (!entry) {
          entry = {
            id: tc.id ?? `call_${idx}_${Date.now()}`,
            name: "",
            arguments: "",
            announced: false,
            lastReportedAt: 0,
            lastTxEstimate: 0,
          };
          toolCallsByIndex.set(idx, entry);
        }
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) {
          if (entry.name !== tc.function.name) {
            entry.name += tc.function.name;
          }
          if (!entry.announced && entry.name.length > 0) {
            entry.announced = true;
            opts.callbacks?.onToolCallStarted?.(entry.name);
          }
        }
        if (tc.function?.arguments) {
          entry.arguments += tc.function.arguments;
          if (opts.callbacks?.onToolCallProgress && entry.name) {
            const now = Date.now();
            const txMatches = entry.arguments.match(/"date"\s*:/g);
            const txEstimate = txMatches ? txMatches.length : 0;
            if (
              txEstimate !== entry.lastTxEstimate ||
              now - entry.lastReportedAt >= 500
            ) {
              entry.lastTxEstimate = txEstimate;
              entry.lastReportedAt = now;
              opts.callbacks.onToolCallProgress({
                name: entry.name,
                argChars: entry.arguments.length,
                txCountEstimate: txEstimate,
              });
            }
          }
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlIdx = buffer.indexOf("\n");
    while (nlIdx !== -1) {
      const line = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 1);
      processLine(line);
      nlIdx = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) {
    processLine(buffer);
  }

  const toolCalls: KimiToolCall[] = [...toolCallsByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, entry]) => ({
      id: entry.id,
      type: "function" as const,
      function: {
        name: entry.name,
        arguments: entry.arguments || "{}",
      },
    }));

  return {
    content,
    reasoningContent: reasoningContent || null,
    toolCalls,
    finishReason,
    usage,
  };
}
