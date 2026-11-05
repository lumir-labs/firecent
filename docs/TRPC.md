# tRPC (`packages/api`)

> Last verified: 2026-10-12 against `feat/teams-dsr-2fa`.

Every typed endpoint shared web↔mobile lives in `packages/api`, not in `apps/web`.
Today the router exposes `health` + `me` + `users` (`packages/api/src/root.ts`); the
admin CRUD runs through Server Actions (`apps/web/lib/actions/`) — see the matrix below.

> Note: `packages/api/README.md` described `accounts/records/categories/payees`
> routers that **do not exist**. It was deprecated and removed; this file is the
> real reference. Gap details in `docs/gaps/API-README-ASPIRATIONAL.md`.

## Setup (how it is wired)

- Context: `packages/api/src/trpc.ts` — `{ orgId: string | null, session }`.
  `protectedProcedure` requires `ctx.session.user.emailVerified`.
  `requirePermission(key)` is a middleware that returns `403` without the permission.
- Next handler: `apps/web/app/api/trpc/[trpc]/route.ts` — `createContext()` with
  `getServerSession()` + `getSessionOrganization()` (`org?.OrganizationId`), served
  by `fetchRequestHandler` on `GET`+`POST`.
- Web client: `apps/web/providers/trpc-provider.tsx` — `httpBatchLink` to `/api/trpc`
  with `credentials: "include"`. Import: `trpc` from `@app/api/client`.
- RSC (server, no HTTP): `createCaller` from `@app/api/server`.
- Mobile: same `trpc` from `@app/api/client`, with a link to `${baseURL}/api/trpc`
  (`apps/mobile/src/lib/trpc.tsx`).

Real consumers: `usersRouter.getOwn` (mobile profile, `(tabs)/profile.tsx`) and
mobile `(tabs)/index.tsx` (`trpc.health.check.useQuery()`).

## Adding a procedure (recipe with a real example)

Example goal: paginated `users.list` using the existing `p.users.read`
(`packages/api/src/permissions.ts`; there is no `users:list` — do not use it).

**1. Permission: reuse `p.users.read` (already exists). If you need a new one,
use the `def(key, name, description)` pattern — see permissions.ts. Hypothetical
example (do NOT create it if it is not in the catalog):**

```ts
list: def("users:list", "List users", "Allows reading the user list"),
```

Sync it to the DB from `/en/admin/permissions` (the "missing" button uses
`getMissingPermissionsGrouped`).

**2. Router in `packages/api/src/routers/users.ts`** (copy `health.ts` and extend):

```ts
import z from "zod";
import { db } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

export const usersRouter = router({
  list: protectedProcedure
    .use(requirePermission(p.users.read))
    .input(z.object({ page: z.number().min(1).default(1), limit: z.number().max(100).default(20) }))
    .query(({ ctx, input }) =>
      db.user.findMany({ where: { deletedAt: null }, skip: (input.page - 1) * input.limit, take: input.limit }),
    ),
});
```

Shared zod schemas live in `packages/api/src/users/schemas.ts`-style files
(see `updateOwnSchema`; api-keys equivalents in `api-keys/schemas.ts`).

**3. Mount in `packages/api/src/root.ts`:**

```ts
import { usersRouter } from "./routers/users";
export const appRouter = router({ health: healthRouter, users: usersRouter, me: ... });
```

**4. Consume:**

```tsx
// Web client component (under <TRPCProvider>)
import { trpc } from "@app/api/client";
const list = trpc.users.list.useQuery({ page: 1, limit: 20 });
// Web RSC: import { createCaller } from "@app/api/server";
//   const caller = createCaller(await createContext()) — do NOT use in client.
// Mobile: same as web client (trpc is already typed via AppRouter).
```

**5. Wrap up:** `bun run typecheck` at the root · `bun run docs:gen` (the API
changed) · verify 403 without permission and 401 without session
(`proxy.ts` guards `/api/trpc`).

## Server Action vs tRPC

| Case | Where | Why |
|---|---|---|
| Shared web↔mobile data (lists, profiles, keys) | tRPC in `packages/api` | one type (`AppRouter`), two clients |
| `revalidatePath`, `cookies`, `FormData` — Next-only APIs | Server Action in `apps/web/lib/actions/` | APIs tRPC does not have |
| Mutation with toast + page refresh | Server Action (current admin pattern) | the admin DataTable screens |

Rule: if mobile will need it, it is born in tRPC.
