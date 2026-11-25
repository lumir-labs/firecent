import { NextResponse } from "next/server";
import { dispatchDueDailyNotifications } from "@app/api/push-notifications";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

async function handleCron(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dispatchDueDailyNotifications();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/notifications] dispatch failed:", err);
    return NextResponse.json(
      { ok: false, error: "Dispatch failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handleCron(req);
}

export async function GET(req: Request) {
  return handleCron(req);
}
