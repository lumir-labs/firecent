import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import {
  computeInstallmentRemaining,
  computeLastCycleDate,
  computeNextCycleDate,
  summarizeCardInstallments,
} from "../lib/card-cycle";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

const MINOR_UNIT = 100;
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish();

function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function requireOrgAndUser(orgId: string | null, userId: string | undefined) {
  if (!orgId || !userId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active organization",
    });
  }
  return { orgId, userId };
}

const createAccountInput = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["CHECKING_ACCOUNT", "SAVINGS_ACCOUNT", "CASH", "CREDIT_CARD"]),
  currency: z.string().trim().min(3).max(3).default("USD"),
  color: z.string().trim().max(32).nullish(),
  hasCard: z.boolean().default(false),
  accountNumber: z.string().trim().max(16).nullish(),
  /** Initial balance in major units. For CREDIT_CARD, positive = current balance owed. */
  currentBalance: z.number().finite().default(0),
  /** Credit limit in major units (CREDIT_CARD only). */
  creditLimit: z.number().positive().nullish(),
  paymentDayType: z.enum(["MONTHLY_DAY", "EVERY_X_DAYS"]).default("MONTHLY_DAY"),
  paymentDay: z.number().int().min(1).max(31).nullish(),
  paymentEveryDays: z.number().int().min(1).max(365).nullish(),
  paymentAnchorDate: isoDateSchema,
  cutoffDayType: z.enum(["MONTHLY_DAY", "EVERY_X_DAYS"]).default("MONTHLY_DAY"),
  cutoffDay: z.number().int().min(1).max(31).nullish(),
  cutoffEveryDays: z.number().int().min(1).max(365).nullish(),
  cutoffAnchorDate: isoDateSchema,
  interestRate: z.number().min(0).max(200).nullish(),
  displayCreditMode: z
    .enum(["CREDIT_BALANCE", "AVAILABLE_CREDIT"])
    .default("CREDIT_BALANCE"),
  excludeFromStats: z.boolean().default(false),
});

const updateAccountInput = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(80).optional(),
  type: z
    .enum(["CHECKING_ACCOUNT", "SAVINGS_ACCOUNT", "CASH", "CREDIT_CARD"])
    .optional(),
  color: z.string().trim().max(32).nullish(),
  hasCard: z.boolean().optional(),
  accountNumber: z.string().trim().max(16).nullish(),
  creditLimit: z.number().positive().nullish(),
  paymentDay: z.number().int().min(1).max(31).nullish(),
  paymentDayType: z.enum(["MONTHLY_DAY", "EVERY_X_DAYS"]).nullish(),
  paymentEveryDays: z.number().int().min(1).max(365).nullish(),
  paymentAnchorDate: isoDateSchema,
  cutoffDay: z.number().int().min(1).max(31).nullish(),
  cutoffDayType: z.enum(["MONTHLY_DAY", "EVERY_X_DAYS"]).nullish(),
  cutoffEveryDays: z.number().int().min(1).max(365).nullish(),
  cutoffAnchorDate: isoDateSchema,
  interestRate: z.number().min(0).max(200).nullish(),
  displayCreditMode: z.enum(["CREDIT_BALANCE", "AVAILABLE_CREDIT"]).optional(),
  excludeFromStats: z.boolean().optional(),
});

