import z from "zod";
import {
  startDetachedAssistantTurn,
  subscribeToRun,
  type AssistantStreamEvent,
} from "@app/api/assistant";
import { preparedAttachmentSchema } from "@app/api/assistant-types";
import { getServerSession, resolveSessionOrgId } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const chatRequestSchema = z.object({
  threadId: z.string().min(1).nullish(),
  message: z.string().max(12_000).default(""),
  attachments: z.array(preparedAttachmentSchema).max(4).optional(),
  locale: z.enum(["es", "en"]).default("es"),
});

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = resolveSessionOrgId(session);
  if (!orgId) {
    return Response.json(
      { error: "No active organization selected" },
      { status: 412 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request payload",
        issues: parsed.error.issues.slice(0, 5),
      },
      { status: 400 },
    );
  }

  const { threadId, message, attachments, locale } = parsed.data;
  if (!message.trim() && (!attachments || attachments.length === 0)) {
    return Response.json(
      { error: "Message or attachment required" },
      { status: 400 },
    );
  }

  // Starts the run DETACHED on the server: closing the phone/tab will NOT kill it!
  const started = await startDetachedAssistantTurn({
    orgId,
    userId: session.user.id,
    threadId: threadId ?? null,
    message,
    attachments: attachments ?? [],
    locale,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      let keepAlive: ReturnType<typeof setInterval> | null = null;

      const finishStream = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      const send = (event: AssistantStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          finishStream();
          return;
        }
        if (
          event.type === "done" ||
          event.type === "error" ||
          event.type === "already_done"
        ) {
          finishStream();
        }
      };

      // Immediately notify client of threadId so sidebar & resume URL are synced
      send({
        type: "thread",
        threadId: started.threadId,
        title: started.threadTitle,
      });

      keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          finishStream();
        }
      }, 12_000);

      unsubscribe = subscribeToRun(started.run, send);

      // Client disconnecting ONLY unsubscribes this SSE stream; the server job keeps running!
      req.signal.addEventListener("abort", () => {
        finishStream();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
