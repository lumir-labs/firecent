#!/usr/bin/env node
/**
 * Purge of expired records (minimal retention for the boilerplate).
 *
 *   node scripts/purge-expired.mjs            → deletes
 *   node scripts/purge-expired.mjs --dry-run  → report only
 *
 * Deletes:
 * - `verification`: expired tokens (old magic-links).
 * - `invitation`: created more than 30 days ago that are no longer pending
 *   (accepted/canceled/rejected), and expired more than 30 days ago. One
 *   month is kept for auditing.
 *
 * HOST backups/retention remain out of scope (README). Schedule with the
 * hosting's cron; idempotent, safe on a single instance.
 *
 * Uses `pg` with direct SQL (the generated Prisma 7 client is TS, not
 * importable from plain node).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const p of [join(root, ".env"), join(root, "apps/web/.env.local")]) {
  try {
    process.loadEnvFile(p);
  } catch {
    // missing: ok if the hosting injects DATABASE_URL
  }
}

const dryRun = process.argv.includes("--dry-run");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[purge] DATABASE_URL not defined");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();

  const invCond = `("expiresAt" < now() - interval '30 days' OR ("status" <> 'pending' AND "createdAt" < now() - interval '30 days'))`;

  const v = await client.query(
    `SELECT count(*)::int AS n FROM verification WHERE "expiresAt" < now()`,
  );
  const i = await client.query(
    `SELECT count(*)::int AS n FROM invitation WHERE ${invCond}`,
  );
  console.log(
    `[purge] expired verifications: ${v.rows[0].n}, old invitations: ${i.rows[0].n}${dryRun ? " (dry-run)" : ""}`,
  );

  if (!dryRun) {
    const dv = await client.query(
      `DELETE FROM verification WHERE "expiresAt" < now()`,
    );
    const di = await client.query(
      `DELETE FROM invitation WHERE ${invCond}`,
    );
    console.log(
      `[purge] deleted: ${dv.rowCount} verifications, ${di.rowCount} invitations`,
    );
  }
  await client.end();
}

main().catch(async (error) => {
  console.error("[purge] failed:", error?.message ?? error);
  await client.end().catch(() => {});
  process.exit(1);
});
