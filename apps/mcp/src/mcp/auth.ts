import type { IncomingMessage, ServerResponse } from "node:http";
import {
  extractApiKeyCandidate,
  hasApiKeyScope,
  validateOrgApiKey,
  type OrgApiKeyContext,
} from "@app/api";

/**
 * Authentication middleware for the MCP server (§5.3 steps 1-4).
 * Extracts `Authorization: Bearer sk_…` (preferred) or `x-api-key`, validates
 * by SHA-256 hash and resolves `{ orgId, userId, scopes }` for the request.
 */
export type McpAuthContext = OrgApiKeyContext;

function json(
  res: ServerResponse,
  status: number,
  body: { success: false; error: string },
): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** 401 without oracle: same message whether the key does not exist, or is revoked or expired. */
export function unauthorized(res: ServerResponse, missing: boolean): void {
  json(res, 401, {
    success: false,
    error: missing ? "No API key provided" : "Invalid API key",
  });
}

export function forbiddenScope(res: ServerResponse, scope: string): void {
  json(res, 403, {
    success: false,
    error: `Forbidden: missing scope ${scope}`,
  });
}

/**
 * Authenticates an HTTP request. Returns the context or `null` (a 401 was
 * already sent). Every MCP tool filters by `ctx.orgId` (just like
 * `requirePermission` filters by session in `packages/api/src/trpc.ts`).
 */
export async function authenticateMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<McpAuthContext | null> {
  const candidate = extractApiKeyCandidate(
    req.headers as Record<string, string | string[] | undefined>,
  );
  if (!candidate) {
    unauthorized(res, true);
    return null;
  }
  const context = await validateOrgApiKey(candidate);
  if (!context) {
    unauthorized(res, false);
    return null;
  }
  return context;
}

/** Verifies the key's scope for a tool; responds 403 if missing. */
export function requireApiKeyScope(
  context: McpAuthContext,
  scope: string,
  res: ServerResponse,
): boolean {
  if (hasApiKeyScope(context, scope)) return true;
  forbiddenScope(res, scope);
  return false;
}
