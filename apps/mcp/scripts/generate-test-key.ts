/**
 * Creates a test org API key in the DB and prints it for the end-to-end
 * handshake (`apps/mcp`, phase §5.3).
 *
 * Usage: `bun run generate:test-key` from `apps/mcp` (requires DATABASE_URL).
 * Reuses the first organization and first user if they exist; otherwise
 * creates `Test Org` + `mcp-test@example.com`. The secret is shown ONCE:
 * only its SHA-256 `keyHash` is persisted (§5.1).
 */
import { db } from "@app/db";
import { generateApiKeySecret } from "@app/api";

const TEST_ORG_NAME = "Test Org";
const TEST_USER_EMAIL = "mcp-test@example.com";

const org =
  (await db.organization.findFirst({ orderBy: { createdAt: "asc" } })) ??
  (await db.organization.create({ data: { name: TEST_ORG_NAME } }));

const user =
  (await db.user.findFirst({ orderBy: { createdAt: "asc" } })) ??
  (await db.user.create({
    data: { email: TEST_USER_EMAIL, emailVerified: true },
  }));

// The key belongs to the org; add the user as a member if it is not one yet.
await db.member.upsert({
  where: {
    organizationId_userId: { organizationId: org.id, userId: user.id },
  },
  update: {},
  create: { organizationId: org.id, userId: user.id, role: "admin" },
});

const { secret, prefix, keyHash } = generateApiKeySecret();

const record = await db.apiKey.create({
  data: {
    organizationId: org.id,
    name: "test-key",
    prefix,
    keyHash,
    scopes: [],
    createdById: user.id,
  },
});

console.log(`orgId:  ${org.id} (${org.name})`);
console.log(`userId: ${user.id} (${user.email})`);
console.log(`keyId:  ${record.id} (prefix ${record.prefix})`);
console.log(`API key (copy it now, it will not be shown again):\n${secret}`);
console.log("");
console.log("Test the handshake:");
console.log(`  curl -s http://localhost:3001/health`);
console.log(
  `  curl -s -X POST http://localhost:3001/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "Authorization: Bearer ${secret}" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}'`,
);

await db.$disconnect();
