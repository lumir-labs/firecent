import { createHash, randomBytes } from "node:crypto";
import { db } from "@app/db";

import {
  MCP_ORG_READ,
  MCP_MEMBERS_READ,
  DEFAULT_MCP_SCOPES,
  type OrgApiKeyContext,
} from "./constants";

export {
  MCP_ORG_READ,
  MCP_MEMBERS_READ,
  DEFAULT_MCP_SCOPES,
  type OrgApiKeyContext,
};

/** SHA-256 hex of the secret. The plaintext secret is never persisted (§5.1). */
export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Generates an `sk_<base64url(32B)>` secret + its `prefix` (8 chars) and `keyHash`. */
export function generateApiKeySecret(): {
  secret: string;
  prefix: string;
  keyHash: string;
} {
  const secret = `sk_${randomBytes(32).toString("base64url")}`;
  return {
    secret,
    prefix: secret.slice(3, 11),
    keyHash: hashApiKey(secret),
  };
}

/**
 * Extracts the key candidate from headers: `Authorization: Bearer sk_…`
 * (preferred) or `x-api-key: sk_…`. Returns `null` if no header is present.
 */
export function extractApiKeyCandidate(
  headers: Headers | Record<string, string | string[] | undefined>,
): string | null {
  const get = (name: string): string | null => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }
    const value = (headers as Record<string, string | string[] | undefined>)[
      name.toLowerCase()
    ];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };

  const authorization = get("authorization");
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match?.[1]) return match[1].trim();
  }
  const apiKeyHeader = get("x-api-key");
  if (apiKeyHeader?.trim()) return apiKeyHeader.trim();
  return null;
}

/**
 * Validates an organization key by SHA-256 hash (§5.3 steps 2-5).
 * Returns the context `{ orgId, userId, scopes }` or `null` on any
 * failure (not found, revoked, expired, deleted org) to avoid giving
 * the client an oracle. Updates `lastUsedAt` fire-and-forget.
 */
export async function validateOrgApiKey(
  candidate: string | null | undefined,
): Promise<OrgApiKeyContext | null> {
  if (!candidate || typeof candidate !== "string" || candidate.trim() === "") {
    return null;
  }
  const keyHash = hashApiKey(candidate.trim());
  const record = await db.apiKey.findUnique({
    where: { keyHash },
    include: { organization: { select: { id: true, deletedAt: true } } },
  });
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return null;
  if (!record.organization || record.organization.deletedAt) return null;

  // Fire-and-forget: does not block the request (§5.3 step 5).
  db.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch((error: unknown) => {
      console.error("[api-keys] failed to update lastUsedAt", error);
    });

  return {
    keyId: record.id,
    orgId: record.organizationId,
    userId: record.createdById,
    scopes: record.scopes ?? [],
  };
}

/**
 * `true` if the context authorizes the required scope. Deny-by-default:
 * empty `scopes` = no access (breaks v1's fail-open; public tools must
 * not call this function).
 */
export function hasApiKeyScope(
  context: Pick<OrgApiKeyContext, "scopes">,
  scope: string,
): boolean {
  if (context.scopes.length === 0) return false;
  return context.scopes.includes(scope);
}
