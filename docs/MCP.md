# MCP server (`apps/mcp`)

> Last verified: 2026-10-12 against `feat/teams-dsr-2fa`.

MCP server with **Streamable HTTP** transport, a separate process from the web app.
It authenticates every request with an **org API key** (`sk_…`) and resolves
`{ orgId, userId, scopes }`.

- Bootstrap: `apps/mcp/src/index.ts` — `GET /health` (public), `POST /mcp`
  (with key), 404 otherwise. Port `MCP_PORT` (default `3001`, `apps/mcp/src/env.ts`).
- Tool registration: `apps/mcp/src/mcp/server.ts`.
- Auth: `apps/mcp/src/mcp/auth.ts` (`authenticateMcpRequest`); pure logic in
  `packages/api/src/api-keys/service.ts` (`validateOrgApiKey`).

## Prerequisites

1. An organization (sign-up + onboarding create one; see `docs/README.md`).
2. An API key for that org, generated from the UI (below). Format `sk_<base64url(32B)>`
   (`service.ts`); only the `SHA-256` lives in the DB (`hashApiKey`).

## Generating a key (UI)

`/en/organization/api-keys` (`apps/web/app/[locale]/(protected)/(home)/organization/api-keys/page.tsx`):

- Gate `p.apikeys.menu`; without permission → `AccessAlert`.
- `api-keys-table.tsx`: **create** (name + optional expiration + scopes) →
  the secret is shown **once** in a dialog ("copy it now", never shown again).
  **Revoke** = soft (`revokedAt`); **rotate** = create + revoke.
- Actions: `listOrgApiKeys`, `createOrgApiKey`, `revokeOrgApiKey`, `rotateOrgApiKey`
  in `apps/web/lib/actions/api-keys.ts`, each with `validatePermission(p.apikeys.*)`
  + the session org. UI text lives in the `Portal.apiKeys` i18n namespace.

## Connecting a client

```bash
# 1. Probe without auth
curl http://localhost:3001/health
# → {"ok":true,"service":"mcp","time":"..."}

# 2. MCP handshake (Streamable HTTP) with a key
curl -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Authorization: Bearer sk_YOUR_SECRET" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'
```

Note: the web app lets `/api/mcp*` through without a session cookie
(`apps/web/proxy.ts`) because the MCP server authenticates by key, not session.
If you proxy MCP behind the web app, use that route.

## Tool catalog

| Tool | Scope | Input (zod) | Output |
|---|---|---|---|
| `org.info` (`tools/org-info.ts`) | `mcp:org:read` | `{}` (`orgInfoInputSchema`) | `{ id, name, description, memberCount }` |
| `org.members.list` (`tools/org-members.ts`) | `mcp:members:read` | `{ page, limit }` (default 1/20, max 100) | `{ page, limit, total, members[] }` |
| `service.health` (`tools/health.ts`) | none (public) | `{}` | `{ ok, service:"mcp", time }` |

Scopes: `MCP_ORG_READ`, `MCP_MEMBERS_READ` in `service.ts`. Deny-by-default:
empty `scopes` = no access (`hasApiKeyScope`). Keys created from the UI are born
with both MCP scopes; public tools (`service.health`) require no scope.

> **Breaking v1→v2:** keys created with `scopes=[]` went from "full access" to
> "no access". Find affected keys with
> `db.apiKey.findMany({ where: { scopes: { isEmpty: true }, revokedAt: null } })`
> and rotate them (`rotateOrgApiKey`) to grant scopes. The UI marks those keys
> with the `Portal.apiKeys.noScopes` warning.

## Adding tool #4 (recipe)

1. **Copy** `apps/mcp/src/mcp/tools/org-info.ts` to `my-tool.ts`. Change the name,
   the zod `inputSchema`/`outputSchema` and the description (the client LLM reads it).
2. **Filter by org**: every query carries `where: { organizationId: auth.orgId }`
   (see `org-info.ts`). It receives `auth: McpAuthContext` as the 2nd param of `registerXTool`.
3. **Scope**: if it requires a new one, define the constant in `service.ts` and
   check with `hasApiKeyScope(auth, MY_SCOPE)` returning `isError: true` when
   missing (pattern in `org-info.ts`).
4. **Register** in `apps/mcp/src/mcp/server.ts`: `registerMyTool(server, auth);`.
   The web UI needs **no** changes (MCP tools have no UI).
5. `bun run typecheck` at the root + regenerate docs (`bun run docs:gen`).

## Troubleshooting

| Symptom | Cause | Where to look |
|---|---|---|
| `401 {"error":"No API key provided"}` | missing header | `auth.ts`; send `Authorization: Bearer sk_…` or `x-api-key` |
| `401 {"error":"Invalid API key"}` | non-existent, revoked, expired or deleted org — **same message on purpose** (no oracle) | `service.ts` |
| `403 {"error":"Forbidden: missing scope …"}` | the key lacks the scope | `auth.ts`, `hasApiKeyScope` in `service.ts` |
| `405 Method not allowed` | `GET /mcp` | `index.ts`; the MCP endpoint is `POST /mcp` |
| Tool returns `isError` with `Missing scope` | scope absent on the key | rotate the key with the scope (`rotateOrgApiKey`) |
| Recent-usage questions | `lastUsedAt` is updated fire-and-forget per valid request | `service.ts` (non-blocking; logs on failure) |
