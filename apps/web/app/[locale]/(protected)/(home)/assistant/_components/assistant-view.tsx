"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeftRight,
  ArrowUp,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  Lock,
  Paperclip,
  Plus,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { trpc } from "@app/api/client";
import type {
  AssistantTraceStep,
  AssistantUiBlock,
  PreparedAttachment,
  StoredAttachmentMeta,
  TokenUsageSummary,
} from "@app/api/assistant-types";
import { FirecentMark } from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PdfPasswordRequiredError,
  PdfWrongPasswordError,
  prepareAttachmentFile,
} from "@/lib/assistant/file-parser";
import { cn } from "@/lib/utils";
import { AgentTraceInline } from "./agent-trace-inline";
import {
  AssistantUiBlocks,
  type ProposalStateMap,
} from "./assistant-ui-blocks";
import { StatementReviewSheet } from "./statement-review-sheet";

type LocalMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  attachments: StoredAttachmentMeta[];
  uiBlocks: AssistantUiBlock[];
  traceSteps?: AssistantTraceStep[];
  isStreaming?: boolean;
  streamStartedAt?: number;
  tokenUsage: TokenUsageSummary | null;
  createdAt: string;
};

type PendingPasswordPdf = {
  file: File;
  wrongPassword: boolean;
};

const ACCEPT_ATTR =
  ".pdf,.xlsx,.xls,.csv,.tsv,image/png,image/jpeg,image/webp,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

