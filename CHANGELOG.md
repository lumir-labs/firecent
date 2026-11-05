# Changelog

All notable changes to the StackGoat boilerplate. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Changed

- License: support contact is now `support@lumirlabs.com` and the
  major-version repurchase clause is gone.

### Fixed

- Web build under isolated installs (Docker/Railpack, `bun install --linker
  isolated`): Tailwind entry imports moved to `apps/web/app/globals.css`, so
  CSS no longer fails to resolve `tailwindcss` from `packages/lib/src`.
- Web favicon: replaced the missing `/logo_cl.svg` link with the StackGoat icon
  (`apps/web/public/icon.png`).

## [1.0.0] — 2026-10-16

First sellable cut: security baseline, teams/DSR/2FA features, full English,
human manual. Verified: 64/64 tests (40 web + 24 mobile), clean typechecks
(web/mobile/api/db/mcp), live end-to-end runs (invitations, org switch,
account deletion, 2FA on web and mobile — magic-link + Google, including
app-switch resilience).

### Security

- `getUser` requires `p.users.read`; `updateUser` whitelisted (no
  `email`/`emailVerified`/`deletedAt` mass-assignment).
- ApiKey scopes deny-by-default (empty `scopes` = no access); new UI keys are
  born with both MCP scopes; breaking-change note in `docs/MCP.md`.
- Magic-link secret never reaches prod logs (throws without SMTP); real
  rate-limit on auth (magic-link 5/min).
- `tokens --check` CRLF-proof on Windows; generated CSS pinned to LF.
- Security headers (CSP/HSTS/X-Frame/Referrer), `/privacy` + `/terms` template
  pages, DSR export + real deletion stubs replaced by the real thing (below).
- PII log hygiene with a `check-logs.mjs` CI guard.

### Added

- **Org invitations**: email flow with 48 h links, role picker, cancel/revoke,
  `/invitations/accept` page (deleted the old shadow-user creator).
- **Organization switcher** in web + admin headers (memberships only).
- **tRPC `users` router** (`getOwn`/`updateOwn`, strict schema) + name editing
  in the mobile profile tab.
- **Real account deletion**: 7-step transaction (sessions, OAuth accounts,
  memberships, sent invitations, API keys, email verifications, 2FA secrets
  purged; user anonymized; email freed for re-signup), `deletedAt` session
  guard, admin `deleteUser` revokes sessions, `db:purge` script, danger-zone UI.
- **TOTP 2FA** with backup codes: enable/verify/disable card in profile, TOTP
  step in login (incl. magic-link challenge), backup-code login path.
- Mobile 2FA code step: the expo `authClient` carries `twoFactorClient()`
  and `sign-in.tsx` shows the TOTP/backup-code verification (helpers in
  `src/lib/two-factor.ts`, tested) — users with 2FA enabled can sign in
  from the app.
- 2FA disable now requires re-auth: `two-factor-card.tsx` arms
  `confirmingDisable` first, then verifies a fresh TOTP (backup-code
  fallback) before `twoFactor.disable` — no more one-click disable.
- `docs/USER-GUIDE.md`: human-facing manual (11 sections).
- `LICENSE.md` (commercial, fill-in-the-brackets draft) + this changelog.

### Changed

- **English-first repo**: all docs, comments, action strings, emails, permission
  labels, zod messages, env examples, configs and CI in English. Default locale
  `es` → `en` (device detection intact; full ES locale still ships).
- Mobile fallback chain `es` → `en` → `es`.
- Prisma migrations squashed to a clean `init` baseline (**existing DBs created
  with the old history need `prisma migrate reset`**) + `add_two_factor`.
- `db:seed` runs from the repo root.
- Declared `lucide-react-native` (was an undeclared transitive).
- `openapi.json` regenerated (dropped stale `hubs` endpoints).
- Onboarding gate unified on `isOnboarded` (fixes a `/` ↔ `/onboarding` loop).
- `LICENSE.md` completed (seller, support, refunds, El Salvador law) and the
  duplicate extensionless `LICENSE` removed.

### Fixed

- Onboarding redirect loop for users with org but `isOnboarded=false`.
- Mobile profile showing "Guest" after name edits (empty-string `name`).
- Login dead-end on expired 2FA challenge (offers a fresh-link path).
- US spelling consistency (`Canceled`).
- Sidebar highlights exactly one item (exact match): `startsWith("/")` lit up
  Dashboard everywhere, and section paths lit up parent + child together.
- Moved pure invitation helpers out of the `"use server"` module (Next
  requires async-only exports there; `invitation-helpers.ts` is now importable
  from client components) + dropped the stray directive in
  `user-update-guard.ts`.
- New signups had ZERO roles (invisible Organization menu/pages, no errors):
  better-auth's adapter silently drops nested `roles.connect` in the `before`
  hook — the default role is now attached in an `after` hook with a direct
  write, plus a `customSession` self-heal for pre-existing role-less users.
- Mobile `typecheck` excluded `**/*.test.ts` (tests run via `bun test`,
  same as web ignoring `wiring.test.mjs`): stock Expo base config has no
  `bun:test` types, so every test file failed `tsc` on `main`.
- 2FA bypass via Google sign-in (web + mobile): better-auth's two-factor
  plugin only intercepts `/sign-in/{email,username,phone-number}`, so OAuth
  sign-ins created the session without the TOTP challenge. `signInTwoFactorHook`
  now also covers the OAuth callback `/callback/:id` (web) and native idToken
  `/sign-in/social` (mobile); the login page falls back to the pending
  `two_factor` cookie when the `?twoFactorRedirect=true` flag gets dropped in
  the redirect.
- Mobile 2FA step lost on app switch: returning from the authenticator fired
  a foreground session refetch, and the root layout's spinner replaced the
  whole `Stack` while it resolved (still no session), resetting sign-in to the
  email form. The spinner now only covers the first resolution
  (`sessionBooted`), and `sign-in.tsx` restores the TOTP step from the
  persisted challenge cookie (`hasPendingTwoFactorChallenge`, tested) — the
  step survives app switches and cold starts.

### Removed

- Internal Spanish artifacts from the tree (audit plan, session plans, legacy
  `apps/web/docs` + `standards`); git history preserves them.
- Dead UI: `/auth/register` ghost route, `/portal/overview` links, `href="#"`,
  hardcoded `App` brand, hardcoded landing metadata.

### Known gaps (documented, not in 1.0.0)

- Host-side backups/logs retention (operator responsibility).
- No payments/Stripe; billing is a placeholder; landing pricing/testimonials
  are declared demo content.
