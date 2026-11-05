# StackGoat — User guide

This is the human walkthrough of everything the product can do, screen by screen.
No code knowledge required. If you are a developer looking to extend the
boilerplate, start with `docs/README.md` instead.

---

## 1. Getting in

There are no passwords. Two ways to sign in, both from the login page:

- **Magic link** — type your email, press the button, and check your inbox.
  The link logs you in (or creates your account on the very first use) and
  expires in 15 minutes.
- **Google** — one click with your Google account.

The first time you sign in, a short 3-step onboarding wizard greets you: a
welcome, your preferences, and the name of your first **organization** (your
workspace, e.g. "Acme Inc"). After that you land on the dashboard.

You can switch the interface language (ES/EN) and theme (light/dark/system)
anywhere you see the language and theme buttons — including the public landing.

## 2. Your organization

Open **Organization** in the sidebar. You will see:

- The org profile: name, slug, ID, description, creation date.
- **Members** — everyone who belongs to the org and their role (owner/admin/member).
- **API keys** — a link to the key manager (section 5 below).
- **Invitations** — the invite manager (section 3 below).

### Switching organizations

If you belong to more than one organization, a switcher appears in the top
header. Pick another org from the dropdown and everything you see (members,
keys, organization profile) follows the active one. The choice is remembered
per session.

## 3. Inviting people (teams)

1. In **Organization → Invitations**, type an email and pick a role
   (member / admin / owner) and press **Send invitation**.
2. The person receives an email with an **accept link, valid for 48 hours**.
   No account is created for them until THEY accept — no ghost users.
3. Once they accept, they show up under **Members**.

Good to know:

- Any organization member can invite and see invites; only privileged roles
  can cancel them.
- Inviting an email that is already a member tells you so, politely.
- You can **cancel** a pending invitation at any time (the link dies with it).
- Expired or accepted invitations are labeled in the table.
- Need to be a member yourself first: anonymous visitors who open an invite
  link are sent to login first, then the invitation is accepted on return.

## 4. Protecting your account with 2FA

Under **Profile → Two-factor authentication**:

1. Press **Enable 2FA**. Scan the QR code with your authenticator app
   (a manual `otpauth://` URI is shown below it as fallback). **Save the
   backup codes shown on screen — they appear only once.**
2. Add the URI to your authenticator app (Google Authenticator, 1Password,
   Authy…). Copy the URI or generate a QR from it — it is shown only once.
3. Enter a 6-digit code from the app to confirm. **Save the backup codes
   somewhere safe — they are never shown again.**

From now on, signing in takes two steps: magic link (or Google), then a code
from your app. If you lose your authenticator, any backup code lets you in
(each works exactly once). The challenge expires after 10 minutes — just
request a new link.

The mobile app asks for the same code: after opening the magic link, return
to the app and enter the TOTP (or a backup code) on the verification screen.
Turning 2FA off from Profile asks for a fresh code first (TOTP or backup).

## 5. API keys and AI/MCP clients

Organization → **API keys**. Keys let external tools (an AI agent, a CLI, a
CI job) talk to your org's data through the MCP server.

- **Create** — give it a name and an optional expiration. The secret
  (`sk_…`) is displayed **exactly once**: copy it now, treat it like a password.
- **Revoke** — disables the key immediately (soft-revoked, kept for audit).
- **Rotate** — issues a new secret and revokes the old one in one step,
  without downtime.
- Keys are born with the two standard MCP scopes (read org, read members).
  A key with no scopes authorizes nothing (deny-by-default).

Connecting an AI client: point it at `http(s)://<host>:3001/mcp` with the
header `Authorization: Bearer sk_…`. The step-by-step (including curl) is in
`docs/MCP.md`.

## 6. Your profile

**Profile** lets you edit your name fields, switch language and theme, and —
in the danger zone — delete your account. Email is read-only by design:
changing a login email would bypass verification, so it is not offered.

On the **mobile app** you can edit your first/last names from the profile
tab (pencil icon), pick language and theme, and sign out. Editing on one
surface shows up everywhere.

## 7. Deleting your account

**Profile → Danger zone → Delete my account.** After confirming:

- Your personal data is anonymized and your email is released (you could
  sign up fresh again with the same address).
- All your sessions, OAuth accounts, organization memberships, sent
  invitations, created API keys, 2FA secrets, pending email verifications and
  role assignments are revoked and purged.

This affects the live database; backups and provider-side logs are the
operator's responsibility (see the README disclaimer).

## 8. The admin area

Users with the right permissions see an **Admin** area: KPI dashboard, user
management (inline editing, role assignment, soft delete), roles, the
permission catalog, and organizations. Everything there is gated by
permissions — if you lack one, you see a clear access-denied card instead of
a broken screen, and the sidebar simply hides what you cannot use.

## 9. What lives where (route map)

| URL | What |
|---|---|
| `/en/landing` | Public marketing/demo page |
| `/en/auth/login` | Sign in (magic link / Google, 2FA step) |
| `/en/auth/reset` | Request a fresh magic link (also verifies your email) |
| `/en/onboarding` | First-time wizard (creates your organization) |
| `/en` | Your dashboard (demo data) |
| `/en/profile` | Profile, preferences, 2FA, delete account |
| `/en/organization` | Org profile, members, invitations |
| `/en/organization/api-keys` | API key manager |
| `/en/billing` | Billing placeholder (no payments wired) |
| `/en/invitations/accept?id=…` | Invitation acceptance (from email) |
| `/en/admin/…` | Admin area (permission-gated) |
| `/en/api-docs` | REST API reference |
| `/en/privacy`, `/en/terms` | Template legal pages (replace before production) |

Swap `/en` for `/es` for Spanish — the app is bilingual by design.

## 10. Mobile app

The Expo app covers: magic-link and Google sign-in (including the 2FA code
step), the dashboard tab with a live API health check, search and favorites
tabs, and the profile tab (names editing, language, theme, sign out, UI kit
catalog).

## 11. Going deeper

- `docs/README.md` — developer map of the monorepo
- `docs/MCP.md` — MCP server: keys, clients, adding tools
- `docs/COMPONENTS.md` — the reusable UI catalog
- `docs/CONVENTIONS.md` — how the repo is wired (i18n, guards, 2FA internals)
