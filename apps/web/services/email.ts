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
//   EMAIL_FROM="Firecent <no-reply@yourdomain.com>"
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

/** Content-ID of the inline logo. Templates reference it as `cid:${EMAIL_LOGO_CID}`. */
export const EMAIL_LOGO_CID = "logo@firecent";
/** Rendered size of the logo (the PNG in email-logo.ts is 2×). */
const EMAIL_LOGO_WIDTH = 26;
const EMAIL_LOGO_HEIGHT = 40;

/**
 * Sends an email via SMTP. Throws if SMTP is not configured: the caller
 * decides the fallback (see `logMailToConsole`).
 * If the HTML references the logo CID, the logo is attached inline.
 */
export async function sendMail({ to, subject, text, html }: MailInput) {
  const config = getEmailConfig();
  if (!config.isConfigured) {
    throw new Error(
      "SMTP not configured: set SMTP_HOST and EMAIL_FROM in apps/web/.env",
    );
  }

  const attachments = [];
  if (html?.includes(`cid:${EMAIL_LOGO_CID}`)) {
    const { EMAIL_LOGO_PNG_BASE64 } = await import("./email-logo");
    attachments.push({
      filename: "logo.png",
      content: EMAIL_LOGO_PNG_BASE64,
      encoding: "base64",
      contentType: "image/png",
      cid: EMAIL_LOGO_CID,
      contentDisposition: "inline" as const,
    });
  }

  const transport = await getTransport();
  const info = await transport.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
    attachments,
  });

  return { messageId: info.messageId };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Brand palette (packages/lib/src/tokens/tokens.css), inlined: email
// clients don't support CSS variables.
const C = {
  page: "#f8fafc",
  card: "#ffffff",
  border: "#e2e8f0",
  ink: "#0b1220",
  body: "#334155",
  muted: "#64748b",
  primary: "#5e54f0",
  primaryInk: "#ffffff",
  // Brand gradient (icon.svg): orange → violet.
  accentFrom: "#ff7a3d",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * HTML template for the magic-link email.
 * Layout tables + inline styles: compatible with Brevo, Gmail, Outlook.
 * The logo is the inline CID attachment `sendMail()` adds.
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
  const name = escapeHtml(appName);
  const href = escapeHtml(url);
  const preheader = `Your sign-in link for ${name}. It expires in ${minutes} minutes.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Sign in to ${name}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
<tr><td align="center" style="padding:40px 16px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

<!-- Brand -->
<tr><td align="center" style="padding-bottom:24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="cid:${EMAIL_LOGO_CID}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" alt="" style="display:block;border:0;width:${EMAIL_LOGO_WIDTH}px;height:${EMAIL_LOGO_HEIGHT}px;"></td>
<td style="vertical-align:middle;padding-left:12px;font-family:${FONT};font-size:20px;font-weight:700;letter-spacing:-0.3px;color:${C.ink};">${name}</td>
</tr></table>
</td></tr>

<!-- Card -->
<tr><td style="background-color:${C.card};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:4px;line-height:4px;font-size:0;background-color:${C.primary};background-image:linear-gradient(90deg,${C.accentFrom},${C.primary});border-radius:16px 16px 0 0;">&nbsp;</td></tr>
<tr><td style="padding:40px 40px 32px;font-family:${FONT};">

<h1 style="margin:0 0 12px;font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:${C.ink};">Sign in to your account</h1>
<p style="margin:0 0 32px;font-size:16px;line-height:24px;color:${C.body};">Use the button below to sign in to ${name}. No password needed.</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-radius:10px;background-color:${C.primary};">
<a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:${C.primaryInk};text-decoration:none;border-radius:10px;">Sign in to ${name} &rarr;</a>
</td>
</tr></table>

<p style="margin:24px 0 0;font-size:14px;line-height:20px;color:${C.muted};">This link expires in <strong style="color:${C.body};">${minutes} minutes</strong> and can only be used once.</p>

</td></tr>
<tr><td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background-color:${C.border};">&nbsp;</div></td></tr>
<tr><td style="padding:24px 40px 32px;font-family:${FONT};">
<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${C.muted};">Button not working? Copy and paste this link into your browser:</p>
<p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${href}" target="_blank" style="color:${C.body};text-decoration:underline;">${href}</a></p>
</td></tr>
</table>
</td></tr>

<!-- Footer -->
<tr><td align="center" style="padding:24px 16px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">
If you didn't request this email, you can safely ignore it.<br>
&copy; ${new Date().getFullYear()} ${name}
</td></tr>

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

