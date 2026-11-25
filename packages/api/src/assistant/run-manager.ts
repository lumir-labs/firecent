import type {
  AssistantTraceStep,
  AssistantUiBlock,
  TokenUsageSummary,
} from "./types";

export type AssistantStreamEvent =
  | { type: "thread"; threadId: string; title: string }
  | { type: "status"; phase: string; label: string }
  | { type: "trace_step"; step: AssistantTraceStep }
  | { type: "text_delta"; delta: string }
  | { type: "ui_block"; block: AssistantUiBlock }
  | {
      type: "done";
      threadId: string;
      messageId: string;
      uiBlocks: AssistantUiBlock[];
      tokenUsage: TokenUsageSummary;
    }
  | { type: "error"; message: string }
  | { type: "already_done"; threadId: string };

export type ActiveAssistantRun = {
  runId: string;
  threadId: string;
  orgId: string;
  userId: string;
  startedAt: number;
  status: "running" | "done" | "error" | "cancelled";
  latestStatusLabel: string | null;
  steps: AssistantTraceStep[];
  content: string;
  uiBlocks: AssistantUiBlock[];
  doneEvent: Extract<AssistantStreamEvent, { type: "done" }> | null;
  errorMessage: string | null;
  abortController: AbortController;
  listeners: Set<(event: AssistantStreamEvent) => void>;
};

const globalForRuns = globalThis as unknown as {
  __firecentAssistantRuns?: Map<string, ActiveAssistantRun>;
};

const activeRuns: Map<string, ActiveAssistantRun> =
  globalForRuns.__firecentAssistantRuns ??
  (globalForRuns.__firecentAssistantRuns = new Map());

/** Creates and registers a detached server-side run for `threadId`. */
export function registerActiveRun(opts: {
  runId: string;
  threadId: string;
  orgId: string;
  userId: string;
}): ActiveAssistantRun {
  // Cancel any stale prior run for the same thread
  const prev = activeRuns.get(opts.threadId);
  if (prev && prev.status === "running") {
    prev.abortController.abort();
  }

  const run: ActiveAssistantRun = {
    runId: opts.runId,
    threadId: opts.threadId,
    orgId: opts.orgId,
    userId: opts.userId,
    startedAt: Date.now(),
    status: "running",
    latestStatusLabel: null,
    steps: [],
    content: "",
    uiBlocks: [],
    doneEvent: null,
    errorMessage: null,
    abortController: new AbortController(),
    listeners: new Set(),
  };

  activeRuns.set(opts.threadId, run);
  return run;
}

/** Pushes an event into the run's replay buffer and broadcasts to all connected devices. */
export function pushRunEvent(
  run: ActiveAssistantRun,
  event: AssistantStreamEvent,
): void {
  if (event.type === "status") {
    run.latestStatusLabel = event.label;
  } else if (event.type === "trace_step") {
    const idx = run.steps.findIndex((s) => s.id === event.step.id);
    if (idx >= 0) run.steps[idx] = event.step;
    else run.steps.push(event.step);
  } else if (event.type === "text_delta") {
    run.content += event.delta;
  } else if (event.type === "ui_block") {
    run.uiBlocks.push(event.block);
  } else if (event.type === "done") {
    run.status = "done";
    run.doneEvent = event;
  } else if (event.type === "error") {
    run.status =
      run.abortController.signal.aborted ? "cancelled" : "error";
    run.errorMessage = event.message;
  }

  for (const listener of run.listeners) {
    try {
      listener(event);
    } catch {
      run.listeners.delete(listener);
    }
  }
}

/** Marks a run finished and schedules cleanup after 45s so late reconnections still get `done`. */
export function scheduleRunCleanup(run: ActiveAssistantRun): void {
  setTimeout(() => {
    const current = activeRuns.get(run.threadId);
    if (current?.runId === run.runId) {
      activeRuns.delete(run.threadId);
    }
  }, 45_000);
}

/** Returns an active run if it belongs to `(orgId, userId)` and is still running or recently finished. */
export function getActiveRunForUser(opts: {
  threadId: string;
  orgId: string;
  userId: string;
}): ActiveAssistantRun | null {
  const run = activeRuns.get(opts.threadId);
  if (!run) return null;
  if (run.orgId !== opts.orgId || run.userId !== opts.userId) return null;
  return run;
}

export function isThreadRunningForUser(opts: {
  threadId: string;
  orgId: string;
  userId: string;
}): { running: boolean; startedAt: number | null } {
  const run = getActiveRunForUser(opts);
  if (!run || run.status !== "running") {
    return { running: false, startedAt: null };
  }
  return { running: true, startedAt: run.startedAt };
}

/** Explicitly cancels a running background task (only when user clicks Stop). */
export function cancelActiveRunForUser(opts: {
  threadId: string;
  orgId: string;
  userId: string;
}): boolean {
  const run = getActiveRunForUser(opts);
  if (!run || run.status !== "running") return false;
  run.status = "cancelled";
  run.abortController.abort();
  return true;
}

/**
 * Subscribes an SSE writer to an active run, immediately replaying the
 * accumulated snapshot (steps, text, UI blocks) so a second device or reopened
 * tab catches up instantaneously without missing anything.
 */
export function subscribeToRun(
  run: ActiveAssistantRun,
  send: (event: AssistantStreamEvent) => void,
): () => void {
  if (run.latestStatusLabel && run.status === "running") {
    send({ type: "status", phase: "resumed", label: run.latestStatusLabel });
  }
  for (const step of run.steps) {
    send({ type: "trace_step", step });
  }
  if (run.content) {
    send({ type: "text_delta", delta: run.content });
  }
  for (const block of run.uiBlocks) {
    send({ type: "ui_block", block });
  }

  if (run.status === "done" && run.doneEvent) {
    send(run.doneEvent);
    return () => {};
  }
  if (run.status === "error" || run.status === "cancelled") {
    if (run.errorMessage) {
      send({ type: "error", message: run.errorMessage });
    } else {
      send({ type: "already_done", threadId: run.threadId });
    }
    return () => {};
  }

  run.listeners.add(send);
  return () => {
    run.listeners.delete(send);
  };
}
