/**
 * Demo seed: two demo Spaces (Organizations) with the Maya & Daniel dataset
 * from docs/prototype/mock-data.md. Safe by construction:
 * - It only ever writes inside the two demo Spaces (slug `demo-maya-daniel`,
 *   `demo-personal`) and the demo users (`maya@demo.test`, `daniel@demo.test`).
 * - `--reset` deletes rows filtered by those two organization ids, nothing else.
 *
 * Usage (from the repo root):
 *   bun run db:seed:demo                       create the demo Spaces (no-op if they exist)
 *   bun run db:seed:demo -- --reset            delete and recreate the demo Spaces' data
 *   bun run db:seed:demo -- --fixed            keep mock dates (today = 2026-11-12), no shifting
 *   bun run db:seed:demo -- --member=you@x.com add an existing user as `member` of the demo Spaces
 *   bun run db:seed:demo -- --help
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
import { ROLE_USER } from "@app/api/roles";
import { ensureRole } from "../lib/roles";
import {
  ACCOUNTS,
  CATEGORIES,
  DEBTS,
  DEMO_SLUGS,
  DEMO_SPACES,
  DEMO_USERS,
  LABELS,
  MOCK_TODAY,
  NOV_RECORDS,
  OPENING_DATE,
  buildHistory,
  buildOpeningBalances,
  signedFor,
  type AccountKey,
  type DemoRecord,
  type DemoUserKey,
} from "./demo/data";

const LOG = { wait: "[⌛]", ok: "[✅]", err: "[❌]" } as const;

const HELP = `
[✅] seed-demo — demo Spaces with the Maya & Daniel dataset

Usage:
  bun run db:seed:demo
  bun run db:seed:demo -- --reset
  bun run db:seed:demo -- --member=you@example.com

Flags:
  --reset              Delete ONLY the rows of the demo Spaces (slug ${DEMO_SLUGS.join(", ")}) and recreate them
  --fixed              Do not shift dates: the mock's "today" stays 2026-11-12
  --member=<email>     Add an existing user as "member" of the demo Spaces (creates only the Member row)
  --help, -h           Show this help and do nothing

Without --reset, if the demo Spaces already exist nothing changes.
Refuses to run with NODE_ENV=production.
`;

type Flags = { reset: boolean; fixed: boolean; member?: string; help: boolean };

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { reset: false, fixed: false, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") flags.help = true;
    else if (arg === "--reset") flags.reset = true;
    else if (arg === "--fixed") flags.fixed = true;
    else if (arg.startsWith("--member=")) {
      flags.member = arg.slice("--member=".length).trim().toLowerCase() || undefined;
    }
  }
  return flags;
}

/** Host, database and schema of DATABASE_URL, never the password. */
function describeTarget(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "(DATABASE_URL not set)";
  try {
    const u = new URL(raw);
    const schema = u.searchParams.get("schema") ?? "public (default)";
    return `host=${u.hostname}:${u.port || "5432"} db=${u.pathname.replace(/^\//, "")} schema=${schema}`;
  } catch {
    return "(DATABASE_URL could not be parsed)";
  }
}

const MS_DAY = 86_400_000;
const utcDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Days between the mock's "today" and the real today (0 with --fixed). */
function dateShiftDays(fixed: boolean): number {
  if (fixed) return 0;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - utcDay(MOCK_TODAY)) / MS_DAY);
}

const shiftDate = (iso: string, days: number) => new Date(utcDay(iso) + days * MS_DAY);
const timeOf = (rank: number) => {
  const minutes = 8 * 60 + rank * 7;
  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`1970-01-01T${hh}:${mm}:00.000Z`);
};

/** In-memory check: balances (sum of signed records) must equal mock §2 before anything is written. */
function assertBalances(records: DemoRecord[], openings: { account: AccountKey; signed: number }[]) {
  for (const a of ACCOUNTS) {
    const opening = openings.find((o) => o.account === a.key)?.signed ?? 0;
    const sum = opening + records.reduce((s, r) => s + signedFor(r, a.key), 0);
    if (sum !== a.balanceToday) {
      throw new Error(`Dataset mismatch on ${a.name}: sum ${sum} != mock ${a.balanceToday}`);
    }
  }
}

