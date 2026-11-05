import { type NextRequest } from "next/server";
import z from "zod";
import { db } from "@app/db";
import { ok, err } from "../_lib/api-response";

const bodySchema = z.object({
  email: z.email().max(254),
  // Honeypot: real users never fill it (hidden field in the splash form).
  website: z.string().max(0).optional(),
});

/* Best-effort in-memory rate limit per IP (per server instance). */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_HITS;
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Join Waitlist
 * @description Public endpoint used by the landing splash. Adds an email to
 * the waitlist. Idempotent: an active email returns `already: true`; a
 * soft-deleted one is restored.
 * @tag Waitlist
 * @openapi
 */
export async function POST(request: NextRequest) {
  if (rateLimited(clientIp(request))) {
    return err("Too many requests", 429, "RATE_LIMITED");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return err("Invalid body", 400, "INVALID_BODY");
  }
  if (raw && typeof raw === "object" && "email" in raw) {
    const r = raw as Record<string, unknown>;
    r.email = String(r.email ?? "").trim().toLowerCase();
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    // Honeypot filled: pretend success so bots don't retry.
    if (raw && typeof raw === "object" && (raw as Record<string, unknown>).website) {
      return ok({ joined: true, already: false });
    }
    return err("Invalid email", 400, "INVALID_EMAIL");
  }
  const { email } = parsed.data;

  try {
    const existing = await db.waitlist.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });
    if (existing && !existing.deletedAt) {
      return ok({ joined: true, already: true });
    }
    if (existing) {
      await db.waitlist.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          deletedBy: null,
          createdAt: new Date(),
          createdBy: null,
        },
      });
    } else {
      await db.waitlist.create({ data: { email } });
    }
    return ok({ joined: true, already: false }, 201);
  } catch (error) {
    // Unique race between findUnique and create: treat as already joined.
    if ((error as { code?: string })?.code === "P2002") {
      return ok({ joined: true, already: true });
    }
    console.error("[❌POST /api/v1/waitlist]", error);
    return err("Error joining the waitlist", 500, "SERVER_ERROR");
  }
}
