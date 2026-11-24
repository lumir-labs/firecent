import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

const MINOR_UNIT = 100;

function requireOrg(orgId: string | null): string {
  if (!orgId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active organization",
    });
  }
  return orgId;
}

function daysUntil(date: Date | null, now = new Date()): number | null {
  if (!date) return null;
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const targetUtc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  return Math.round(
    (targetUtc.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export const debtsRouter = router({
  list: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .query(async ({ ctx }) => {
      const orgId = requireOrg(ctx.orgId);

      const [debts, accounts] = await Promise.all([
        db.debt.findMany({
          where: { organizationId: orgId, deletedAt: null },
          include: {
            account: { select: { id: true, name: true, currency: true } },
            _count: { select: { records: true } },
          },
          orderBy: [
            { paidBack: "asc" },
            { payBackDate: { sort: "asc", nulls: "last" } },
            { creationDate: "desc" },
          ],
        }),
        db.bankAccount.findMany({
          where: { organizationId: orgId, deletedAt: null, archived: false },
          select: { currency: true },
        }),
      ]);

      const curCount = new Map<string, number>();
      for (const a of accounts) {
        curCount.set(a.currency, (curCount.get(a.currency) ?? 0) + 1);
      }
      const defaultCurrency =
        [...curCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

      const now = new Date();
      const items = debts.map((d) => {
        const rawTotalMinor = Math.abs(d.amount);
        const remainingMinor = d.paidBack
          ? 0
          : d.remainingAmount != null
            ? Math.abs(d.remainingAmount)
            : rawTotalMinor;
        const totalMinor = Math.max(rawTotalMinor, remainingMinor);
        const paidMinor = Math.max(0, totalMinor - remainingMinor);
        const progressPct =
          totalMinor > 0
            ? Math.min(100, Math.round((paidMinor / totalMinor) * 1000) / 10)
            : d.paidBack
              ? 100
              : 0;
        const currency = d.account?.currency || d.currency || defaultCurrency;

        return {
          id: d.id,
          type: d.type,
          name: d.name,
          note: d.note,
          currency,
          totalAmount: totalMinor / MINOR_UNIT,
          remainingAmount: remainingMinor / MINOR_UNIT,
          paidAmount: paidMinor / MINOR_UNIT,
          progressPct,
          creationDate: d.creationDate.toISOString().slice(0, 10),
          payBackDate: d.payBackDate
            ? d.payBackDate.toISOString().slice(0, 10)
            : null,
          dueInDays: d.paidBack ? null : daysUntil(d.payBackDate, now),
          paidBack: d.paidBack,
          account: d.account,
          paymentCount: d._count.records,
        };
      });

      // Wallet/DB convention:
      // ANYONE_TO_ME = someone lent/gave money to me → You owe
      // ME_TO_ANYONE = I lent money to someone → Owed to you
      const youOwe = items.filter((d) => !d.paidBack && d.type === "ANYONE_TO_ME");
      const owedToYou = items.filter(
        (d) => !d.paidBack && d.type === "ME_TO_ANYONE",
      );
      const settled = items.filter((d) => d.paidBack);

      const youOweTotal = youOwe.reduce((s, d) => s + d.remainingAmount, 0);
      const owedToYouTotal = owedToYou.reduce(
        (s, d) => s + d.remainingAmount,
        0,
      );

      return {
        currency: defaultCurrency,
        youOweTotal,
        owedToYouTotal,
        youOwe,
        owedToYou,
        settled,
        totalCount: items.length,
      };
    }),

  get: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);

      const d = await db.debt.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        include: {
          account: { select: { id: true, name: true, currency: true } },
          records: {
            where: { deletedAt: null },
            orderBy: [
              { recordDate: { sort: "desc", nulls: "last" } },
              { id: "desc" },
            ],
            select: {
              id: true,
              type: true,
              amount: true,
              note: true,
              recordDate: true,
              account: { select: { id: true, name: true, currency: true } },
            },
          },
        },
      });
      if (!d) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Debt not found" });
      }

      const rawTotalMinor = Math.abs(d.amount);
      const remainingMinor = d.paidBack
        ? 0
        : d.remainingAmount != null
          ? Math.abs(d.remainingAmount)
          : rawTotalMinor;
      const totalMinor = Math.max(rawTotalMinor, remainingMinor);
      const paidMinor = Math.max(0, totalMinor - remainingMinor);
      const progressPct =
        totalMinor > 0
          ? Math.min(100, Math.round((paidMinor / totalMinor) * 1000) / 10)
          : d.paidBack
            ? 100
            : 0;
      const currency = d.account?.currency || d.currency || "USD";

      return {
        id: d.id,
        type: d.type,
        name: d.name,
        note: d.note,
        currency,
        totalAmount: totalMinor / MINOR_UNIT,
        remainingAmount: remainingMinor / MINOR_UNIT,
        paidAmount: paidMinor / MINOR_UNIT,
        progressPct,
        creationDate: d.creationDate.toISOString().slice(0, 10),
        payBackDate: d.payBackDate
          ? d.payBackDate.toISOString().slice(0, 10)
          : null,
        dueInDays: d.paidBack ? null : daysUntil(d.payBackDate),
        paidBack: d.paidBack,
        account: d.account,
        payments: d.records.map((r) => ({
          id: r.id,
          type: r.type,
          amount: r.amount / MINOR_UNIT,
          currency: r.account.currency,
          date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
          note: r.note,
          accountName: r.account.name,
        })),
      };
    }),

  create: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        type: z.enum(["ME_TO_ANYONE", "ANYONE_TO_ME"]),
        name: z.string().trim().min(1).max(100),
        /** Positive amount in major units */
        amount: z.number().positive().max(20_000_000),
        currency: z.string().trim().min(3).max(3).default("USD"),
        creationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        payBackDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
        note: z.string().trim().max(500).nullish(),
        accountId: z.number().int().positive().nullish(),
        alsoRecordInAccount: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      let accountCurrency = input.currency.toUpperCase();
      if (input.accountId) {
        const acc = await db.bankAccount.findFirst({
          where: { id: input.accountId, organizationId: orgId, deletedAt: null },
          select: { id: true, currency: true },
        });
        if (!acc) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid account" });
        }
        accountCurrency = acc.currency;
      }

      const amountMinor = Math.round(input.amount * MINOR_UNIT);
      const created = await db.$transaction(async (tx) => {
        const debt = await tx.debt.create({
          data: {
            organizationId: orgId,
            type: input.type,
            name: input.name,
            note: input.note || null,
            amount: amountMinor,
            remainingAmount: amountMinor,
            currency: accountCurrency,
            creationDate: new Date(`${input.creationDate}T00:00:00.000Z`),
            payBackDate: input.payBackDate
              ? new Date(`${input.payBackDate}T00:00:00.000Z`)
              : null,
            accountId: input.accountId ?? null,
            paidBack: false,
            createdBy: userId,
          },
          select: { id: true },
        });

        if (input.alsoRecordInAccount && input.accountId) {
          // ME_TO_ANYONE = I lent money out (-amount); ANYONE_TO_ME = I borrowed / received money (+amount).
          // Marked excludeFromStats = true per SPEC §5.9 (not spending/income).
          const isLending = input.type === "ME_TO_ANYONE";
          await tx.record.create({
            data: {
              organizationId: orgId,
              accountId: input.accountId,
              type: isLending ? "EXPENSE" : "INCOME",
              amount: isLending ? -amountMinor : amountMinor,
              note: isLending
                ? `Lent to ${input.name}`
                : `Borrowed from ${input.name}`,
              excludeFromStats: true,
              recordDate: new Date(`${input.creationDate}T00:00:00.000Z`),
              recordTime: new Date("1970-01-01T12:00:00.000Z"),
              createdBy: userId,
            },
          });
        }

        return debt;
      });

      return { id: created.id };
    }),

  update: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(100).optional(),
        note: z.string().trim().max(500).nullish(),
        payBackDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
        remainingAmount: z.number().nonnegative().max(20_000_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const existing = await db.debt.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Debt not found" });
      }

      const remMinor =
        input.remainingAmount !== undefined
          ? Math.round(input.remainingAmount * MINOR_UNIT)
          : undefined;

      await db.debt.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.note !== undefined ? { note: input.note || null } : {}),
          ...(input.payBackDate !== undefined
            ? {
                payBackDate: input.payBackDate
                  ? new Date(`${input.payBackDate}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(remMinor !== undefined
            ? { remainingAmount: remMinor, paidBack: remMinor === 0 }
            : {}),
          updatedBy: userId,
        },
      });
      return { id: existing.id };
    }),

  recordPayment: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        debtId: z.number().int().positive(),
        /** Payment amount in major units */
        amount: z.number().positive().max(20_000_000),
        accountId: z.number().int().positive().nullish(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().trim().max(300).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const debt = await db.debt.findFirst({
        where: { id: input.debtId, organizationId: orgId, deletedAt: null },
      });
      if (!debt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Debt not found" });
      }

      if (input.accountId) {
        const acc = await db.bankAccount.findFirst({
          where: { id: input.accountId, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        if (!acc) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid account" });
        }
      }

      const payMinor = Math.round(input.amount * MINOR_UNIT);
      const currentRem =
        debt.remainingAmount != null
          ? Math.max(0, Math.abs(debt.remainingAmount))
          : Math.abs(debt.amount);
      const nextRem = Math.max(0, currentRem - payMinor);
      const nowTime = new Date().toISOString().slice(11, 16);

      await db.$transaction(async (tx) => {
        let recordId: number | null = null;
        if (input.accountId) {
          // ANYONE_TO_ME = paying back own debt = normal EXPENSE in Owe (DEBO).
          // ME_TO_ANYONE = collecting money owed to you = INCOME with excludeFromStats: true (SPEC §5.9).
          const isPayingOwnDebt = debt.type === "ANYONE_TO_ME";
          const rec = await tx.record.create({
            data: {
              organizationId: orgId,
              accountId: input.accountId,
              type: isPayingOwnDebt ? "EXPENSE" : "INCOME",
              spendingNature: isPayingOwnDebt ? "DEBO" : null,
              excludeFromStats: !isPayingOwnDebt,
              amount: isPayingOwnDebt ? -payMinor : payMinor,
              note:
                input.note ||
                (isPayingOwnDebt
                  ? `Debt payment · ${debt.name}`
                  : `Repayment from ${debt.name}`),
              recordDate: new Date(`${input.date}T00:00:00.000Z`),
              recordTime: new Date(`1970-01-01T${nowTime}:00.000Z`),
              createdBy: userId,
            },
            select: { id: true },
          });
          recordId = rec.id;
        }

        await tx.debt.update({
          where: { id: debt.id },
          data: {
            remainingAmount: nextRem,
            paidBack: nextRem === 0,
            updatedBy: userId,
            ...(recordId ? { records: { connect: { id: recordId } } } : {}),
          },
        });
      });

      return { id: debt.id, remainingAmount: nextRem / MINOR_UNIT, paidBack: nextRem === 0 };
    }),

  settle: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive(), settled: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const debt = await db.debt.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true, amount: true },
      });
      if (!debt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Debt not found" });
      }

      await db.debt.update({
        where: { id: debt.id },
        data: {
          paidBack: input.settled,
          remainingAmount: input.settled ? 0 : Math.abs(debt.amount),
          updatedBy: userId,
        },
      });
      return { id: debt.id, paidBack: input.settled };
    }),

  delete: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const debt = await db.debt.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!debt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Debt not found" });
      }

      await db.debt.update({
        where: { id: debt.id },
        data: { deletedAt: new Date(), deletedBy: userId },
      });
      return { id: debt.id };
    }),

  restore: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const debt = await db.debt.findFirst({
        where: { id: input.id, organizationId: orgId },
        select: { id: true },
      });
      if (!debt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Debt not found" });
      }

      await db.debt.update({
        where: { id: debt.id },
        data: { deletedAt: null, deletedBy: null, updatedBy: userId },
      });
      return { id: debt.id };
    }),
});
