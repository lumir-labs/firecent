import { z } from "zod";
import { DEFAULT_MCP_SCOPES } from "./constants";

/** Human-readable name for the key ("CI", "Claude Desktop"). */
export const apiKeyNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Maximum 100 characters");

/** Optional expiration: future ISO date. */
export const apiKeyExpiresAtSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).getTime() > Date.now(), {
    message: "Expiration must be in the future",
  })
  .nullish();

export const apiKeyScopesSchema = z
  .array(z.string().trim().min(1))
  .default([...DEFAULT_MCP_SCOPES]);

export const createOrgApiKeySchema = z.object({
  organizationId: z.string().uuid(),
  name: apiKeyNameSchema,
  expiresAt: apiKeyExpiresAtSchema,
  scopes: apiKeyScopesSchema,
});

export const listOrgApiKeysSchema = z.object({
  organizationId: z.string().uuid(),
  includeRevoked: z.boolean().default(false),
});

export const revokeOrgApiKeySchema = z.object({
  organizationId: z.string().uuid(),
  keyId: z.string().min(1),
});

export const rotateOrgApiKeySchema = z.object({
  organizationId: z.string().uuid(),
  keyId: z.string().min(1),
  name: apiKeyNameSchema.optional(),
  expiresAt: apiKeyExpiresAtSchema,
  scopes: apiKeyScopesSchema.optional(),
});

export type CreateOrgApiKeyInput = z.infer<typeof createOrgApiKeySchema>;
export type ListOrgApiKeysInput = z.infer<typeof listOrgApiKeysSchema>;
export type RevokeOrgApiKeyInput = z.infer<typeof revokeOrgApiKeySchema>;
export type RotateOrgApiKeyInput = z.infer<typeof rotateOrgApiKeySchema>;
