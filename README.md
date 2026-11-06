# StackGoat — boilerplate (not a finished SaaS)

Honest multi-surface boilerplate: **Turborepo + Bun 1.3.x + Next 16 + Expo SDK 57 (Uniwind) + Better Auth (magic-link + Google, no passwords) + Prisma 7 + tRPC 11 + shadcn/ui web + MCP server with org API keys**.

What it DOES ship: passwordless auth, onboarding with organization, RBAC with permissions (`p.*`), admin CRUD (users/roles/orgs/permissions), user area (`/`, profile, billing placeholder, organization/api-keys), org invitations with email acceptance, active-organization switcher, mobile profile editing (tRPC), real account deletion (anonymization + cascade + `db:purge`), TOTP 2FA with backup codes (magic-link sign-in asks for a code, web and mobile), mobile app (sign-in, tabs, ui-kit, canonical drawer), ES/EN single-source i18n, single-file theme tokens (web + mobile), docs in `docs/`.

What it does NOT ship: payments/Stripe, GDPR/SOC2/ISO certifications (see disclaimer below). The landing (`/en/landing`) and the user dashboard use declared demo data.

## Start here

Single source: `docs/README.md` (30-second map + dev onboarding). Human-facing product walkthrough: `docs/USER-GUIDE.md`. Recipes: `docs/TRPC.md` (procedure), `docs/MCP.md` (tool #4), `docs/COMPONENTS.md` (UI), `docs/CONVENTIONS.md`.

```powershell
bun install
bun run db:push
bun run db:seed -- --email=you@email.com
bun run dev:web
# → http://localhost:3000/en/landing
```

Commands: `bun run dev | dev:web | dev:mobile | build | typecheck | docs:gen | env:check | db:purge`.

## License & changelog

Commercial license: [`LICENSE.md`](./LICENSE.md) — have it reviewed by a
lawyer for your jurisdiction before your first sale. What changed and what
is known to be missing: [`CHANGELOG.md`](./CHANGELOG.md).

## Disclaimer

Delivered AS-IS, without warranties of security, availability or legal fitness. It does not claim compliance with GDPR, CCPA/CPRA, ISO/IEC 27001, SOC 2, HIPAA or PCI-DSS. Account deletion (DSR) anonymizes and purges the live database, but **backups, host retention and logs remain your responsibility**. Before processing real data: risk assessment/DPIA, privacy/cookie notice/DPA, rate-limit/2FA/headers, legal counsel. This is not legal advice.

Operator checklist (hosting is yours): schedule Postgres backups (`pg_dump` + tested restore, encrypt off-site copies); set log retention + rotation on the host and never log PII (CI guard `check-logs.mjs`); configure `SMTP_HOST`/`EMAIL_FROM` in production (`env:check --strict` fails without them); rotate `BETTER_AUTH_SECRET` with `openssl rand -base64 32` and keep `.env` at 600.
