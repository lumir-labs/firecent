// SMTP email sending (nodemailer). Server-only.
//
// If SMTP is NOT configured the flow doesn't break: `lib/auth.ts` uses
// `logMailToConsole()` as a fallback, so the magic link remains usable locally
// even without an email provider yet.
//
// Configuration examples (apps/web/.env):
//   Brevo:   SMTP_HOST=smtp-relay.brevo.com  SMTP_PORT=587  SMTP_SECURE=false
//            SMTP_USER=<your-login>          SMTP_PASSWORD=<smtp-key>
//   Generic: SMTP_HOST=mail.yourdomain.com   SMTP_PORT=465  SMTP_SECURE=true
//   EMAIL_FROM="Stackgoat <no-reply@yourdomain.com>"
import type { Transporter } from "nodemailer";

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailConfig = {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from?: string;
  isConfigured: boolean;
};

/** Reads the SMTP config from the environment. `isConfigured` requires host + sender. */
export function getEmailConfig(): EmailConfig {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM;

  return {
    host,
    port,
    // 465 = implicit TLS; on 587 STARTTLS is negotiated.
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    user,
    password,
    from,
    isConfigured: Boolean(host && from),
  };
}

/** Is SMTP ready to send? */
export function isEmailConfigured(): boolean {
  return getEmailConfig().isConfigured;
}

let cachedTransport: Transporter | null = null;

async function getTransport(): Promise<Transporter> {
  if (cachedTransport) return cachedTransport;

  // Dynamic import on purpose: `lib/auth.ts` is imported from `proxy.ts`
  // (middleware), so we don't want to load nodemailer —or its Node APIs—
  // unless an email is actually going to be sent.
  const { createTransport } = await import("nodemailer");
  const { host, port, secure, user, password } = getEmailConfig();

  cachedTransport = createTransport({
    host,
    port,
    secure,
    auth: user && password ? { user, pass: password } : undefined,
  });

  return cachedTransport;
}

/**
 * Sends an email via SMTP. Throws if SMTP is not configured: the caller
 * decides the fallback (see `logMailToConsole`).
 */
export async function sendMail({ to, subject, text, html }: MailInput) {
  const config = getEmailConfig();
  if (!config.isConfigured) {
    throw new Error(
      "SMTP not configured: set SMTP_HOST and EMAIL_FROM in apps/web/.env",
    );
  }

  const transport = await getTransport();
  const info = await transport.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
  });

  return { messageId: info.messageId };
}

/**
 * HTML template for the magic-link email.
 * Layout table + inline styles: compatible with Brevo, Gmail, Outlook.
 */
export function magicLinkHtml({
  appName,
  url,
  minutes,
}: {
  appName: string;
  url: string;
  minutes: number;
}): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;padding:32px;">
<tr><td style="font-size:20px;font-weight:bold;color:#09090b;">${appName}</td></tr>
<tr><td style="padding-top:16px;font-size:15px;color:#27272a;">Click the button to sign in to your account. The link expires in ${minutes} minutes.</td></tr>
<tr><td align="center" style="padding:24px 0;">
<a href="${url}" style="display:inline-block;background-color:#09090b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 28px;border-radius:8px;">Sign in to ${appName}</a>
</td></tr>
<tr><td style="font-size:13px;color:#71717a;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${url}" style="color:#2563eb;word-break:break-all;">${url}</a></td></tr>
<tr><td style="padding-top:16px;font-size:13px;color:#71717a;">If you didn't request this access, ignore this message.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Development fallback: prints the email (with the actionable URL) to the
 * Next server console. Sends nothing.
 * NEVER prints in production (magic-link leak to host logs).
 */
export function logMailToConsole({ to, subject, text }: MailInput) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  const line = "─".repeat(78);
  console.log(
    [
      "",
      line,
      "📮  MAIL — console fallback (SMTP not configured)",
      `    To:      ${to}`,
      `    Subject: ${subject}`,
      "",
      text,
      line,
      "",
    ].join("\n"),
  );
}

