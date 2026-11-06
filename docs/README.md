# StackGoat — boilerplate index

> Last verified: 2026-10-12 against `feat/teams-dsr-2fa`.

Multi-surface SaaS boilerplate: **web** (Next.js 16) + **mobile** (Expo SDK 57) +
**MCP server** (Streamable HTTP), with Better Auth, typed tRPC, ES/EN i18n and
single-source theme tokens.

## 30-second map

| What | Where | Doc |
|---|---|---|
| Generated architecture (workspaces, routes, API, permissions, models) | `docs/ARCHITECTURE.md` | regenerate with `bun run docs:gen` |
| MCP server: using it, generating keys, adding tools | `docs/MCP.md` | — |
| tRPC: setup + step-by-step add-a-procedure | `docs/TRPC.md` | — |
| Reusable components (web + mobile) | `docs/COMPONENTS.md` | — |
| Conventions (i18n, folders, client/server, `proxy.ts`) | `docs/CONVENTIONS.md` | — |
| Human-facing product walkthrough | `docs/USER-GUIDE.md` | — |
| Known temporal gaps | `docs/gaps/` | — |

## Where to start (new dev)

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `BETTER_AUTH_SECRET`,
   `GOOGLE_CLIENT_ID/SECRET`, `SMTP_*` (magic-link).
2. `bun install` · `bun run db:push` (or `db:migrate`) · `bun run db:seed -- --email=you@email.com`
   (`apps/web/scripts/seed.ts`: creates the permission catalog + roles + the `root` user).
3. `bun run dev:web` → `http://localhost:3000/en/landing` (public demo route).
4. Sign in with Google or magic-link (`apps/web/app/[locale]/(auth)/auth/login/page.tsx`).
   Sign-ups get the `user` role (`apps/web/lib/roles.ts` via `ensureRole("user")`).

> Test note: `bun test` runs unit tests everywhere, but
> `apps/web/lib/actions/account-core.test.mjs` is an integration test — it
> needs the Postgres from step 2 live, or it fails on connection.

## Monorepo layout

```
apps/web        # Next.js 16: user area, admin CRUD, tRPC + REST API, proxy guard
apps/mobile     # Expo SDK 57 + expo-router + Uniwind: sign-in, tabs, ui-kit
apps/mcp        # HTTP MCP server (port 3001): org API key auth, 3 tools
packages/api    # tRPC (routers, permissions, api-keys service), single source of permissions
packages/db     # Prisma schema + client
packages/lib    # i18n single source (messages/) + theme tokens (tokens/semantic.ts)
scripts/        # sync-tokens.ts, check-env.mjs, gen-architecture.mjs
docs/           # THIS documentation (single source of truth)
```

## Golden rules (detail in `CONVENTIONS.md`)

- `apps/web/proxy.ts` is the **only web route guard**. Do not add auth to layouts.
- Server sessions: only via `getServerSession()` (`apps/web/lib/auth.ts`).
  Never inside client components.
- Permissions: `p.<domain>.<action>` in `packages/api/src/permissions.ts` + a
  `validatePermission()` gate on the server. Never filter UI without a server gate.
- i18n: messages live in `packages/lib/src/messages/{es,en}.json`. A new namespace →
  both languages + `bun run --cwd apps/web check:i18n` green.
- Tokens: `packages/lib/src/tokens/semantic.ts` is the source; `bun run tokens:sync`
  generates the CSS. Never hand-edit a generated `*.css`.
- Shared web↔mobile data → **tRPC** in `packages/api`. Server Actions only for
  `revalidatePath`/`cookies`/`FormData` (see `TRPC.md`).
- Changed routes, Prisma schema or API → run `bun run docs:gen` and commit
  `docs/ARCHITECTURE.md`.
