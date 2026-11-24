import z from "zod";
import { runAssistantTurn, type StreamEvent } from "@app/api/assistant";
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
      { error: "Invalid request payload", issues: parsed.error.issues.slice(0, 5) },
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      // Keep-alive comment every 12s while NVIDIA NIM is reasoning/extracting
      const keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 12_000);

      try {
        await runAssistantTurn({
          orgId,
          userId: session.user.id,
          threadId: threadId ?? null,
          message,
          attachments: attachments ?? [],
          locale,
          signal: req.signal,
          emit: send,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Assistant request failed";
        send({ type: "error", message: msg });
      } finally {
        clearInterval(keepAlive);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // Stream already closed by client abort
          }
        }
      }
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
