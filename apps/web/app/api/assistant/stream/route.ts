import {
  getActiveRunForUser,
  subscribeToRun,
  type AssistantStreamEvent,
} from "@app/api/assistant";
import { p } from "@app/api/permissions";
import { getServerSession, resolveSessionOrgId } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 660;

/**
 * Attaches any device (desktop, mobile, or reopened tab) to an in-flight
 * detached assistant run for `threadId`, immediately replaying buffered steps,
 * streamed text, and UI blocks and continuing live until `done`.
 */
export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = (session.user as { permissions?: string[] }).permissions ?? [];
  if (perms.length > 0 && !perms.includes(p.dashboard.basic)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = resolveSessionOrgId(session);
  if (!orgId) {
    return Response.json(
      { error: "No active organization selected" },
      { status: 412 },
    );
  }

  const url = new URL(req.url);
  const threadId = url.searchParams.get("threadId")?.trim();
  if (!threadId) {
    return Response.json({ error: "Missing threadId" }, { status: 400 });
  }

  const run = getActiveRunForUser({
    threadId,
    orgId,
    userId: session.user.id,
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

      if (!run) {
        send({ type: "already_done", threadId });
        return;
      }

      keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          finishStream();
        }
      }, 12_000);

      unsubscribe = subscribeToRun(run, send);

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
