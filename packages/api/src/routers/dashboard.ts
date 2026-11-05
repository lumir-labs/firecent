import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

/**
 * `Record.amount` is an integer in minor units (cents), signed: expenses and
 * transfer exits are negative, income and transfer entries positive.
 * Single place that knows it: every amount leaves this router in major units.
 */
const MINOR_UNIT = 100;

const netWorthInput = z.object({
  /** "me" = accounts owned by the session user · "household" = whole org. */
  scope: z.enum(["me", "household"]).default("me"),
  /** Month shown, "YYYY-MM" (the client sends its own local month). */
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

/**
 * `dashboard` router: read-only aggregates for the home dashboard.
 * Every procedure is gated with `dashboard:basic` and scoped to `ctx.orgId`
 * (the organization in the session) — it never reads another org's data.
 */
export const dashboardRouter = router({
  /**
   * Hero card: balance (net worth) at the END of `month`, its change during
   * that month, and the month's income / expenses.
   *
   * - An account's balance is the SUM OF ITS RECORDS (same rule as the
   *   accounts list); the `BankAccount.balance` column is not trusted.
   *   Records without a date always count.
   * - Accounts count unless soft-deleted, archived, inactive or flagged
   *   `excludeFromStats`. Negative balance (credit card) = liability.
   * - Currencies are NOT converted: the one with most accounts is shown,
   *   the rest are listed in `others`.
   * - Delta = every record of the month (transfers between two counted
   *   accounts cancel out). Income/expenses ignore transfers.
   */
  netWorth: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(netWorthInput)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.orgId;
      const userId = ctx.session?.user.id;
      if (!orgId || !userId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization",
        });
      }

      const [year, monthNum] = input.month.split("-").map(Number);
      const start = new Date(Date.UTC(year, monthNum - 1, 1));
      const nextStart = new Date(Date.UTC(year, monthNum, 1));

      const [memberCount, accounts] = await Promise.all([
        db.member.count({ where: { organizationId: orgId } }),
        db.bankAccount.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            archived: false,
            isActive: true,
            excludeFromStats: false,
            ...(input.scope === "me" ? { userId } : {}),
          },
          select: { id: true, currency: true },
        }),
      ]);

      // Main currency = the one with the most accounts (tie → alphabetical).
      const byCurrency = new Map<string, number>();
      for (const a of accounts) {
        byCurrency.set(a.currency, (byCurrency.get(a.currency) ?? 0) + 1);
      }
      const ranked = [...byCurrency.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      const primaryCurrency = ranked[0]?.[0];
      if (!primaryCurrency) return { primary: null, others: [], memberCount };

      const accountIds = accounts
        .filter((a) => a.currency === primaryCurrency)
        .map((a) => a.id);
      const base = {
        organizationId: orgId,
        deletedAt: null,
        accountId: { in: accountIds },
      };

      const [perAccount, during] = await Promise.all([
        // Balance of each account at the end of the month.
        db.record.groupBy({
          by: ["accountId"],
          where: {
            ...base,
            OR: [{ recordDate: { lt: nextStart } }, { recordDate: null }],
          },
          _sum: { amount: true },
        }),
        // Movements inside the month, by type.
        db.record.groupBy({
          by: ["type", "transfer"],
          where: { ...base, recordDate: { gte: start, lt: nextStart } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

      let assets = 0;
      let liabilities = 0;
      for (const g of perAccount) {
        const balance = g._sum.amount ?? 0;
        if (balance >= 0) assets += balance;
        else liabilities += -balance;
      }

      let deltaMinor = 0;
      const income = { amount: 0, count: 0 };
      const expense = { amount: 0, count: 0 };
      for (const g of during) {
        const sum = g._sum.amount ?? 0;
        deltaMinor += sum;
        if (g.transfer || g.type === "TRANSFER") continue;
        if (g.type === "INCOME") {
          income.amount += sum;
          income.count += g._count._all;
        } else if (g.type === "EXPENSE") {
          expense.amount += -sum;
          expense.count += g._count._all;
        }
      }

      const netWorthMinor = assets - liabilities;
      const previousMinor = netWorthMinor - deltaMinor;

      return {
        primary: {
          currency: primaryCurrency,
          netWorth: netWorthMinor / MINOR_UNIT,
          assets: assets / MINOR_UNIT,
          liabilities: liabilities / MINOR_UNIT,
          accountCount: accountIds.length,
          income: income.amount / MINOR_UNIT,
          incomeCount: income.count,
          expense: expense.amount / MINOR_UNIT,
          expenseCount: expense.count,
          /** Change of the balance during the month. */
          delta: deltaMinor / MINOR_UNIT,
          /** % vs. the previous month end; null when it has no base. */
          deltaPct:
            previousMinor !== 0
              ? (deltaMinor / Math.abs(previousMinor)) * 100
              : null,
        },
        others: ranked.slice(1).map(([currency]) => currency),
        memberCount,
      };
    }),
});
