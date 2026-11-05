"use server";

import { db, Prisma } from "@app/db";
import {
  createOrgApiKeySchema,
  generateApiKeySecret,
  listOrgApiKeysSchema,
  revokeOrgApiKeySchema,
  rotateOrgApiKeySchema,
} from "@app/api";
import { p } from "@app/api/permissions";
import { MCP_ORG_READ, MCP_MEMBERS_READ } from "@app/api";
import { validate } from "./validations";
import { validatePermission } from "./permissions";

const VALID_SCOPES = new Set([MCP_ORG_READ, MCP_MEMBERS_READ]);

export type OrgApiKey = Prisma.ApiKeyGetPayload<{
  select: {
    id: true;
    name: true;
    prefix: true;
    scopes: true;
    expiresAt: true;
    lastUsedAt: true;
    revokedAt: true;
    createdAt: true;
    createdBy: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

const keyMetadataSelect = {
  id: true,
  name: true,
  prefix: true,
  scopes: true,
  expiresAt: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

/**
 * Lists the session organization's keys (§5.4).
 * Never returns the secret: only its SHA-256 `keyHash` lives in the DB.
 */
export async function listOrgApiKeys(
  includeRevoked = false,
): Promise<{ data?: OrgApiKey[]; error?: string }> {
  //* VALIDATE SESSION + ORGANIZATION (requires membership: the orgId comes
  //* from `getSessionOrganization()`, which derives it from the user's memberships).
  const result = await validate(p.apikeys.list);
  if (!result.success) {
    return { data: [], error: result.error };
  }

  //* VALIDATE INPUT with the Phase 1 schema (don't reimplement validation).
  const parsed = listOrgApiKeysSchema.safeParse({
    organizationId: result.orgId,
    includeRevoked,
  });
  if (!parsed.success) {
    return { data: [], error: "Invalid parameters" };
  }

  try {
    const keys = await db.apiKey.findMany({
      where: {
        organizationId: parsed.data.organizationId,
        ...(parsed.data.includeRevoked ? {} : { revokedAt: null }),
      },
      select: keyMetadataSelect,
      orderBy: { createdAt: "desc" },
    });
    return { data: keys };
  } catch (error) {
    console.error("[❌listOrgApiKeys] Error listing API keys:", error);
    return { data: [], error: "Error listing API keys" };
  }
}

export type CreateOrgApiKeyInput = {
  name: string;
  /** ISO with offset (`new Date().toISOString()`), or null = no expiration. */
  expiresAt?: string | null;
  scopes?: string[];
};

export type CreatedOrgApiKey = {
  /** Secret in plain text: returned exactly ONCE, never persisted or logged. */
  secret: string;
  key: OrgApiKey;
};

/**
 * Creates a key for the session org. Generates the secret with
 * `generateApiKeySecret()` (Phase 1), persists only the `keyHash`, and
 * returns the secret exactly once for the "copy it now" dialog (§5.4).
 */
export async function createOrgApiKey(
  input: CreateOrgApiKeyInput,
): Promise<{ data?: CreatedOrgApiKey; error?: string }> {
  //* VALIDATE SESSION + ORGANIZATION (implicit membership, see above).
  const result = await validate(p.apikeys.create);
  if (!result.success) {
    return { data: undefined, error: result.error };
  }
  const authorId = result.session?.user?.id;
  if (!authorId) {
    return { data: undefined, error: "Invalid session" };
  }

  //* VALIDATE INPUT with the Phase 1 schema (don't reimplement validation).
  // Deny-by-default: an explicit `scopes: []` = no access. Without `scopes`,
  // the schema defaults to both MCP scopes (see DEFAULT_MCP_SCOPES) to avoid
  // creating dead keys from a UI without a selector.
  const parsed = createOrgApiKeySchema.safeParse({
    organizationId: result.orgId,
    name: input.name,
    expiresAt: input.expiresAt ?? null,
    ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
  });
  if (!parsed.success) {
    return {
      data: undefined,
      error: parsed.error.issues[0]?.message ?? "Invalid data",
    };
  }

  // Scope guard (defense in depth): the DB schema only validates that scopes
  // are strings, so a malicious caller could ask for scopes the MCP server
  // recognizes but that their role should never hand out. Reject anything
  // outside the documented, allow-listed scopes.
  const requestedScopes = parsed.data.scopes ?? [];
  if (requestedScopes.some((scope) => !VALID_SCOPES.has(scope))) {
    return {
      data: undefined,
      error: "One or more requested scopes are not allowed",
    };
  }

  //* GENERATE SECRET (never in plain text in the DB or logs).
  const { secret, prefix, keyHash } = generateApiKeySecret();

  try {
    const key = await db.apiKey.create({
      data: {
        organizationId: parsed.data.organizationId,
        name: parsed.data.name,
        prefix,
        keyHash,
        scopes: parsed.data.scopes,
        expiresAt: parsed.data.expiresAt
          ? new Date(parsed.data.expiresAt)
          : null,
        createdById: authorId,
      },
      select: keyMetadataSelect,
    });
    return { data: { secret, key } };
  } catch (error) {
    console.error("[❌createOrgApiKey] Error creating the API key:", error);
    return { data: undefined, error: "Error creating the API key" };
  }
}

/**
 * Revokes (soft: `revokedAt = now()`) a key of the session org.
 * The hash is kept for forensics; only an explicit delete removes it.
 */
export async function revokeOrgApiKey(
  keyId: string,
): Promise<{ success?: string; error?: string }> {
  //* VALIDATE SESSION + ORGANIZATION (implicit membership, see above).
  const result = await validate(p.apikeys.revoke);
  if (!result.success) {
    return { error: result.error };
  }

  //* VALIDATE INPUT with the Phase 1 schema (don't reimplement validation).
  const parsed = revokeOrgApiKeySchema.safeParse({
    organizationId: result.orgId,
    keyId,
  });
  if (!parsed.success) {
    return { error: "Invalid parameters" };
  }

  try {
    const updated = await db.apiKey.updateMany({
      where: {
        id: parsed.data.keyId,
        organizationId: parsed.data.organizationId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) {
      return { error: "API key not found or already revoked" };
    }
    return { success: "API key revoked" };
  } catch (error) {
    console.error("[❌revokeOrgApiKey] Error revoking the API key:", error);
    return { error: "Error revoking the API key" };
  }
}

export type RotateOrgApiKeyInput = {
  name?: string;
  expiresAt?: string | null;
  scopes?: string[];
};

/**
 * Rotates a key: revokes the old one and creates a new one in a single
 * transaction (no downtime: the new one works before the old one dies).
 * Requires `apikeys:revoke` + `apikeys:create`. Returns the new secret
 * exactly ONCE, same as `createOrgApiKey`.
 */
export async function rotateOrgApiKey(
  keyId: string,
  input: RotateOrgApiKeyInput = {},
): Promise<{ data?: CreatedOrgApiKey; error?: string }> {
  //* VALIDATE SESSION + ORGANIZATION with revocation permission…
  const result = await validate(p.apikeys.revoke);
  if (!result.success) {
    return { data: undefined, error: result.error };
  }
  const authorId = result.session?.user?.id;
  if (!authorId) {
    return { data: undefined, error: "Invalid session" };
  }
  //* …and additionally require creation permission (rotate = create + revoke).
  const { hasPermission } = await validatePermission(p.apikeys.create);
  if (!hasPermission) {
    return {
      data: undefined,
      error: "You don't have permission to perform this action",
    };
  }

  //* VALIDATE INPUT with the Phase 1 schema (don't reimplement validation).
  const parsed = rotateOrgApiKeySchema.safeParse({
    organizationId: result.orgId,
    keyId,
    ...(input.name !== undefined ? { name: input.name } : {}),
    expiresAt: input.expiresAt ?? null,
    ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
  });
  if (!parsed.success) {
    return {
      data: undefined,
      error: parsed.error.issues[0]?.message ?? "Invalid data",
    };
  }

  // Scope guard (defense in depth): same allow-list as createOrgApiKey. Only
  // the user-supplied scopes are re-checked; the inherited `current.scopes`
  // were already validated at creation time.
  if (
    parsed.data.scopes &&
    parsed.data.scopes.some((scope) => !VALID_SCOPES.has(scope))
  ) {
    return {
      data: undefined,
      error: "One or more requested scopes are not allowed",
    };
  }

  try {
    const current = await db.apiKey.findFirst({
      where: {
        id: parsed.data.keyId,
        organizationId: parsed.data.organizationId,
      },
    });
    if (!current) {
      return { data: undefined, error: "API key not found" };
    }
    if (current.revokedAt) {
      return { data: undefined, error: "The API key is already revoked" };
    }

    const { secret, prefix, keyHash } = generateApiKeySecret();

    const created = await db.$transaction(async (tx) => {
      await tx.apiKey.update({
        where: { id: current.id },
        data: { revokedAt: new Date() },
      });
      return tx.apiKey.create({
        data: {
          organizationId: parsed.data.organizationId,
          name: parsed.data.name ?? current.name,
          prefix,
          keyHash,
          scopes: parsed.data.scopes ?? current.scopes,
          expiresAt: parsed.data.expiresAt
            ? new Date(parsed.data.expiresAt)
            : null,
          createdById: authorId,
        },
        select: keyMetadataSelect,
      });
    });
    return { data: { secret, key: created } };
  } catch (error) {
    console.error("[❌rotateOrgApiKey] Error rotating the API key:", error);
    return { data: undefined, error: "Error rotating the API key" };
  }
}