type DemoOrgRow = { id: string; slug: string | null };

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(HELP);
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run: NODE_ENV=production.");
  }

  console.log(`${LOG.wait}seed-demo Target: ${describeTarget()}`);

  const history = buildHistory();
  const openings = buildOpeningBalances(history);
  const allRecords = [...history, ...NOV_RECORDS];
  assertBalances(allRecords, openings);

  const existing: DemoOrgRow[] = await db.organization.findMany({
    where: { slug: { in: DEMO_SLUGS } },
    select: { id: true, slug: true },
  });

  const shift = dateShiftDays(flags.fixed);

  if (existing.length > 0 && !flags.reset) {
    console.log(
      `${LOG.ok}seed-demo Demo Spaces already exist (${existing.map((o) => o.slug).join(", ")}): nothing to change. Use --reset to recreate them.`,
    );
    if (flags.member) await addMember(flags.member, existing);
    return;
  }

  // Name collisions with real Spaces: `Organization.name` is unique.
  for (const s of Object.values(DEMO_SPACES)) {
    const clash = await db.organization.findFirst({
      where: { name: s.name, NOT: { slug: s.slug } },
      select: { id: true },
    });
    if (clash) throw new Error(`A non-demo Space already uses the name "${s.name}". Aborting.`);
  }

  // ── Plan (printed before writing) ──
  const existingIds = existing.map((o) => o.id);
  if (existingIds.length > 0) {
    const where = { organizationId: { in: existingIds } };
    const [rec, acc, cat, pay, lab, debt, mem] = await Promise.all([
      db.record.count({ where }),
      db.bankAccount.count({ where }),
      db.category.count({ where }),
      db.payee.count({ where }),
      db.label.count({ where }),
      db.debt.count({ where }),
      db.member.count({ where }),
    ]);
    console.log(
      `${LOG.wait}seed-demo --reset will DELETE (only in ${existing.map((o) => o.slug).join(", ")}): ` +
        `${rec} records, ${acc} accounts, ${cat} categories, ${pay} payees, ${lab} labels, ${debt} debts, ${mem} members`,
    );
  }
  const payeeNames = new Set(allRecords.map((r) => r.payee).filter((x): x is string => !!x));
  const expandedRecords = allRecords.reduce((n, r) => n + (r.type === "TRANSFER" ? 2 : 1), 0) + ACCOUNTS.length;
  console.log(
    `${LOG.wait}seed-demo will CREATE: 2 Spaces, ${ACCOUNTS.length} accounts, ${CATEGORIES.length} categories, ` +
      `${payeeNames.size} payees, ${LABELS.length} labels, ${expandedRecords} records, ${DEBTS.length} debts` +
      ` (dates shifted ${shift >= 0 ? "+" : ""}${shift} days)`,
  );

  // ── Users (reused if they exist, otherwise created with the `user` role) ──
  const userRole =
    (await db.role.findUnique({ where: { name: ROLE_USER }, select: { id: true } })) ??
    (await ensureRole(ROLE_USER));
  const userIds = {} as Record<DemoUserKey, string>;
  for (const key of Object.keys(DEMO_USERS) as DemoUserKey[]) {
    const u = DEMO_USERS[key];
    const found = await db.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (found) {
      userIds[key] = found.id;
      continue;
    }
    const created = await db.user.create({
      data: {
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        firstName: u.firstName,
        lastName: u.lastName,
        emailVerified: true,
        isOnboarded: true,
        roles: { connect: { id: userRole.id } },
      },
      select: { id: true },
    });
    userIds[key] = created.id;
    console.log(`${LOG.ok}seed-demo Demo user created: ${u.email}`);
  }

  await db.$transaction(
    async (tx) => {
      // ── Reset: only rows of the demo orgs, by organizationId ──
      if (existingIds.length > 0) {
        const where = { organizationId: { in: existingIds } };
        await tx.record.deleteMany({ where });
        await tx.debt.deleteMany({ where });
        await tx.bankAccount.deleteMany({ where });
        await tx.category.deleteMany({ where });
        await tx.payee.deleteMany({ where });
        await tx.label.deleteMany({ where });
        await tx.member.deleteMany({ where });
      }

      // ── Spaces + members ──
      const orgIds = {} as Record<keyof typeof DEMO_SPACES, string>;
      for (const key of Object.keys(DEMO_SPACES) as (keyof typeof DEMO_SPACES)[]) {
        const s = DEMO_SPACES[key];
        const org =
          (await tx.organization.findUnique({ where: { slug: s.slug }, select: { id: true } })) ??
          (await tx.organization.create({
            data: { name: s.name, slug: s.slug, description: "Demo data (db:seed:demo)" },
            select: { id: true },
          }));
        orgIds[key] = org.id;
        for (const m of s.members) {
          await tx.member.create({
            data: { organizationId: org.id, userId: userIds[m.user], role: m.role },
          });
        }
      }

      // ── Data of the main demo Space ──
      const orgId = orgIds.home;

      const accountIds = {} as Record<AccountKey, number>;
      for (const [position, a] of ACCOUNTS.entries()) {
        const row = await tx.bankAccount.create({
          data: {
            organizationId: orgId,
            userId: userIds[a.owner],
            name: a.name,
            type: a.type,
            currency: a.currency,
            accountNumber: a.accountNumber ?? null,
            position,
            creditLimit: a.creditLimit ?? null,
            paymentDayType: a.type === "CREDIT_CARD" ? "MONTHLY_DAY" : null,
            paymentDay: a.paymentDay ?? null,
            interestRate: a.interestRate ?? null,
            displayCreditMode: a.type === "CREDIT_CARD" ? "CREDIT_BALANCE" : null,
            createdBy: userIds[a.owner],
            // visibility: PRIVATE (Fase 4): a.visibility is not stored yet.
          },
          select: { id: true },
        });
        accountIds[a.key] = row.id;
      }

      const categoryIds = new Map<string, number>();
      for (const c of CATEGORIES) {
        const row = await tx.category.create({
          data: { organizationId: orgId, name: c.name, icon: c.icon, spendingNature: c.nature },
          select: { id: true },
        });
        categoryIds.set(c.name, row.id);
      }

      const payeeIds = new Map<string, number>();
      for (const name of [...payeeNames].sort()) {
        const row = await tx.payee.create({ data: { organizationId: orgId, name }, select: { id: true } });
        payeeIds.set(name, row.id);
      }

      const labelIds = new Map<string, number>();
      for (const l of LABELS) {
        const row = await tx.label.create({
          data: { organizationId: orgId, name: l.name, color: l.color },
          select: { id: true },
        });
        labelIds.set(l.name, row.id);
      }

      // Record payload shared by the plain and transfer paths.
      const paymentTypeOf = (key: AccountKey): "CASH" | "CREDIT_CARD" | "WEB_PAYMENT" => {
        const type = ACCOUNTS.find((a) => a.key === key)!.type;
        return type === "CREDIT_CARD" ? "CREDIT_CARD" : type === "CASH" ? "CASH" : "WEB_PAYMENT";
      };
      const creator = (by: DemoUserKey | null) => (by ? userIds[by] : null);

      // Time of day: a higher mock id (or later in the list) is newer within a day.
      const rankInDay = new Map<string, number>();
      const timeFor = (date: string) => {
        const n = rankInDay.get(date) ?? 0;
        rankInDay.set(date, n + 1);
        return timeOf(n);
      };

      // Opening balances: 1 Jun, an INCOME (or EXPENSE when negative, cards) record per account (D7).
      for (const o of openings) {
        if (o.signed === 0) continue;
        await tx.record.create({
          data: {
            organizationId: orgId,
            accountId: accountIds[o.account],
            type: o.signed > 0 ? "INCOME" : "EXPENSE",
            paymentType: paymentTypeOf(o.account),
            amount: o.signed,
            note: "Opening balance",
            recordDate: shiftDate(OPENING_DATE, shift),
            recordTime: timeOf(0),
            transfer: false,
          },
        });
      }

      const recordIdByMock = new Map<number, number>();
      const ordered = [...history, ...NOV_RECORDS].sort(
        (a, b) => utcDay(a.date) - utcDay(b.date) || (a.mockId ?? 0) - (b.mockId ?? 0),
      );
      for (const r of ordered) {
        const common = {
          organizationId: orgId,
          paymentType: paymentTypeOf(r.account),
          note: r.note ?? null,
          recordDate: shiftDate(r.date, shift),
          recordTime: timeFor(r.date),
          createdBy: creator(r.by),
        };
        if (r.type === "TRANSFER" && r.toAccount) {
          const exit = await tx.record.create({
            data: {
              ...common,
              type: "TRANSFER",
              transfer: true,
              accountId: accountIds[r.account],
              transferAccountId: accountIds[r.toAccount],
              amount: -r.cents,
            },
            select: { id: true },
          });
          await tx.record.create({
            data: {
              ...common,
              type: "TRANSFER",
              transfer: true,
              accountId: accountIds[r.toAccount],
              transferAccountId: accountIds[r.account],
              amount: r.cents,
              transferGroupId: exit.id,
            },
          });
          await tx.record.update({ where: { id: exit.id }, data: { transferGroupId: exit.id } });
          if (r.mockId) recordIdByMock.set(r.mockId, exit.id);
          continue;
        }
        const created = await tx.record.create({
          data: {
            ...common,
            type: r.type,
            transfer: false,
            accountId: accountIds[r.account],
            categoryId: r.category ? categoryIds.get(r.category)! : null,
            payeeId: r.payee ? payeeIds.get(r.payee)! : null,
            amount: r.type === "EXPENSE" ? -r.cents : r.cents,
            refCurrencyAmount: r.refCurrencyAmount ?? null,
            labels: r.label ? { connect: { id: labelIds.get(r.label)! } } : undefined,
          },
          select: { id: true },
        });
        if (r.mockId) recordIdByMock.set(r.mockId, created.id);
      }

      for (const d of DEBTS) {
        const linked = NOV_RECORDS.filter((r) => r.debt === d.id && r.mockId).map((r) => ({
          id: recordIdByMock.get(r.mockId!)!,
        }));
        await tx.debt.create({
          data: {
            organizationId: orgId,
            accountId: accountIds[d.account],
            type: d.type,
            name: d.name,
            note: d.note,
            amount: d.amount,
            remainingAmount: d.remaining,
            creationDate: shiftDate(d.created, shift),
            payBackDate: shiftDate(d.payBack, shift),
            paidBack: false,
            records: linked.length ? { connect: linked } : undefined,
          },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  console.log(`${LOG.ok}seed-demo Demo Spaces ready: ${DEMO_SLUGS.join(", ")}`);
  console.log(`ℹ️  Sign in as ${DEMO_USERS.maya.email} (the magic link is printed in the Next dev server console).`);

  if (flags.member) {
    const orgs = await db.organization.findMany({
      where: { slug: { in: DEMO_SLUGS } },
      select: { id: true, slug: true },
    });
    await addMember(flags.member, orgs);
  }
}

/** Adds an EXISTING user as `member` of the demo Spaces. Only creates Member rows. */
async function addMember(email: string, orgs: DemoOrgRow[]) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    console.log(`${LOG.err}seed-demo --member: no user with email ${email} (nothing added)`);
    return;
  }
  for (const org of orgs) {
    const found = await db.member.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      select: { id: true },
    });
    if (found) {
      console.log(`${LOG.ok}seed-demo ${email} already belongs to ${org.slug}`);
      continue;
    }
    await db.member.create({ data: { organizationId: org.id, userId: user.id, role: "member" } });
    console.log(`${LOG.ok}seed-demo ${email} added as member of ${org.slug}`);
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG.err}seed-demo ${message}`);
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
    if (code) console.error(`${LOG.err}seed-demo code: ${code}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