/** Safe React markdown renderer for short assistant prose (bold, code, bullets). */
function renderCompactMarkdown(text: string): ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: ReactNode[] = [];

  const renderInline = (line: string, keyPrefix: string): ReactNode[] => {
    const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
        return (
          <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
        return (
          <code
            key={`${keyPrefix}-c-${i}`}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      return <span key={`${keyPrefix}-t-${i}`}>{tok}</span>;
    });
  };

  let listItems: ReactNode[] = [];
  const flushList = (idx: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${idx}`} className="my-1.5 list-disc space-y-1 pl-5">
          {listItems}
        </ul>,
      );
      listItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(idx);
      return;
    }
    if (/^[-•*]\s+/.test(trimmed)) {
      listItems.push(
        <li key={`li-${idx}`}>{renderInline(trimmed.replace(/^[-•*]\s+/, ""), `l${idx}`)}</li>,
      );
      return;
    }
    flushList(idx);
    elements.push(
      <p key={`p-${idx}`} className={idx > 0 ? "mt-2" : undefined}>
        {renderInline(trimmed, `p${idx}`)}
      </p>,
    );
  });
  flushList(lines.length);

  return elements;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ kind }: { kind: StoredAttachmentMeta["kind"] }) {
  if (kind === "image" || kind === "pdf_images") {
    return <ImageIcon className="size-3.5 shrink-0 text-primary-text" />;
  }
  if (kind === "spreadsheet" || kind === "csv") {
    return <FileSpreadsheet className="size-3.5 shrink-0 text-positive" />;
  }
  return <FileText className="size-3.5 shrink-0 text-primary-text" />;
}

export function AssistantView() {
  const t = useTranslations("Assistant");
  const locale = (useLocale() === "en" ? "en" : "es") as "es" | "en";
  const utils = trpc.useUtils();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reviewProposalId, setReviewProposalId] = useState<string | null>(null);

  // Composer state
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [parsingFile, setParsingFile] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<PendingPasswordPdf | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Live streaming state
  const [streaming, setStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [optimisticUserMsg, setOptimisticUserMsg] =
    useState<LocalMessage | null>(null);
  const [streamingAssistant, setStreamingAssistant] = useState<{
    content: string;
    uiBlocks: AssistantUiBlock[];
    steps: AssistantTraceStep[];
    startedAt: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (!input) {
      el.style.height = "40px";
      el.style.overflowY = "hidden";
      return;
    }
    const maxHeight = 128;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(40, nextHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  const threadsQuery = trpc.assistant.listThreads.useQuery(undefined, {
    refetchInterval: (q) =>
      q.state.data?.threads.some((th) => th.isRunning) ? 5000 : false,
  });
  const threadQuery = trpc.assistant.getThread.useQuery(
    { threadId: activeThreadId ?? "", locale },
    { enabled: Boolean(activeThreadId), staleTime: 0 },
  );

  const reconcileMutation = trpc.assistant.reconcileProposal.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.assistant.getThread.invalidate(),
        utils.assistant.listThreads.invalidate(),
      ]);
      toast.success(t("blocks.refreshedToast"));
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelRunMutation = trpc.assistant.cancelRun.useMutation();

  const selectAccountMutation = trpc.assistant.selectProposalAccount.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.assistant.getThread.invalidate(),
        utils.assistant.listThreads.invalidate(),
      ]);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const dismissMutation = trpc.assistant.dismissProposal.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.assistant.getThread.invalidate(),
        utils.assistant.listThreads.invalidate(),
      ]);
      toast.success(t("blocks.dismissedToast"));
    },
  });

  const undoMutation = trpc.assistant.undoProposal.useMutation({
    onSuccess: async (res) => {
      await Promise.all([
        utils.assistant.getThread.invalidate(),
        utils.assistant.listThreads.invalidate(),
        utils.accounts.list.invalidate(),
        utils.accounts.get.invalidate(),
        utils.records.list.invalidate(),
        utils.dashboard.invalidate(),
      ]);
      toast.success(t("blocks.undoneToast", { count: String(res.revertedCount) }));
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteThreadMutation = trpc.assistant.deleteThread.useMutation({
    onSuccess: async (_, vars) => {
      if (activeThreadId === vars.threadId) {
        setActiveThreadId(null);
      }
      await utils.assistant.listThreads.invalidate();
      toast.success(t("threadDeleted"));
    },
  });

  const displayedMessages = useMemo<LocalMessage[]>(() => {
    const base: LocalMessage[] = activeThreadId
      ? (threadQuery.data?.messages ?? [])
      : [];
    const list = [...base];
    if (optimisticUserMsg) list.push(optimisticUserMsg);
    if (streamingAssistant) {
      list.push({
        id: "streaming-assistant",
        role: "ASSISTANT",
        content: streamingAssistant.content,
        attachments: [],
        uiBlocks: streamingAssistant.uiBlocks,
        traceSteps: streamingAssistant.steps,
        isStreaming: true,
        streamStartedAt: streamingAssistant.startedAt,
        tokenUsage: null,
        createdAt: new Date().toISOString(),
      });
    }
    return list;
  }, [
    activeThreadId,
    threadQuery.data?.messages,
    optimisticUserMsg,
    streamingAssistant,
  ]);

  const proposalStates: ProposalStateMap =
    threadQuery.data?.proposalStates ?? {};

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedMessages.length, streamingAssistant?.content, streamStatus]);

  const processFiles = useCallback(
    async (files: FileList | File[], password?: string) => {
      const list = Array.from(files).slice(0, 4 - attachments.length);
      if (list.length === 0) return;

      setParsingFile(true);
      try {
        const prepared: PreparedAttachment[] = [];
        for (const file of list) {
          try {
            const att = await prepareAttachmentFile(file, { password });
            prepared.push(att);
            setPendingPdf(null);
            setPdfPassword("");
          } catch (err) {
            if (err instanceof PdfPasswordRequiredError) {
              setPendingPdf({ file, wrongPassword: false });
              return;
            }
            if (err instanceof PdfWrongPasswordError) {
              setPendingPdf({ file, wrongPassword: true });
              return;
            }
            toast.error(
              err instanceof Error ? err.message : t("fileParseError"),
            );
          }
        }
        if (prepared.length > 0) {
          setAttachments((prev) => [...prev, ...prepared].slice(0, 4));
        }
      } finally {
        setParsingFile(false);
      }
    },
    [attachments.length, t],
  );

  const handleUnlockPdf = async () => {
    if (!pendingPdf || !pdfPassword.trim()) return;
    await processFiles([pendingPdf.file], pdfPassword);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      void processFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void processFiles(files);
    }
  };

  const consumeSseResponse = useCallback(
    async (
      res: Response,
      initialThreadId: string | null,
      initialStartedAt: number,
      signal: AbortSignal,
    ) => {
      const readOneStream = async (
        streamRes: Response,
        curThreadId: string | null,
        isReconnect: boolean,
      ): Promise<{ threadId: string | null; completed: boolean }> => {
        if (!streamRes.ok || !streamRes.body) {
          const errJson = await streamRes.json().catch(() => null);
          throw new Error(
            (errJson as { error?: string } | null)?.error ||
              `HTTP ${streamRes.status}`,
          );
        }

        if (isReconnect) {
          // Server replays full accumulated content & UI blocks on reconnect
          setStreamingAssistant((prev) => ({
            content: "",
            uiBlocks: [],
            steps: prev?.steps ?? [],
            startedAt: prev?.startedAt ?? initialStartedAt,
          }));
        }

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let resolvedThreadId = curThreadId;
        let completed = false;

        const handleEventLine = (rawLine: string) => {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) return;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) return;

          let evt:
            | { type: "thread"; threadId: string; title: string }
            | { type: "status"; phase: string; label: string }
            | { type: "trace_step"; step: AssistantTraceStep }
            | { type: "text_delta"; delta: string }
            | { type: "ui_block"; block: AssistantUiBlock }
            | { type: "done"; threadId: string; messageId: string }
            | { type: "already_done"; threadId: string }
            | { type: "error"; message: string };

          try {
            evt = JSON.parse(jsonStr);
          } catch {
            return;
          }

          if (evt.type === "thread") {
            resolvedThreadId = evt.threadId;
            setActiveThreadId(evt.threadId);
            void utils.assistant.listThreads.invalidate();
          } else if (evt.type === "status") {
            setStreamStatus(evt.label);
          } else if (evt.type === "trace_step") {
            const incoming = evt.step;
            setStreamingAssistant((prev) => {
              const curSteps = prev?.steps ?? [];
              const idx = curSteps.findIndex((s) => s.id === incoming.id);
              const nextSteps =
                idx >= 0
                  ? curSteps.map((s, i) => (i === idx ? incoming : s))
                  : [...curSteps, incoming];
              return {
                content: prev?.content ?? "",
                uiBlocks: prev?.uiBlocks ?? [],
                steps: nextSteps,
                startedAt: prev?.startedAt ?? initialStartedAt,
              };
            });
          } else if (evt.type === "text_delta") {
            setStreamStatus(null);
            setStreamingAssistant((prev) => ({
              content: (prev?.content ?? "") + evt.delta,
              uiBlocks: prev?.uiBlocks ?? [],
              steps: prev?.steps ?? [],
              startedAt: prev?.startedAt ?? initialStartedAt,
            }));
          } else if (evt.type === "ui_block") {
            setStreamingAssistant((prev) => ({
              content: prev?.content ?? "",
              uiBlocks: [...(prev?.uiBlocks ?? []), evt.block],
              steps: prev?.steps ?? [],
              startedAt: prev?.startedAt ?? initialStartedAt,
            }));
          } else if (evt.type === "error") {
            completed = true;
            toast.error(evt.message);
          } else if (evt.type === "done" || evt.type === "already_done") {
            resolvedThreadId = evt.threadId;
            completed = true;
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl = buffer.indexOf("\n");
            while (nl !== -1) {
              handleEventLine(buffer.slice(0, nl));
              buffer = buffer.slice(nl + 1);
              nl = buffer.indexOf("\n");
            }
          }
          if (buffer.trim()) handleEventLine(buffer);
        } catch (err) {
          // If the user didn't abort and we know the threadId, let the outer loop
          // transparently reconnect to the detached server run (e.g. proxy/mobile drop).
          if (signal.aborted || !resolvedThreadId) {
            throw err;
          }
        }

        return { threadId: resolvedThreadId, completed };
      };

      let state = await readOneStream(res, initialThreadId, false);

      // Transparent reconnect loop for long-running (up to 10m) runs when a proxy
      // or mobile network drops an open SSE socket before `done` arrives.
      let reconnects = 0;
      while (
        !state.completed &&
        state.threadId &&
        !signal.aborted &&
        reconnects < 20
      ) {
        reconnects += 1;
        await new Promise((r) => setTimeout(r, 1500));
        if (signal.aborted) break;
        try {
          const nextRes = await fetch(
            `/api/assistant/stream?threadId=${encodeURIComponent(state.threadId)}`,
            {
              method: "GET",
              credentials: "include",
              signal,
            },
          );
          state = await readOneStream(nextRes, state.threadId, true);
        } catch (err) {
          if (signal.aborted) throw err;
          if (reconnects >= 20) throw err;
        }
      }

      if (state.threadId) {
        setActiveThreadId(state.threadId);
        await Promise.all([
          utils.assistant.listThreads.invalidate(),
          utils.assistant.getThread.invalidate({
            threadId: state.threadId,
            locale,
          }),
        ]);
      }
    },
    [locale, utils],
  );

  // Cross-device live resume: if user opens a thread that is currently running
  // on the server (e.g. started on phone and opened on desktop), attach via SSE!
  const attachedThreadRef = useRef<string | null>(null);
  const runningThreadId = threadQuery.data?.isRunning
    ? threadQuery.data.id
    : null;
  const runningStartedAt = threadQuery.data?.runningStartedAt ?? null;

  useEffect(() => {
    if (!runningThreadId) return;
    if (streaming || attachedThreadRef.current === runningThreadId) return;

    attachedThreadRef.current = runningThreadId;
    const controller = new AbortController();
    abortRef.current = controller;
    const startTs = runningStartedAt ?? Date.now();

    void (async () => {
      try {
        const res = await fetch(
          `/api/assistant/stream?threadId=${encodeURIComponent(runningThreadId)}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          },
        );
        setStreaming(true);
        setStreamStatus(t("status.thinking"));
        setStreamingAssistant({
          content: "",
          uiBlocks: [],
          steps: [],
          startedAt: startTs,
        });
        await consumeSseResponse(res, runningThreadId, startTs, controller.signal);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          toast.error(err instanceof Error ? err.message : t("sendError"));
        }
      } finally {
        if (attachedThreadRef.current === runningThreadId) {
          attachedThreadRef.current = null;
        }
        abortRef.current = null;
        setStreaming(false);
        setStreamStatus(null);
        setStreamingAssistant(null);
      }
    })();
  }, [consumeSseResponse, runningStartedAt, runningThreadId, streaming, t]);

  const sendMessage = useCallback(
    async (overridePrompt?: string) => {
      if (streaming) return;
      const text = (overridePrompt ?? input).trim();
      const outgoingAttachments = overridePrompt ? [] : attachments;
      if (!text && outgoingAttachments.length === 0) return;

      const userStoredMeta: StoredAttachmentMeta[] = outgoingAttachments.map(
        (a) => ({
          name: a.name,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          kind: a.kind,
          pageCount: a.pageCount,
          rowCount: a.rowCount,
        }),
      );

      const nowTs = Date.now();
      setInput("");
      if (!overridePrompt) setAttachments([]);
      setStreaming(true);
      setStreamStatus(
        outgoingAttachments.length > 0
          ? t("status.readingStatement")
          : t("status.thinking"),
      );
      setOptimisticUserMsg({
        id: `opt-${nowTs}`,
        role: "USER",
        content: text || t("defaultAnalyzePrompt"),
        attachments: userStoredMeta,
        uiBlocks: [],
        tokenUsage: null,
        createdAt: new Date().toISOString(),
      });
      setStreamingAssistant({
        content: "",
        uiBlocks: [],
        steps: [],
        startedAt: nowTs,
      });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            threadId: activeThreadId,
            message: text,
            attachments: outgoingAttachments,
            locale,
          }),
        });

        await consumeSseResponse(res, activeThreadId, nowTs, controller.signal);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          toast.error(err instanceof Error ? err.message : t("sendError"));
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        setStreamStatus(null);
        setOptimisticUserMsg(null);
        setStreamingAssistant(null);
      }
    },
    [
      activeThreadId,
      attachments,
      consumeSseResponse,
      input,
      locale,
      streaming,
      t,
    ],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const stopStreaming = () => {
    if (activeThreadId) {
      cancelRunMutation.mutate({ threadId: activeThreadId });
    }
    abortRef.current?.abort();
  };

  const detachStreamOnly = () => {
    attachedThreadRef.current = null;
    abortRef.current?.abort();
    setStreaming(false);
    setStreamStatus(null);
    setOptimisticUserMsg(null);
    setStreamingAssistant(null);
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const startNewChat = () => {
    // Switching to New Chat detaches the UI stream WITHOUT killing the background server run!
    if (streaming) detachStreamOnly();
    setActiveThreadId(null);
    setAttachments([]);
    setPendingPdf(null);
    setHistoryOpen(false);
  };

  const threads = threadsQuery.data?.threads ?? [];
  const unmatchedTransferCount = threadsQuery.data?.unmatchedTransferCount ?? 0;

  const isInThread = Boolean(activeThreadId) || displayedMessages.length > 0;

  const threadListContent = (
    <div className="space-y-1">
      {threadsQuery.isLoading ? (
        <div className="space-y-2 p-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : threads.length === 0 ? (
        <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
          {t("noThreadsYet")}
        </p>
      ) : (
        threads.map((th) => {
          const active = activeThreadId === th.id;
          return (
            <div
              key={th.id}
              className={cn(
                "group flex items-center gap-1 rounded-xl px-2.5 py-2 transition-colors",
                active ? "bg-accent text-foreground" : "hover:bg-accent/60",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (streaming && activeThreadId !== th.id) {
                    detachStreamOnly();
                  }
                  setActiveThreadId(th.id);
                  setHistoryOpen(false);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[13px] font-medium">{th.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{t("messagesCount", { count: String(th.messageCount) })}</span>
                  {th.isRunning && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-1.5 py-0.2 text-[10px] font-semibold text-primary-text">
                      <Loader2 className="size-2.5 animate-spin" />
                      {t("runningTag")}
                    </span>
                  )}
                  {!th.isRunning && th.activeProposal && (
                    <span className="inline-flex items-center rounded-full bg-assistant px-1.5 py-0.2 text-[10px] font-semibold text-assistant-accent ring-1 ring-assistant-border">
                      {t("pendingTag")}
                    </span>
                  )}
                </div>
              </button>
              <button
                type="button"
                aria-label={t("deleteThread")}
                onClick={() => deleteThreadMutation.mutate({ threadId: th.id })}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div
      className="relative flex min-h-[calc(100dvh-8.5rem)] flex-col lg:min-h-[calc(100dvh-3rem)]"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {/* Hidden multimodal file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            void processFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />

      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-primary bg-card px-10 py-8 text-center shadow-lg">
            <Upload className="size-10 text-primary-text" />
            <p className="mt-3 text-[16px] font-semibold">
              {t("dropOverlayTitle")}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t("dropOverlaySubtitle")}
            </p>
          </div>
        </div>
      )}

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 bg-background/90 px-4 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-assistant text-assistant-accent ring-1 ring-assistant-border">
            <FirecentMark className="h-4" />
          </span>
          <h1 className="truncate text-[17px] font-semibold">
            {isInThread && threadQuery.data?.title
              ? threadQuery.data.title
              : t("title")}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={startNewChat}
            aria-label={t("newChat")}
          >
            <Plus className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={() => setHistoryOpen(true)}
            aria-label={t("history")}
          >
            <History className="size-5" />
          </Button>
        </div>
      </header>

      {/* Desktop header */}
      <header className="hidden items-center justify-between gap-4 pt-6 pb-4 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-assistant-border bg-assistant">
            <FirecentMark className="h-5" />
          </span>
          <div>
            <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.02em]">
              {t("title")}
            </h1>
            <p className="text-[13px] text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={startNewChat}
          className="h-10 rounded-xl px-4 text-[13px] font-semibold"
        >
          <Plus className="mr-1.5 size-4" />
          {t("newChat")}
        </Button>
      </header>

      {/* Main 2-column grid */}
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-12 lg:gap-6">
        {/* Desktop left threads sidebar */}
        <aside className="hidden lg:col-span-4 lg:flex lg:flex-col lg:gap-4">
          <div className="rounded-3xl border bg-card p-3">
            <p className="px-2.5 pt-1 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t("conversations")}
            </p>
            <div className="max-h-[420px] overflow-y-auto">
              {threadListContent}
            </div>

            {unmatchedTransferCount > 0 && (
              <div className="mt-3 border-t pt-3">
                <button
                  type="button"
                  onClick={() =>
                    void sendMessage(t("prompts.unmatchedTransfers"))
                  }
                  className="block w-full rounded-2xl border border-assistant-border bg-assistant p-3 text-left transition-colors hover:opacity-95"
                >
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-assistant-accent">
                      <ArrowLeftRight className="size-3.5" />
                      {t("unmatchedCardTitle")}
                    </span>
                    <span className="num rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">
                      {unmatchedTransferCount}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {t("unmatchedCardBody")}
                  </p>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right column: conversation canvas + composer */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 lg:col-span-8 lg:px-0">
          {!isInThread ? (
            /* Empty / New Chat Canvas */
            <div className="flex-1 space-y-5 pt-2 pb-6">
              <div className="rounded-3xl border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-assistant-border bg-assistant">
                    <FirecentMark className="h-6" />
                  </span>
                  <div>
                    <h2 className="text-[19px] font-semibold tracking-[-0.015em]">
                      {t("welcomeTitle")}
                    </h2>
                    <p className="text-[13px] text-muted-foreground">
                      {t("welcomeSubtitle")}
                    </p>
                  </div>
                </div>

                {/* Statement Dropzone Card */}
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className="mt-5 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-assistant-border bg-assistant/60 px-4 py-6 text-center transition-colors hover:bg-assistant"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-card text-assistant-accent shadow-xs ring-1 ring-assistant-border">
                    <Upload className="size-5" />
                  </span>
                  <p className="mt-3 text-[14px] font-semibold text-foreground">
                    {t("uploadCtaTitle")}
                  </p>
                  <p className="mt-1 max-w-[380px] text-[12px] text-muted-foreground">
                    {t("uploadCtaBody")}
                  </p>
                </button>

                {/* Unmatched transfers notice on mobile */}
                {unmatchedTransferCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      void sendMessage(t("prompts.unmatchedTransfers"))
                    }
                    className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-accent lg:hidden"
                  >
                    <div className="flex items-center gap-2.5">
                      <ArrowLeftRight className="size-4 text-primary-text" />
                      <span className="text-[13px] font-medium">
                        {t("unmatchedMobileBanner", {
                          count: String(unmatchedTransferCount),
                        })}
                      </span>
                    </div>
                    <span className="text-[12px] font-semibold text-primary-text">
                      {t("see")}
                    </span>
                  </button>
                )}

                {/* Quick prompts */}
                <div className="mt-5">
                  <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {t("tryAsking")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        t("prompts.monthOverview"),
                        t("prompts.unmatchedTransfers"),
                        t("prompts.topSpending"),
                      ] as const
                    ).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="rounded-2xl border bg-background px-3.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-accent"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Active Thread Messages */
            <div className="flex-1 pb-6">
              <div className="rounded-3xl lg:border lg:bg-card lg:p-6">
                <div className="mb-4 hidden items-center justify-between border-b pb-3 lg:flex">
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-semibold">
                      {threadQuery.data?.title ?? t("title")}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Lock className="size-3" />
                      {t("privateChatNote")}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    {t("readOnlyBadge")}
                  </span>
                </div>

                {threadQuery.isLoading && displayedMessages.length === 0 ? (
                  <div className="space-y-4 py-4">
                    <Skeleton className="ml-auto h-10 w-56 rounded-2xl" />
                    <Skeleton className="h-28 w-full rounded-2xl" />
                  </div>
                ) : (
                  <div className="space-y-5">
                    {displayedMessages.map((m) => {
                      if (m.role === "USER") {
                        return (
                          <div key={m.id} className="flex justify-end">
                            <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-sm bg-muted px-4 py-2.5 text-[14px] leading-[21px] text-foreground">
                              {m.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {m.attachments.map((att, i) => (
                                    <span
                                      key={`${att.name}-${i}`}
                                      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-[12px] font-medium"
                                    >
                                      <AttachmentIcon kind={att.kind} />
                                      <span className="max-w-[180px] truncate">
                                        {att.name}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {m.content && (
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const msgSteps =
                        m.traceSteps ?? m.tokenUsage?.steps ?? [];
                      const isLiveMsg = Boolean(m.isStreaming);

                      return (
                        <div key={m.id} className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-assistant-border bg-assistant",
                              isLiveMsg && "animate-pulse",
                            )}
                          >
                            <FirecentMark className="h-4" />
                          </span>
                          <div className="min-w-0 flex-1 text-[14px] leading-[22px] text-foreground">
                            <AgentTraceInline
                              steps={msgSteps}
                              isStreaming={isLiveMsg}
                              fallbackLabel={isLiveMsg ? streamStatus : null}
                              startedAt={m.streamStartedAt}
                            />

                            {m.content && (
                              <div className="prose-sm max-w-none">
                                {renderCompactMarkdown(m.content)}
                              </div>
                            )}

                            <AssistantUiBlocks
                              blocks={m.uiBlocks}
                              proposalStates={proposalStates}
                              selectingProposalId={
                                selectAccountMutation.isPending
                                  ? selectAccountMutation.variables?.proposalId
                                  : null
                              }
                              undoingProposalId={
                                undoMutation.isPending
                                  ? undoMutation.variables?.proposalId
                                  : null
                              }
                              refreshingProposalId={
                                reconcileMutation.isPending
                                  ? reconcileMutation.variables?.proposalId
                                  : null
                              }
                              onSelectAccount={(proposalId, accountId) =>
                                selectAccountMutation.mutate({
                                  proposalId,
                                  accountId,
                                  locale,
                                })
                              }
                              onOpenProposal={(proposalId) =>
                                setReviewProposalId(proposalId)
                              }
                              onRefreshProposal={(proposalId) =>
                                reconcileMutation.mutate({ proposalId, locale })
                              }
                              onDismissProposal={(proposalId) =>
                                dismissMutation.mutate({ proposalId })
                              }
                              onUndoProposal={(proposalId) =>
                                undoMutation.mutate({ proposalId })
                              }
                              onTriggerUpload={triggerFilePicker}
                              onSendPrompt={(p) => void sendMessage(p)}
                            />

                            {m.tokenUsage && m.tokenUsage.totalTokens > 0 && (
                              <p className="num mt-2 text-[11px] text-muted-foreground/75">
                                {m.tokenUsage.totalTokens.toLocaleString()} tokens
                                {m.tokenUsage.cachedTokens > 0
                                  ? ` · ${Math.round((m.tokenUsage.cachedTokens / Math.max(1, m.tokenUsage.promptTokens)) * 100)}% cached`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sticky Composer */}
          <div className="sticky bottom-16 z-20 -mx-4 mt-auto border-t border-border/60 bg-background/95 px-4 pt-2 pb-2 backdrop-blur-md lg:bottom-0 lg:mx-0 lg:border-t-0 lg:bg-background/90 lg:px-0 lg:pb-3">
            <div className="rounded-2xl border bg-card p-2 shadow-sm lg:shadow-none">
              {/* Encrypted PDF password inline bar */}
              {pendingPdf && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[12px]">
                  <Lock className="size-4 shrink-0 text-warning" />
                  <span className="font-medium">
                    {pendingPdf.wrongPassword
                      ? t("pdfWrongPassword", { name: pendingPdf.file.name })
                      : t("pdfPasswordNeeded", { name: pendingPdf.file.name })}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Input
                      type="password"
                      value={pdfPassword}
                      onChange={(e) => setPdfPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleUnlockPdf();
                        }
                      }}
                      placeholder={t("pdfPasswordPlaceholder")}
                      className="h-8 w-40 rounded-lg bg-card text-[12px]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleUnlockPdf()}
                      className="h-8 rounded-lg px-3 text-[12px]"
                    >
                      {t("unlock")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingPdf(null);
                        setPdfPassword("");
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Attached files chips */}
              {(attachments.length > 0 || parsingFile) && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
                  {attachments.map((att, idx) => (
                    <div
                      key={`${att.name}-${idx}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-2.5 py-1.5 text-[12px]"
                    >
                      <AttachmentIcon kind={att.kind} />
                      <span className="max-w-[180px] truncate font-medium">
                        {att.name}
                      </span>
                      <span className="num text-[11px] text-muted-foreground">
                        {att.kind === "pdf_text" && att.pageCount
                          ? t("attBadgePdfText", { pages: String(att.pageCount) })
                          : att.kind === "pdf_images" && att.images
                            ? t("attBadgePdfScan", { pages: String(att.images.length) })
                            : att.rowCount
                              ? t("attBadgeRows", { rows: String(att.rowCount) })
                              : formatFileSize(att.sizeBytes)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        aria-label={t("removeAttachment")}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {parsingFile && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-2.5 py-1.5 text-[12px] text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      {t("parsingFile")}
                    </span>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={streaming || parsingFile}
                  onClick={triggerFilePicker}
                  aria-label={t("attachFile")}
                  className="size-10 shrink-0 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Paperclip className="size-5" />
                </Button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  disabled={streaming}
                  placeholder={t("composerPlaceholder")}
                  className="max-h-32 min-h-10 min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-2 text-[15px] leading-6 outline-none placeholder:truncate placeholder:text-muted-foreground sm:text-[14px]"
                />

                {streaming ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={stopStreaming}
                    aria-label={t("stop")}
                    className="size-10 shrink-0 rounded-xl"
                  >
                    <Square className="size-4 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      parsingFile ||
                      (!input.trim() && attachments.length === 0)
                    }
                    aria-label={t("send")}
                    className="size-10 shrink-0 rounded-xl"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </form>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              {t("disclaimer")}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile past conversations sheet */}
      <ResponsiveSheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title={t("conversations")}
        closeLabel={t("review.close")}
      >
        <div className="px-4 pb-4">{threadListContent}</div>
      </ResponsiveSheet>

      {/* Separate wide Transactions Review Drawer / Modal */}
      <StatementReviewSheet
        proposalId={reviewProposalId}
        onClose={() => setReviewProposalId(null)}
        onApplied={() => {
          void utils.assistant.getThread.invalidate();
          void utils.assistant.listThreads.invalidate();
        }}
        onRequestUploadPrevious={triggerFilePicker}
      />
    </div>
  );
}
