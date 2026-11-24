import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

const MINOR_UNIT = 100;

function requireOrgAndUser(orgId: string | null, userId: string | undefined) {
  if (!orgId || !userId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active organization",
    });
  }
  return { orgId, userId };
}

function computeNextDueDate(
  paymentDayType: "MONTHLY_DAY" | "EVERY_X_DAYS" | null,
  paymentDay: number | null,
  now = new Date(),
): { nextDueDate: string | null; dueInDays: number | null } {
  if (!paymentDay || paymentDay < 1 || paymentDay > 31) {
    return { nextDueDate: null, dueInDays: null };
  }
  if (paymentDayType === "EVERY_X_DAYS") {
    return { nextDueDate: null, dueInDays: null };
  }
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const daysInThisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const thisMonthDue = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      Math.min(paymentDay, daysInThisMonth),
    ),
  );
  let target = thisMonthDue;
  if (target < todayUtc) {
    const nextMonthDays = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0),
    ).getUTCDate();
    target = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        Math.min(paymentDay, nextMonthDays),
      ),
    );
  }
  const diffDays = Math.round(
    (target.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24),
  );
  return {
    nextDueDate: target.toISOString().slice(0, 10),
    dueInDays: diffDays,
  };
}

const createAccountInput = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["CHECKING_ACCOUNT", "SAVINGS_ACCOUNT", "CASH", "CREDIT_CARD"]),
  currency: z.string().trim().min(3).max(3).default("USD"),
  color: z.string().trim().max(32).nullish(),
  accountNumber: z.string().trim().max(16).nullish(),
  /** Initial balance in major units. For CREDIT_CARD, positive = current balance owed. */
  currentBalance: z.number().finite().default(0),
  /** Credit limit in major units (CREDIT_CARD only). */
  creditLimit: z.number().positive().nullish(),
  paymentDay: z.number().int().min(1).max(31).nullish(),
  interestRate: z.number().min(0).max(200).nullish(),
  displayCreditMode: z
    .enum(["CREDIT_BALANCE", "AVAILABLE_CREDIT"])
    .default("CREDIT_BALANCE"),
  excludeFromStats: z.boolean().default(false),
});

const updateAccountInput = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().max(32).nullish(),
  accountNumber: z.string().trim().max(16).nullish(),
  creditLimit: z.number().positive().nullish(),
  paymentDay: z.number().int().min(1).max(31).nullish(),
  paymentDayType: z.enum(["MONTHLY_DAY", "EVERY_X_DAYS"]).nullish(),
  paymentEveryDays: z.number().int().positive().nullish(),
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

      const items = accounts.map((a) => {
        const balanceMinor = balanceByAccount.get(a.id) ?? 0;
        const balance = balanceMinor / MINOR_UNIT;
        const isCard = a.type === "CREDIT_CARD";
        const creditLimit = a.creditLimit != null ? a.creditLimit / MINOR_UNIT : null;
        const debt = isCard ? Math.max(0, -balance) : 0;
        const available =
          isCard && creditLimit != null ? Math.max(0, creditLimit - debt) : null;
        const { nextDueDate, dueInDays } = isCard
          ? computeNextDueDate(a.paymentDayType, a.paymentDay)
          : { nextDueDate: null, dueInDays: null };

        return {
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          color: a.color,
          accountNumber: a.accountNumber,
          excludeFromStats: a.excludeFromStats,
          displayCreditMode: a.displayCreditMode ?? "CREDIT_BALANCE",
          creditLimit,
          paymentDay: a.paymentDay,
          interestRate: a.interestRate,
          ownerId: a.userId,
          isOwner: a.userId === userId,
          balance,
          debt,
          available,
          nextDueDate,
          dueInDays,
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

      const [totalAgg, monthRecords] = await Promise.all([
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
      const debt = isCard ? Math.max(0, -balance) : 0;
      const available =
        isCard && creditLimit != null ? Math.max(0, creditLimit - debt) : null;
      const { nextDueDate, dueInDays } = isCard
        ? computeNextDueDate(account.paymentDayType, account.paymentDay)
        : { nextDueDate: null, dueInDays: null };

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        color: account.color,
        accountNumber: account.accountNumber,
        archived: account.archived,
        excludeFromStats: account.excludeFromStats,
        displayCreditMode: account.displayCreditMode ?? "CREDIT_BALANCE",
        creditLimit,
        paymentDay: account.paymentDay,
        interestRate: account.interestRate,
        ownerId: account.userId,
        isOwner: account.userId === userId,
        balance,
        debt,
        available,
        nextDueDate,
        dueInDays,
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
            accountNumber: input.accountNumber ?? null,
            creditLimit:
              isCard && input.creditLimit != null
                ? Math.round(input.creditLimit * MINOR_UNIT)
                : null,
            paymentDay: isCard ? (input.paymentDay ?? null) : null,
            paymentDayType: isCard ? "MONTHLY_DAY" : null,
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
        select: { id: true, userId: true, name: true },
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

      await db.bankAccount.update({
        where: { id: account.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.accountNumber !== undefined
            ? { accountNumber: input.accountNumber }
            : {}),
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
          ...(input.interestRate !== undefined
            ? { interestRate: input.interestRate }
            : {}),
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
});
