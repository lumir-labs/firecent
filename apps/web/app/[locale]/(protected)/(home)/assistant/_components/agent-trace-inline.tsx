"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { AssistantTraceStep } from "@app/api/assistant-types";
import { cn } from "@/lib/utils";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  const sec = ms / 1000;
  return sec < 10 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`;
}

export type AgentTraceInlineProps = {
  steps: AssistantTraceStep[];
  isStreaming: boolean;
  fallbackLabel?: string | null;
  startedAt?: number;
};

/**
 * Single-line collapsible agent activity indicator rendered inline next to the
 * assistant flame. Updates live as the AI thinks, streams tool calls, and
 * reconciles with the DB, and expands to inspect every step + tool used.
 */
export function AgentTraceInline({
  steps,
  isStreaming,
  fallbackLabel,
  startedAt,
}: AgentTraceInlineProps) {
  const t = useTranslations("Assistant");
  const [expanded, setExpanded] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!isStreaming || !startedAt) return;
    const id = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [isStreaming, startedAt]);

  if (!isStreaming && steps.length === 0) return null;

  const runningStep =
    [...steps].reverse().find((s) => s.status === "running") ?? null;
  const latestStep = runningStep ?? steps[steps.length - 1] ?? null;

  const totalDurationMs = steps.reduce(
    (sum, s) => sum + (s.durationMs ?? 0),
    0,
  );
  const distinctTools = [
    ...new Set(
      steps
        .map((s) => s.toolName)
        .filter((name): name is string => Boolean(name && name !== "load_space_context")),
    ),
  ];

  const activeHeadline = isStreaming
    ? latestStep
      ? latestStep.kind !== "thinking" && latestStep.detail
        ? `${latestStep.label} · ${latestStep.detail}`
        : `${latestStep.label}…`
      : fallbackLabel || t("status.thinking")
    : t("trace.completedSummary", {
        count: String(steps.length),
        duration: formatDuration(totalDurationMs),
      });

  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "group inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[12px] transition-colors hover:bg-muted/70",
          isStreaming ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {isStreaming ? (
          <Loader2
            className="size-3.5 shrink-0 animate-spin text-assistant-accent"
            aria-hidden
          />
        ) : (
          <CheckCircle2
            className="size-3.5 shrink-0 text-positive/80"
            aria-hidden
          />
        )}

        <span className="min-w-0 truncate font-medium">{activeHeadline}</span>

        {!isStreaming && distinctTools.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            <Wrench className="size-2.5" aria-hidden />
            {distinctTools[0]}
            {distinctTools.length > 1 ? ` +${distinctTools.length - 1}` : ""}
          </span>
        )}

        {isStreaming && latestStep?.toolName && (
          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-assistant px-1.5 py-0.5 font-mono text-[10px] text-assistant-accent ring-1 ring-assistant-border sm:inline-flex">
            <Wrench className="size-2.5" aria-hidden />
            {latestStep.toolName}
          </span>
        )}

        {isStreaming && elapsedSec > 0 && (
          <span className="num shrink-0 text-[11px] text-muted-foreground">
            {elapsedSec}s
          </span>
        )}

        {steps.length > 0 &&
          (expanded ? (
            <ChevronDown
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : (
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ))}
      </button>

      {expanded && steps.length > 0 && (
        <div className="mt-1.5 rounded-xl border bg-muted/35 px-3 py-2.5">
          <ol className="space-y-2">
            {steps.map((step) => (
              <li key={step.id} className="flex items-start gap-2 text-[12px]">
                <span className="mt-0.5 shrink-0">
                  {step.status === "running" ? (
                    <Loader2 className="size-3.5 animate-spin text-assistant-accent" />
                  ) : step.status === "error" ? (
                    <AlertCircle className="size-3.5 text-destructive" />
                  ) : (
                    <Check className="size-3.5 text-positive" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "font-medium",
                          step.status === "running"
                            ? "text-foreground"
                            : "text-foreground/85",
                        )}
                      >
                        {step.label}
                      </span>
                      {step.toolName && (
                        <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border/80">
                          {step.toolName}
                        </code>
                      )}
                    </div>
                    {step.durationMs != null && (
                      <span className="num shrink-0 text-[11px] text-muted-foreground">
                        {formatDuration(step.durationMs)}
                      </span>
                    )}
                  </div>
                  {step.detail && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-[17px] text-muted-foreground">
                      {step.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
