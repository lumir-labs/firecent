import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

/** `Record.amount` is stored in minor units (cents), signed: − out, + in. */
const MINOR_UNIT = 100;

const listInput = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  /**
   * Offset of the next page (tRPC infinite-query cursor). Offset instead of
   * a keyset cursor because `recordDate`/`recordTime` are nullable and a
   * keyset over nullable columns silently skips rows.
   */
  cursor: z.number().int().min(0).nullish(),
  /** Only this account. Enables the running balance per row. */
  accountId: z.number().int().positive().nullish(),
  /** Only this category — a parent category includes its subcategories. */
  categoryId: z.number().int().positive().nullish(),
});

const listOrder = [
  { recordDate: { sort: "desc", nulls: "last" } },
  { recordTime: { sort: "desc", nulls: "last" } },
  { id: "desc" },
] as const;

const createInput = z
  .object({
    type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
    /** Positive amount in minor units; the sign is decided here by `type`. */
    amount: z.number().int().positive().max(2_000_000_000),
    accountId: z.number().int().positive(),
    transferAccountId: z.number().int().positive().nullish(),
    categoryId: z.number().int().positive().nullish(),
    payeeId: z.number().int().positive().nullish(),
    paymentType: z.enum(["CASH", "CREDIT_CARD", "WEB_PAYMENT"]).default("CASH"),
    note: z.string().trim().max(500).nullish(),
    recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recordTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine(
    (v) =>
      v.type !== "TRANSFER" ||
      (v.transferAccountId && v.transferAccountId !== v.accountId),
    { path: ["transferAccountId"], message: "Destination account required" },
  );

const recordSelect = {
  id: true,
  type: true,
  amount: true,
  note: true,
  recordDate: true,
  recordTime: true,
  payee: { select: { name: true } },
  category: { select: { name: true, color: true, icon: true } },
  account: { select: { id: true, name: true, color: true, currency: true } },
  transferAccount: { select: { id: true, name: true, color: true } },
} as const;

function requireOrg(orgId: string | null): string {
  if (!orgId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active organization",
    });
  }
  return orgId;
}

/**
 * `records` router (transactions). Gated with `dashboard:basic` and scoped
 * to `ctx.orgId`. Dates leave as plain strings ("YYYY-MM-DD", "HH:MM")
 * because the tRPC link has no transformer: a `Date` would arrive as a
 * string anyway, with the wrong type.
 */
