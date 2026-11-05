/**
 * Idempotent seed: permission catalog, base roles and initial root user.
 *
 * Usage (from the repo root):
 *   bun run db:seed
 *   bun run db:seed -- --email=you@example.com --name="Your Name"
 *
 * Or via environment variables: SEED_ROOT_EMAIL, SEED_ROOT_NAME
 *
 * Notes:
 * - Every new user gets the `user` role (see packages/api/src/roles.ts).
 *   `root` is NOT assigned automatically: it is granted manually here.
 * - No passwords: access is via Magic Link (email) or Google OAuth.
 *   If the user doesn't exist, they are created with `emailVerified: true`;
 *   signing in with Magic Link or Google gives them a frictionless session.
 */
import path from "node:path";
// Loads the monorepo root's single `.env` (local fallback). Doesn't override the hosting environment.
for (const p of [
  path.resolve(import.meta.dirname ?? ".", "..", "..", "..", ".env"),
  path.resolve(import.meta.dirname ?? ".", "..", ".env"),
  path.resolve(import.meta.dirname ?? ".", "..", ".env.local"),
]) {
  try {
    process.loadEnvFile(p);
  } catch {
    // Absent: ok if the hosting injects variables.
  }
}
import { db } from "@app/db";
import { getUnknownRolePermissionKeys, ROLE_ROOT } from "@app/api/roles";
import { ensureAllRoles, ensureRole, syncPermissionCatalog } from "../lib/roles";

const LOG = { wait: "[⌛]", ok: "[✅]", err: "[❌]" } as const;

type Flags = {
  email?: string;
  name?: string;
  help: boolean;
};

const HELP = `
[✅] seed — permission, role and root user sync

Usage:
  bun run db:seed
  bun run db:seed -- --email=you@example.com --name="Your Name"

Flags:
  --email=<email>        Email of the user that will receive the ${ROLE_ROOT} role
  --name="First Last"    Optional full name of the user to create
  --help, -h             Show this help and do nothing

Equivalent environment variables:
  SEED_ROOT_EMAIL, SEED_ROOT_NAME

Without --email the script only syncs permissions and roles (doesn't touch users).
`;

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { help: false };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const separatorIndex = arg.indexOf("=");
    const key =
      separatorIndex === -1 ? arg.slice(2) : arg.slice(2, separatorIndex);
    let value =
      separatorIndex === -1 ? undefined : arg.slice(separatorIndex + 1);

    if (key === "help" || key === "h") {
      flags.help = true;
      continue;
    }

    if (value === undefined) {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        value = next;
        index++;
      }
    }

    if (value === undefined || value === "") continue;

    if (key === "email") flags.email = value;
    else if (key === "name") flags.name = value;
  }

  return flags;
}

/** "John Smith" -> { fullName, firstName: "John", lastName: "Smith" } */
function splitName(input: string) {
  const fullName = input.trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? fullName;
  return {
    fullName: fullName || firstName,
    firstName,
    lastName: parts.slice(1).join(" "),
  };
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    console.log(HELP);
    return;
  }

  const unknownKeys = getUnknownRolePermissionKeys();
  if (unknownKeys.length > 0) {
    throw new Error(
      `ROLE_DEFINITIONS declares permissions that don't exist in the catalog: ${unknownKeys.join(", ")}`,
    );
  }

  console.log(`${LOG.wait}seed Syncing permission and role catalog`);

  const permissions = await syncPermissionCatalog();
  console.log(
    `${LOG.ok}seed Permissions: ${permissions.created} created, ${permissions.updated} updated (${permissions.total} in the catalog)`,
  );

  const roles = await ensureAllRoles();
  console.log(
    `${LOG.ok}seed Roles: ${roles
      .map((role) => `${role.name}(#${role.id})`)
      .join(", ")}`,
  );

  const email = (flags.email ?? process.env.SEED_ROOT_EMAIL)
    ?.trim()
    .toLowerCase();
  const name = flags.name ?? process.env.SEED_ROOT_NAME;

  if (!email) {
    console.log(
      `ℹ️  Without --email (or SEED_ROOT_EMAIL) no user is touched.\n` +
        `   To name your root: bun run db:seed -- --email=you@example.com --name="Your Name"`,
    );
    return;
  }

  const rootRole = await ensureRole(ROLE_ROOT);
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, roles: { select: { id: true } } },
  });

  if (existing) {
    const alreadyRoot = existing.roles.some((role) => role.id === rootRole.id);

    if (alreadyRoot) {
      console.log(
        `${LOG.ok}seed ${email} already had the "${ROLE_ROOT}" role (no changes)`,
      );
    } else {
      await db.user.update({
        where: { id: existing.id },
        data: { roles: { connect: { id: rootRole.id } } },
      });
      console.log(
        `${LOG.ok}seed Existing user ${email}: "${ROLE_ROOT}" role attached`,
      );
    }

    console.log(
      `ℹ️  ${email} signs in with Magic Link or Google (no password).`,
    );
    return;
  }

  const { fullName, firstName, lastName } = splitName(
    name ?? email.split("@")[0],
  );

  const user = await db.user.create({
    data: {
      email,
      name: fullName,
      firstName,
      lastName,
      emailVerified: true,
      roles: { connect: { id: rootRole.id } },
    },
    select: { id: true, email: true },
  });

  console.log(`${LOG.ok}seed Root user created: ${user.email} (#${user.id})`);
  console.log(
    `ℹ️  Sign in with Magic Link or Google. On first login you'll be taken to /onboarding to create your organization.`,
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG.err}seed ${message}`);

    // Prisma 7 with driver adapters does NOT include the readable cause in
    // `message`: it puts it in `code` (e.g. ECONNREFUSED, P1001).
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;

    if (code) {
      console.error(`${LOG.err}seed code: ${code}`);
    }

    const connectionFailure =
      (!!code && /ECONNREFUSED|ETIMEDOUT|P1000|P1001|P1017/i.test(code)) ||
      /reach database server|ECONNREFUSED|P100[01]/i.test(message);

    if (connectionFailure) {
      console.error(
        `${LOG.err}seed Could not connect to the database. Check DATABASE_URL\n` +
          `        (apps/web/.env.local) and that Postgres is running.`,
      );
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