export const accountsRouter = router({
  list: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .query(async ({ ctx }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const [accounts, sums, unpaidDebts] = await Promise.all([
        db.bankAccount.findMany({
          where: { organizationId: orgId, deletedAt: null, archived: false },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        }),
        db.record.groupBy({
          by: ["accountId"],
          where: { organizationId: orgId, deletedAt: null },
          _sum: { amount: true },
        }),
        db.debt.findMany({
          where: { organizationId: orgId, deletedAt: null, paidBack: false },
          select: { id: true, type: true, amount: true, remainingAmount: true },
        }),
      ]);

      const balanceByAccount = new Map<number, number>();
      for (const s of sums) {
        balanceByAccount.set(s.accountId, s._sum.amount ?? 0);
      }

      const rollingCardIds = accounts
        .filter(
          (a) =>
            a.type === "CREDIT_CARD" &&
            a.paymentDayType === "EVERY_X_DAYS" &&
            a.paymentEveryDays != null &&
            !a.paymentAnchorDate,
        )
        .map((a) => a.id);

      const lastPaymentByAccount = new Map<number, Date>();
      if (rollingCardIds.length > 0) {
        const lastPayments = await db.record.groupBy({
          by: ["accountId"],
          where: {
            organizationId: orgId,
            accountId: { in: rollingCardIds },
            deletedAt: null,
            amount: { gt: 0 },
            recordDate: { not: null },
          },
          _max: { recordDate: true },
        });
        for (const p of lastPayments) {
          if (p._max.recordDate) {
            lastPaymentByAccount.set(p.accountId, p._max.recordDate);
          }
        }
      }

      const items = accounts.map((a) => {
        const balanceMinor = balanceByAccount.get(a.id) ?? 0;
        const balance = balanceMinor / MINOR_UNIT;
        const isCard = a.type === "CREDIT_CARD";
        const creditLimit = a.creditLimit != null ? a.creditLimit / MINOR_UNIT : null;
        const debt = isCard ? Math.max(0, -balance) : 0;
        const available =
          isCard && creditLimit != null ? Math.max(0, creditLimit - debt) : null;
        const due = isCard
          ? computeNextCycleDate(
              a.paymentDayType,
              a.paymentDay,
              a.paymentEveryDays,
              a.paymentAnchorDate,
              lastPaymentByAccount.get(a.id) ?? null,
            )
          : { nextDate: null, inDays: null };
        const cutoff = isCard
          ? computeNextCycleDate(
              a.cutoffDayType,
              a.cutoffDay,
              a.cutoffEveryDays,
              a.cutoffAnchorDate,
              null,
            )
          : { nextDate: null, inDays: null };

        return {
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          color: a.color,
          hasCard: a.hasCard,
          accountNumber: a.accountNumber,
          excludeFromStats: a.excludeFromStats,
          displayCreditMode: a.displayCreditMode ?? "CREDIT_BALANCE",
          creditLimit,
          paymentDayType: a.paymentDayType ?? "MONTHLY_DAY",
          paymentDay: a.paymentDay,
          paymentEveryDays: a.paymentEveryDays,
          paymentAnchorDate: toIsoDate(a.paymentAnchorDate),
          cutoffDayType: a.cutoffDayType ?? "MONTHLY_DAY",
          cutoffDay: a.cutoffDay,
          cutoffEveryDays: a.cutoffEveryDays,
          cutoffAnchorDate: toIsoDate(a.cutoffAnchorDate),
          interestRate: a.interestRate,
          ownerId: a.userId,
          isOwner: a.userId === userId,
          balance,
          debt,
          available,
          nextDueDate: due.nextDate,
          dueInDays: due.inDays,
          nextCutoffDate: cutoff.nextDate,
          cutoffInDays: cutoff.inDays,
        };
      });

      const cash = items.filter(
        (a) =>
          a.type === "CHECKING_ACCOUNT" ||
          a.type === "CASH" ||
          a.type === "BANK" ||
          a.type === "GENERAL",
      );
      const savings = items.filter((a) => a.type === "SAVINGS_ACCOUNT");
      const cards = items.filter((a) => a.type === "CREDIT_CARD");

      // Totals by currency (excluding excludeFromStats for hero)
      const countByCurrency = new Map<string, number>();
      const statsItems = items.filter((a) => !a.excludeFromStats);
      for (const a of statsItems) {
        countByCurrency.set(a.currency, (countByCurrency.get(a.currency) ?? 0) + 1);
      }
      const rankedCurrencies = [...countByCurrency.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );

      const totalsByCurrency = rankedCurrencies.map(([currency]) => {
        const curItems = statsItems.filter((a) => a.currency === currency);
        let inAccounts = 0;
        let onCards = 0;
        for (const a of curItems) {
          if (a.type === "CREDIT_CARD") {
            onCards += a.balance; // negative when owed
          } else {
            inAccounts += a.balance;
          }
        }
        return {
          currency,
          total: inAccounts + onCards,
          inAccounts,
          onCards,
        };
      });

      const primary = totalsByCurrency[0] ?? null;
      const others = totalsByCurrency.slice(1);

      const unpaidDebtsTotal =
        unpaidDebts.reduce(
          (sum, d) => sum + Math.abs(d.remainingAmount ?? d.amount),
          0,
        ) / MINOR_UNIT;

      return {
        items,
        groups: { cash, savings, cards },
        primary,
        others,
        debts: {
          count: unpaidDebts.length,
          total: unpaidDebtsTotal,
        },
      };
    }),

  get: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const account = await db.bankAccount.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      const now = new Date();
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const nextMonthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
      );

      const lastCutoff =
        account.type === "CREDIT_CARD"
          ? computeLastCycleDate(
              account.cutoffDayType,
              account.cutoffDay,
              account.cutoffEveryDays,
              account.cutoffAnchorDate,
              now,
            )
          : null;

      const [
        totalAgg,
        monthRecords,
        lastPayment,
        cutoffBalanceAgg,
        paymentsSinceCutoffAgg,
        rawInstallments,
      ] = await Promise.all([
        db.record.aggregate({
          where: {
            organizationId: orgId,
            accountId: account.id,
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
        db.record.findMany({
          where: {
            organizationId: orgId,
            accountId: account.id,
            deletedAt: null,
            recordDate: { gte: monthStart, lt: nextMonthStart },
          },
          select: { amount: true },
        }),
        account.type === "CREDIT_CARD" &&
        account.paymentDayType === "EVERY_X_DAYS" &&
        !account.paymentAnchorDate
          ? db.record.findFirst({
              where: {
                organizationId: orgId,
                accountId: account.id,
                deletedAt: null,
                amount: { gt: 0 },
                recordDate: { not: null },
              },
              orderBy: [{ recordDate: "desc" }, { id: "desc" }],
              select: { recordDate: true },
            })
          : Promise.resolve(null),
        lastCutoff
          ? db.record.aggregate({
              where: {
                organizationId: orgId,
                accountId: account.id,
                deletedAt: null,
                OR: [{ recordDate: { lte: lastCutoff } }, { recordDate: null }],
              },
              _sum: { amount: true },
            })
          : Promise.resolve(null),
        lastCutoff
          ? db.record.aggregate({
              where: {
                organizationId: orgId,
                accountId: account.id,
                deletedAt: null,
                amount: { gt: 0 },
                recordDate: { gt: lastCutoff },
              },
              _sum: { amount: true },
            })
          : Promise.resolve(null),
        account.type === "CREDIT_CARD"
          ? db.cardInstallment.findMany({
              where: {
                organizationId: orgId,
                accountId: account.id,
                deletedAt: null,
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            })
          : Promise.resolve([]),
      ]);

      const balanceMinor = totalAgg._sum.amount ?? 0;
      let monthInMinor = 0;
      let monthOutMinor = 0;
      let monthDeltaMinor = 0;
      for (const r of monthRecords) {
        monthDeltaMinor += r.amount;
        if (r.amount >= 0) monthInMinor += r.amount;
        else monthOutMinor += -r.amount;
      }

      const balance = balanceMinor / MINOR_UNIT;
      const isCard = account.type === "CREDIT_CARD";
      const creditLimit =
        account.creditLimit != null ? account.creditLimit / MINOR_UNIT : null;
      const debtMinor = isCard ? Math.max(0, -balanceMinor) : 0;
      const debt = debtMinor / MINOR_UNIT;
      const available =
        isCard && creditLimit != null ? Math.max(0, creditLimit - debt) : null;

      const installments = rawInstallments.map((inst) => {
        const major = {
          totalAmount: inst.totalAmount / MINOR_UNIT,
          totalInstallments: inst.totalInstallments,
          paidInstallments: inst.paidInstallments,
          monthlyAmount: inst.monthlyAmount / MINOR_UNIT,
          interestRate: inst.interestRate,
          includedInBalance: inst.includedInBalance,
        };
        const calc = computeInstallmentRemaining(major);
        return {
          id: inst.id,
          title: inst.title,
          ...major,
          startDate: inst.startDate.toISOString().slice(0, 10),
          note: inst.note,
          remainingInstallments: calc.remainingInstallments,
          remainingTotal: calc.remainingTotal,
          remainingPrincipal: calc.remainingPrincipal,
          monthlyInterest: calc.monthlyInterest,
        };
      });

      const installmentsSummary = isCard
        ? summarizeCardInstallments(debt, installments)
        : {
            activeCount: 0,
            deferredInBalance: 0,
            totalRemaining: 0,
            monthlyTotal: 0,
            monthlyInterest: 0,
            revolvingDebt: 0,
          };

      let statementBalance: number | null = null;
      let cashPayment: number | null = null;
      if (isCard && lastCutoff && cutoffBalanceAgg) {
        const owedAtCutoffMinor = Math.max(
          0,
          -(cutoffBalanceAgg._sum.amount ?? 0),
        );
        const paidSinceCutoffMinor = paymentsSinceCutoffAgg?._sum.amount ?? 0;
        const deferredMinor = Math.round(
          installmentsSummary.deferredInBalance * MINOR_UNIT,
        );
        const remainingCashMinor = Math.max(
          0,
          Math.min(
            debtMinor,
            owedAtCutoffMinor - paidSinceCutoffMinor - deferredMinor,
          ),
        );
        statementBalance = owedAtCutoffMinor / MINOR_UNIT;
        cashPayment = remainingCashMinor / MINOR_UNIT;
      }

      const due = isCard
        ? computeNextCycleDate(
            account.paymentDayType,
            account.paymentDay,
            account.paymentEveryDays,
            account.paymentAnchorDate,
            lastPayment?.recordDate ?? null,
          )
        : { nextDate: null, inDays: null };
      const cutoff = isCard
        ? computeNextCycleDate(
            account.cutoffDayType,
            account.cutoffDay,
            account.cutoffEveryDays,
            account.cutoffAnchorDate,
            null,
          )
        : { nextDate: null, inDays: null };

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        color: account.color,
        hasCard: account.hasCard,
        accountNumber: account.accountNumber,
        archived: account.archived,
        excludeFromStats: account.excludeFromStats,
        displayCreditMode: account.displayCreditMode ?? "CREDIT_BALANCE",
        creditLimit,
        paymentDayType: account.paymentDayType ?? "MONTHLY_DAY",
        paymentDay: account.paymentDay,
        paymentEveryDays: account.paymentEveryDays,
        paymentAnchorDate: toIsoDate(account.paymentAnchorDate),
        cutoffDayType: account.cutoffDayType ?? "MONTHLY_DAY",
        cutoffDay: account.cutoffDay,
        cutoffEveryDays: account.cutoffEveryDays,
        cutoffAnchorDate: toIsoDate(account.cutoffAnchorDate),
        interestRate: account.interestRate,
        ownerId: account.userId,
        isOwner: account.userId === userId,
        balance,
        debt,
        revolvingDebt: installmentsSummary.revolvingDebt,
        installments,
        installmentsSummary,
        available,
        lastCutoffDate: toIsoDate(lastCutoff),
        statementBalance,
        cashPayment,
        nextDueDate: due.nextDate,
        dueInDays: due.inDays,
        nextCutoffDate: cutoff.nextDate,
        cutoffInDays: cutoff.inDays,
        monthChange: monthDeltaMinor / MINOR_UNIT,
        monthIn: monthInMinor / MINOR_UNIT,
        monthOut: monthOutMinor / MINOR_UNIT,
      };
    }),

  create: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(createAccountInput)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const existing = await db.bankAccount.findFirst({
        where: {
          organizationId: orgId,
          name: { equals: input.name, mode: "insensitive" },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That name is taken in this space.",
        });
      }

      const initialMinor = Math.round(input.currentBalance * MINOR_UNIT);
      const isCard = input.type === "CREDIT_CARD";

      const created = await db.$transaction(async (tx) => {
        const acc = await tx.bankAccount.create({
          data: {
            organizationId: orgId,
            userId,
            name: input.name,
            type: input.type,
            currency: input.currency.toUpperCase(),
            color: input.color ?? null,
            hasCard:
              input.type === "CHECKING_ACCOUNT" ||
              input.type === "SAVINGS_ACCOUNT"
                ? input.hasCard
                : false,
            accountNumber: input.accountNumber ?? null,
            creditLimit:
              isCard && input.creditLimit != null
                ? Math.round(input.creditLimit * MINOR_UNIT)
                : null,
            paymentDayType: isCard ? input.paymentDayType : null,
            paymentDay:
              isCard && input.paymentDayType === "MONTHLY_DAY"
                ? (input.paymentDay ?? null)
                : null,
            paymentEveryDays:
              isCard && input.paymentDayType === "EVERY_X_DAYS"
                ? (input.paymentEveryDays ?? null)
                : null,
            paymentAnchorDate:
              isCard && input.paymentDayType === "EVERY_X_DAYS"
                ? parseIsoDate(input.paymentAnchorDate)
                : null,
            cutoffDayType: isCard ? input.cutoffDayType : null,
            cutoffDay:
              isCard && input.cutoffDayType === "MONTHLY_DAY"
                ? (input.cutoffDay ?? null)
                : null,
            cutoffEveryDays:
              isCard && input.cutoffDayType === "EVERY_X_DAYS"
                ? (input.cutoffEveryDays ?? null)
                : null,
            cutoffAnchorDate:
              isCard && input.cutoffDayType === "EVERY_X_DAYS"
                ? parseIsoDate(input.cutoffAnchorDate)
                : null,
            interestRate: isCard ? (input.interestRate ?? null) : null,
            displayCreditMode: input.displayCreditMode,
            excludeFromStats: input.excludeFromStats,
            createdBy: userId,
          },
          select: { id: true },
        });

        if (initialMinor !== 0) {
          // For a credit card, a positive entered balance means debt (-amount, EXPENSE).
          const signedMinor = isCard ? -Math.abs(initialMinor) : initialMinor;
          await tx.record.create({
            data: {
              organizationId: orgId,
              accountId: acc.id,
              type: signedMinor >= 0 ? "INCOME" : "EXPENSE",
              amount: signedMinor,
              note: "Opening balance",
              recordDate: new Date(
                new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
              ),
              recordTime: new Date("1970-01-01T00:00:00.000Z"),
              createdBy: userId,
            },
          });
        }

        return acc;
      });

      return { id: created.id };
    }),

  update: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(updateAccountInput)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const account = await db.bankAccount.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true, userId: true, name: true, type: true },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      if (account.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the account owner can edit this account.",
        });
      }

      if (input.name && input.name.toLowerCase() !== account.name.toLowerCase()) {
        const collision = await db.bankAccount.findFirst({
          where: {
            organizationId: orgId,
            name: { equals: input.name, mode: "insensitive" },
            deletedAt: null,
            id: { not: account.id },
          },
          select: { id: true },
        });
        if (collision) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That name is taken in this space.",
          });
        }
      }

      const nextType = input.type ?? account.type;
      const isCard = nextType === "CREDIT_CARD";

      await db.bankAccount.update({
        where: { id: account.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(nextType === "CHECKING_ACCOUNT" || nextType === "SAVINGS_ACCOUNT"
            ? input.hasCard !== undefined
              ? { hasCard: input.hasCard }
              : {}
            : { hasCard: false }),
          ...(input.accountNumber !== undefined
            ? { accountNumber: input.accountNumber }
            : {}),
          ...(!isCard
            ? {
                creditLimit: null,
                paymentDay: null,
                paymentDayType: null,
                paymentEveryDays: null,
                paymentAnchorDate: null,
                cutoffDay: null,
                cutoffDayType: null,
                cutoffEveryDays: null,
                cutoffAnchorDate: null,
                interestRate: null,
              }
            : {
                ...(input.creditLimit !== undefined
                  ? {
                      creditLimit:
                        input.creditLimit != null
                          ? Math.round(input.creditLimit * MINOR_UNIT)
                          : null,
                    }
                  : {}),
                ...(input.paymentDay !== undefined
                  ? { paymentDay: input.paymentDay }
                  : {}),
                ...(input.paymentDayType !== undefined
                  ? { paymentDayType: input.paymentDayType }
                  : {}),
                ...(input.paymentEveryDays !== undefined
                  ? { paymentEveryDays: input.paymentEveryDays }
                  : {}),
                ...(input.paymentAnchorDate !== undefined
                  ? { paymentAnchorDate: parseIsoDate(input.paymentAnchorDate) }
                  : {}),
                ...(input.cutoffDay !== undefined
                  ? { cutoffDay: input.cutoffDay }
                  : {}),
                ...(input.cutoffDayType !== undefined
                  ? { cutoffDayType: input.cutoffDayType }
                  : {}),
                ...(input.cutoffEveryDays !== undefined
                  ? { cutoffEveryDays: input.cutoffEveryDays }
                  : {}),
                ...(input.cutoffAnchorDate !== undefined
                  ? { cutoffAnchorDate: parseIsoDate(input.cutoffAnchorDate) }
                  : {}),
                ...(input.interestRate !== undefined
                  ? { interestRate: input.interestRate }
                  : {}),
              }),
          ...(input.displayCreditMode !== undefined
            ? { displayCreditMode: input.displayCreditMode }
            : {}),
          ...(input.excludeFromStats !== undefined
            ? { excludeFromStats: input.excludeFromStats }
            : {}),
          updatedBy: userId,
        },
      });

      return { id: account.id };
    }),

  adjustBalance: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        id: z.number().int().positive(),
        /** Desired real balance in major units (for credit cards, pass negative for owed or use isCard). */
        actualBalance: z.number().finite(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const account = await db.bankAccount.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true, type: true },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      const agg = await db.record.aggregate({
        where: { organizationId: orgId, accountId: account.id, deletedAt: null },
        _sum: { amount: true },
      });
      const currentMinor = agg._sum.amount ?? 0;
      const targetMinor = Math.round(input.actualBalance * MINOR_UNIT);
      const diffMinor = targetMinor - currentMinor;

      if (diffMinor === 0) {
        return { adjusted: false, recordId: null };
      }

      const now = new Date();
      const record = await db.record.create({
        data: {
          organizationId: orgId,
          accountId: account.id,
          type: diffMinor > 0 ? "INCOME" : "EXPENSE",
          amount: diffMinor,
          note: "Balance adjustment",
          recordDate: new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z"),
          recordTime: new Date(
            `1970-01-01T${now.toISOString().slice(11, 16)}:00.000Z`,
          ),
          createdBy: userId,
        },
        select: { id: true },
      });

      return { adjusted: true, recordId: record.id };
    }),

  archive: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive(), archived: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const account = await db.bankAccount.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true, userId: true },
      });
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      if (account.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the account owner can archive this account.",
        });
      }

      await db.bankAccount.update({
        where: { id: account.id },
        data: { archived: input.archived, updatedBy: userId },
      });
      return { id: account.id, archived: input.archived };
    }),

  createInstallment: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        accountId: z.number().int().positive(),
        title: z.string().trim().min(1).max(100),
        totalAmount: z.number().positive(),
        totalInstallments: z.number().int().min(1).max(120),
        paidInstallments: z.number().int().min(0).max(120).default(0),
        monthlyAmount: z.number().positive(),
        interestRate: z.number().min(0).max(200).default(0),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        includedInBalance: z.boolean().default(true),
        note: z.string().trim().max(300).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      const acc = await db.bankAccount.findFirst({
        where: {
          id: input.accountId,
          organizationId: orgId,
          deletedAt: null,
        },
        select: { id: true, type: true },
      });
      if (!acc || acc.type !== "CREDIT_CARD") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Installments can only be added to credit cards.",
        });
      }
      const paid = Math.min(input.paidInstallments, input.totalInstallments);
      const created = await db.cardInstallment.create({
        data: {
          organizationId: orgId,
          accountId: acc.id,
          title: input.title,
          totalAmount: Math.round(input.totalAmount * MINOR_UNIT),
          totalInstallments: input.totalInstallments,
          paidInstallments: paid,
          monthlyAmount: Math.round(input.monthlyAmount * MINOR_UNIT),
          interestRate: input.interestRate,
          startDate: parseIsoDate(input.startDate) ?? new Date(),
          includedInBalance: input.includedInBalance,
          note: input.note || null,
          createdBy: userId,
        },
        select: { id: true },
      });
      return { id: created.id };
    }),

  updateInstallment: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(100).optional(),
        totalAmount: z.number().positive().optional(),
        totalInstallments: z.number().int().min(1).max(120).optional(),
        paidInstallments: z.number().int().min(0).max(120).optional(),
        monthlyAmount: z.number().positive().optional(),
        interestRate: z.number().min(0).max(200).optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        includedInBalance: z.boolean().optional(),
        note: z.string().trim().max(300).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      const existing = await db.cardInstallment.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installment not found",
        });
      }
      const nextTotalCount =
        input.totalInstallments ?? existing.totalInstallments;
      const nextPaid = Math.min(
        input.paidInstallments ?? existing.paidInstallments,
        nextTotalCount,
      );

      await db.cardInstallment.update({
        where: { id: existing.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.totalAmount !== undefined
            ? { totalAmount: Math.round(input.totalAmount * MINOR_UNIT) }
            : {}),
          totalInstallments: nextTotalCount,
          paidInstallments: nextPaid,
          ...(input.monthlyAmount !== undefined
            ? { monthlyAmount: Math.round(input.monthlyAmount * MINOR_UNIT) }
            : {}),
          ...(input.interestRate !== undefined
            ? { interestRate: input.interestRate }
            : {}),
          ...(input.startDate !== undefined
            ? { startDate: parseIsoDate(input.startDate) ?? existing.startDate }
            : {}),
          ...(input.includedInBalance !== undefined
            ? { includedInBalance: input.includedInBalance }
            : {}),
          ...(input.note !== undefined ? { note: input.note || null } : {}),
          updatedBy: userId,
        },
      });
      return { id: existing.id };
    }),

  deleteInstallment: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      const existing = await db.cardInstallment.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installment not found",
        });
      }
      await db.cardInstallment.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), updatedBy: userId },
      });
      return { id: existing.id };
    }),
});
