# Temporal gap: aspirational `packages/api/README.md`

> Last verified: 2026-10-07 against `e5f31e8`. **Temporal**: removed once `docs/TRPC.md`
> exists (this phase). Do not add content here.

The `packages/api` `README.md` described a state that **does not exist in the code**:

| README claim | Reality |
|---|---|
| Routers `accounts/records/categories/payees` (`README:26-30`) | Only `health` + `me` exist (`src/root.ts:4-13`) |
| `services/` with `accounts/records/query.service.ts` (`README:20-23`) | No `src/services/` exists |
| `schemas/query.ts` with `queryRecordsSchema` (`README:19`) | Only `src/api-keys/schemas.ts` (keys) exists; no generic query |
| `ctx.permissions` via `auth.api.verifyApiKey` in `createContext` (`README:53`) | `createContext` returns `{ orgId, session }` (`route.ts:6-19`); no `verifyApiKey`, no api keys in auth |
| `p.accounts.list`, `p.records.list` (`README:18,40`) | `permissions.ts` has `dashboard/permissions/roles/users/organizations/organizationMembers/apikeys` |
| Endpoints `records.query/list/stats/create` (`README:62-104`) | Do not exist |
| Mobile `TotalBalanceCard` with `stats` (`README:96`) | Mobile only consumes `health.check` (`(tabs)/index.tsx:16`) |

**Resolution (§6.1):** real content → `docs/TRPC.md`; this gap note + the original README
were removed in the deprecation commit. Do not revive the README: all API docs live in `docs/`.
