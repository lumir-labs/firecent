# Repo conventions

> Last verified: 2026-10-12 against `feat/teams-dsr-2fa`.

## i18n: namespaces and the parity rule

Single source: `packages/lib/src/messages/{es,en}.json` (web and mobile consume the
same files; sync via `scripts/sync-i18n.mjs`, `bun run i18n:sync`).

Actual namespaces (14): `Common, Nav, Profile, Auth, Admin, Home, Portal, Onboarding,
Landing, Dashboard, LanguageSwitcher, Search, Favorites, Legal`.

| Namespace | Use |
|---|---|
| `Common` | generic buttons/states (save, cancel, loading) |
| `Nav`, `LanguageSwitcher` | navigation and the language switcher |
| `Auth`, `Onboarding` | login, magic-link, sign-up wizard |
| `Admin`, `Dashboard` | admin CRUD and KPIs |
| `Home` | post-login dashboard `(home)` |
| `Portal`, `Profile` | user area (`/`, profile, organization, billing) |
| `Landing` | marketing page `/landing` |
| `Legal` | privacy/terms template pages |
| `Search`, `Favorites` | mobile tabs |

Rules:

- `localePrefix: "always"` and `defaultLocale: "en"` (`apps/web/i18n/routing.ts`):
  every URL carries `/es` or `/en`; `/` opens at `/en` (next-intl still negotiates
  Accept-Language + cookie, so Spanish devices keep getting `/es`).
- **A new namespace or key → in BOTH languages** + `bun run --cwd apps/web check:i18n`
  (`scripts/check-locale-parity.mjs`; it also runs in the web `build`).
- Server: `getTranslations("Portal")`; client: `useTranslations()`.
- After adding keys, boot `bun run dev:web` (or `build`) once: the next-intl
  plugin regenerates `apps/web/messages/es.d.json.ts` (generated, git-ignored);
  without that, `tsc` sees stale types even though the JSON is right.
  Note: types resolve against `es.json` by design (parity with `en.json` is
  enforced by `check:i18n`, so both files always carry the same key set).

## Folder layout (web)

```
app/[locale]/                 # everything under locale (routing.ts: localePrefix always)
  landing/                    # public demo
  api-docs/                   # openapi viewer
  (auth)/auth/login|reset     # session-less (authRoutes in routes.ts)
  (auth)/onboarding/          # 3-step wizard
  (protected)/layout.tsx      # isOnboarded gate
    (home)/                   # authenticated area: dashboard `/`, profile,
                              # billing, organization (+ organization/api-keys)
    (admin)/users|roles|organizations|permissions|dashboard/
  api/trpc/[trpc]/            # tRPC handler · api/auth/* · api/v1/info (public)
```

- `_components/` lives **next to its page** (e.g. `(home)/organization/api-keys/_components/`,
  `admin/users/_components/`). Shared → `components/ui|base|common`.
- `apps/web/lib/actions/` (Server Actions per domain: `users.ts`, `roles.ts`,
  `organization.ts`, `permissions.ts`, `api-keys.ts`, `invitations.ts`, `account.ts`, …)
  vs `packages/api` (shared tRPC). See the matrix in `docs/TRPC.md`.

## Client/server boundaries

- `"use client"` **only in interactive leaves** (forms, tables, providers).
  The `page.tsx` files are server components.
- Server sessions: **only** `getServerSession()` (`apps/web/lib/auth.ts`).
  Never read cookies or call `auth.api` directly from a component.
- Permissions with `p.*` **on the server**: `validatePermission(p.x.y)` in the page
  or action; the client only receives the result.
- ❌ Bad: `useEffect(() => fetch("/api/users"))` in a client without a server gate.
  ✅ Good: the server page validates → passes data to the client component.

## SEO metadata

- Site-wide SEO (description, robots, Open Graph, Twitter, JSON-LD Organization +
  WebSite) lives in `generateMetadata` of `apps/web/app/[locale]/layout.tsx`,
  localized from the `Seo` namespace. `og:locale` follows the route locale
  (`es_ES` / `en_US`), with the other one as `og:locale:alternate`.
- OG images: `public/splash/og-image.png` is English (default, also used by the
  splash at `/`); `og-image-es.png` is used for `/es`.
- The root layout sets `og:url` to the locale home (`/es`, `/en`); every page inherits
  it unless it overrides `openGraph`. It has **no** `canonical` or `hreflang` on
  purpose: they would be inherited by every page. Set them per page with `alternates`.
- A child segment that sets `openGraph` **replaces** the whole object (no deep merge):
  repeat the image/locale there.
- The production `/` is the static `public/splash/index.html` (see `proxy.ts`); its
  tags are hand-written and must be kept in sync manually.

## `proxy.ts` as the single guard

`apps/web/proxy.ts` (API) + (pages). Order: bypass
`/api/auth` + `/api/v1/info` + `/api/mcp*` → `/api/trpc` requires a session (401 JSON)
→ remaining `/api/*` **closed allowlist** (401) → i18n → page auth: logged-in on an
auth route → `/`; anonymous on a non-public route → `/auth/login?callbackUrl=`
(with `stripLocalePrefix` from `i18n/routing.ts`).

Lists: `publicRoutes = ["/error", "/landing", "/api-docs", "/privacy", "/terms"]`,
`authRoutes = ["/auth/login"]`, `apiAuthPrefix = "/api/auth"` (`routes.ts`).
Do not put guards in layouts: the proxy already redirects; the page only checks
the **fine-grained permission** (`AccessAlert`).

## 2FA (TOTP) — how it works in this repo

- `twoFactor({ allowPasswordless: true })` plugin (`apps/web/lib/auth.ts`) +
  `twoFactorClient()` (`auth-client.ts`). Management lives at `/profile`
  (`two-factor-card.tsx`): enable → URI + backup codes shown once → verify.
- The plugin's own hook does NOT cover magic-link or OAuth (only
  `/sign-in/email|username|phone`). `signInTwoFactorHook` (same file) replicates
  its recipe for every other session-creating path: `/magic-link/verify` and
  the Google OAuth callback `/callback/:id` destroy the session, issue the
  `two_factor` challenge cookie and redirect with `?twoFactorRedirect=true`;
  native idToken sign-in (`/sign-in/social`, mobile) answers
  `{ twoFactorRedirect: true }` instead. The login form shows the TOTP step →
  `verifyTotp`/`verifyBackupCode` create the real session.
- The login page also detects a pending challenge via the `two_factor` cookie
  (`pendingTwoFactor`), covering redirects where the flag got dropped
  (e.g. callbackURL `/`).
- Types note: the hook handler carries an `as never` cast — without it,
  better-auth 1.7.3 loses type inference for ALL plugins (Session without customSession).
- **Mobile 2FA**: the expo `authClient` carries `twoFactorClient()` and
  `sign-in.tsx` shows the same TOTP/backup-code step as the web login form
  (`src/lib/two-factor.ts` helpers: `isValidTotpCode`,
  `isInvalidTwoFactorCookieError`). After the magic-link is verified, a user
  with 2FA enabled enters the code in the app → `verifyTotp` creates the
  session. `INVALID_TWO_FACTOR_COOKIE` (10 min) returns to the email step.
  Google sign-in on native goes through the same step: the idToken response
  carries `twoFactorRedirect` and the app routes to the code screen.
- **Disable hardening**: `two-factor-card.tsx` never disables one-click —
  the first click arms `confirmingDisable`, then `handleConfirmDisable`
  verifies a fresh TOTP (backup-code fallback) before `twoFactor.disable`.