export const recordsRouter = router({
  /**
   * Paginated transactions, newest first, optionally filtered by account
   * and/or category.
   *
   * Running balance (only with `accountId` and no category filter): the
   * account balance right AFTER each record, i.e. the sum of every record of
   * the account that is that one or older. The account balance is the sum of
   * its records (same rule as the accounts list), so:
   *   balance(row) = Σ all − Σ rows newer than it (in list order).
   */
  list: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const offset = input.cursor ?? 0;

      let categoryIds: number[] | undefined;
      if (input.categoryId) {
        const children = await db.category.findMany({
          where: { organizationId: orgId, parentId: input.categoryId, deletedAt: null },
          select: { id: true },
        });
        categoryIds = [input.categoryId, ...children.map((c) => c.id)];
      }

      // `organizationId` is always in the filter: a foreign id just matches nothing.
      const where = {
        organizationId: orgId,
        deletedAt: null,
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      };
      const withBalance = !!input.accountId && !categoryIds;

      const [rows, total, accountSum, newer] = await Promise.all([
        db.record.findMany({
          where,
          orderBy: [...listOrder],
          skip: offset,
          take: input.limit + 1,
          select: recordSelect,
        }),
        // Only the first page pays for the count.
        offset === 0 ? db.record.count({ where }) : Promise.resolve(null),
        withBalance
          ? db.record.aggregate({ where, _sum: { amount: true } })
          : Promise.resolve(null),
        // Amounts of every row above this page (newer ones).
        withBalance && offset > 0
          ? db.record.findMany({
              where,
              orderBy: [...listOrder],
              take: offset,
              select: { amount: true },
            })
          : Promise.resolve([] as { amount: number }[]),
      ]);

      const hasMore = rows.length > input.limit;
      let running =
        (accountSum?._sum.amount ?? 0) -
        newer.reduce((sum, r) => sum + r.amount, 0);

      const items = rows.slice(0, input.limit).map((r) => {
        const balance = withBalance ? running / MINOR_UNIT : null;
        running -= r.amount;
        return {
          id: r.id,
          type: r.type,
          amount: r.amount / MINOR_UNIT,
          note: r.note,
          date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
          time: r.recordTime ? r.recordTime.toISOString().slice(11, 16) : null,
          payee: r.payee?.name ?? null,
          category: r.category,
          account: r.account,
          transferAccount: r.transferAccount,
          /** Account balance after this record; null without an account filter. */
          balance,
        };
      });

      return {
        items,
        total,
        nextCursor: hasMore ? offset + input.limit : null,
      };
    }),

  /** Catalogs for the "new transaction" form, in one round-trip. */
  formOptions: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .query(async ({ ctx }) => {
      const orgId = requireOrg(ctx.orgId);
      const [accounts, categories, payees] = await Promise.all([
        db.bankAccount.findMany({
          where: { organizationId: orgId, deletedAt: null, archived: false },
          select: { id: true, name: true, color: true, currency: true },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        }),
        db.category.findMany({
          where: { organizationId: orgId, deletedAt: null, hidden: false },
          select: { id: true, name: true, color: true, icon: true, parentId: true },
          orderBy: { name: "asc" },
        }),
        db.payee.findMany({
          where: { organizationId: orgId, deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);
      return { accounts, categories, payees };
    }),

  /**
   * Creates a transaction. Same rules as the original `createRecord`:
   * - EXPENSE is stored negative, INCOME positive.
   * - TRANSFER creates TWO linked records in one DB transaction: the exit
   *   (origin, negative) and the entry (destination, positive), both with
   *   `transfer = true` and `transferGroupId = exit.id`.
   * Every referenced id must belong to the active organization.
   * Account balances are the sum of their records, so nothing else to update.
   */
  create: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;
      const isTransfer = input.type === "TRANSFER";

      // ── Ownership: never write against another org's rows ──
      const accountIds = [input.accountId];
      if (isTransfer && input.transferAccountId) {
        accountIds.push(input.transferAccountId);
      }
      const [accountCount, category, payee] = await Promise.all([
        db.bankAccount.count({
          where: { id: { in: accountIds }, organizationId: orgId, deletedAt: null },
        }),
        !isTransfer && input.categoryId
          ? db.category.findFirst({
              where: { id: input.categoryId, organizationId: orgId, deletedAt: null },
              select: { id: true },
            })
          : null,
        !isTransfer && input.payeeId
          ? db.payee.findFirst({
              where: { id: input.payeeId, organizationId: orgId, deletedAt: null },
              select: { id: true },
            })
          : null,
      ]);
      if (
        accountCount !== accountIds.length ||
        (!isTransfer && input.categoryId && !category) ||
        (!isTransfer && input.payeeId && !payee)
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid reference" });
      }

      const common = {
        organizationId: orgId,
        paymentType: input.paymentType,
        note: input.note || null,
        recordDate: new Date(`${input.recordDate}T00:00:00.000Z`),
        recordTime: new Date(`1970-01-01T${input.recordTime}:00.000Z`),
        createdBy: userId,
      };

      if (isTransfer && input.transferAccountId) {
        const to = input.transferAccountId;
        const exitId = await db.$transaction(async (tx) => {
          const exit = await tx.record.create({
            data: {
              ...common,
              type: "TRANSFER",
              transfer: true,
              accountId: input.accountId,
              transferAccountId: to,
              amount: -input.amount,
            },
            select: { id: true },
          });
          await tx.record.create({
            data: {
              ...common,
              type: "TRANSFER",
              transfer: true,
              accountId: to,
              transferAccountId: input.accountId,
              amount: input.amount,
              transferGroupId: exit.id,
            },
          });
          await tx.record.update({
            where: { id: exit.id },
            data: { transferGroupId: exit.id },
          });
          return exit.id;
        });
        return { id: exitId };
      }

      const record = await db.record.create({
        data: {
          ...common,
          type: input.type,
          transfer: false,
          accountId: input.accountId,
          categoryId: input.categoryId ?? null,
          payeeId: input.payeeId ?? null,
          amount: input.type === "EXPENSE" ? -input.amount : input.amount,
        },
        select: { id: true },
      });
      return { id: record.id };
    }),
});
