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

const homeInput = z.object({
  /** Month shown, "YYYY-MM". Defaults to current UTC month. */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

function computeCardDue(paymentDay: number | null, now: Date) {
  if (!paymentDay || paymentDay < 1 || paymentDay > 31) return null;
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const daysThisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  let target = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      Math.min(paymentDay, daysThisMonth),
    ),
  );
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
  const dueInDays = Math.round(
    (target.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24),
  );
  return {
    date: target.toISOString().slice(0, 10),
    dueInDays,
  };
}

export const dashboardRouter = router({
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
        db.record.groupBy({
          by: ["accountId"],
          where: {
            ...base,
            OR: [{ recordDate: { lt: nextStart } }, { recordDate: null }],
          },
          _sum: { amount: true },
        }),
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
          delta: deltaMinor / MINOR_UNIT,
          deltaPct:
            previousMinor !== 0
              ? (deltaMinor / Math.abs(previousMinor)) * 100
              : null,
        },
        others: ranked.slice(1).map(([currency]) => currency),
        memberCount,
      };
    }),

  /**
   * Firecent Phase 3A · Home dashboard aggregate in a single call.
   */
  home: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(homeInput.optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.orgId;
      const userId = ctx.session?.user.id;
      if (!orgId || !userId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization",
        });
      }

      const now = new Date();
      const monthStr =
        input?.month ??
        `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const [year, monthNum] = monthStr.split("-").map(Number);
      const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
      const nextMonthStart = new Date(Date.UTC(year, monthNum, 1));
      const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
      const isCurrentMonth =
        year === now.getUTCFullYear() && monthNum === now.getUTCMonth() + 1;
      const currentDay = isCurrentMonth ? now.getUTCDate() : daysInMonth;
      const pace = Math.min(1, Math.max(0, currentDay / daysInMonth));
      const daysLeft = Math.max(0, daysInMonth - currentDay);

      const accounts = await db.bankAccount.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          archived: false,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
          excludeFromStats: true,
          paymentDay: true,
          paymentDayType: true,
        },
      });

      if (accounts.length === 0) {
        return {
          isEmpty: true,
          month: monthStr,
          hasRecords: false,
          balance: null,
          change: 0,
          trend: [] as { label: string; value: number }[],
          split: null,
          monthSummary: {
            currency: "USD",
            in: 0,
            out: 0,
            byNature: { DEBO: 0, NECESITO: 0, QUIERO: 0 },
            pace,
            daysLeft,
          },
          upcoming: [] as {
            id: string;
            accountId: number;
            date: string;
            title: string;
            amount: number;
            currency: string;
            dueInDays: number;
          }[],
          recent: [] as {
            id: number;
            type: "EXPENSE" | "INCOME" | "TRANSFER";
            amount: number;
            currency: string;
            date: string | null;
            title: string;
            category: { name: string; icon: string | null } | null;
            accountName: string;
          }[],
          insight: null,
        };
      }

      const statsAccounts = accounts.filter((a) => !a.excludeFromStats);
      const byCurrency = new Map<string, number>();
      for (const a of statsAccounts) {
        byCurrency.set(a.currency, (byCurrency.get(a.currency) ?? 0) + 1);
      }
      const rankedCurrencies = [...byCurrency.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      const primaryCurrency = rankedCurrencies[0]?.[0] ?? accounts[0].currency;

      const primaryAccountIds = statsAccounts
        .filter((a) => a.currency === primaryCurrency)
        .map((a) => a.id);

      // 6 month checkpoints (start of month -5 .. current month + end of current month)
      const trendDates: Date[] = [];
      for (let i = 5; i >= 0; i--) {
        trendDates.push(new Date(Date.UTC(year, monthNum - 1 - i, 1)));
      }
      trendDates.push(nextMonthStart);
      const earliestTrendDate = trendDates[0];

      const [
        allAccountSums,
        beforeTrendAgg,
        trendRecords,
        monthRecords,
        recentRows,
        recordCount,
      ] = await Promise.all([
        db.record.groupBy({
          by: ["accountId"],
          where: {
            organizationId: orgId,
            deletedAt: null,
            OR: [{ recordDate: { lt: nextMonthStart } }, { recordDate: null }],
          },
          _sum: { amount: true },
        }),
        primaryAccountIds.length > 0
          ? db.record.aggregate({
              where: {
                organizationId: orgId,
                deletedAt: null,
                accountId: { in: primaryAccountIds },
                OR: [
                  { recordDate: { lt: earliestTrendDate } },
                  { recordDate: null },
                ],
              },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: 0 } }),
        primaryAccountIds.length > 0
          ? db.record.findMany({
              where: {
                organizationId: orgId,
                deletedAt: null,
                accountId: { in: primaryAccountIds },
                recordDate: { gte: earliestTrendDate, lt: nextMonthStart },
              },
              select: { amount: true, recordDate: true },
            })
          : Promise.resolve([] as { amount: number; recordDate: Date | null }[]),
        primaryAccountIds.length > 0
          ? db.record.findMany({
              where: {
                organizationId: orgId,
                deletedAt: null,
                accountId: { in: primaryAccountIds },
                recordDate: { gte: monthStart, lt: nextMonthStart },
              },
              select: {
                amount: true,
                type: true,
                transfer: true,
                excludeFromStats: true,
                spendingNature: true,
                category: { select: { spendingNature: true } },
              },
            })
          : Promise.resolve([]),
        db.record.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            NOT: { AND: [{ transfer: true }, { amount: { gt: 0 } }] },
          },
          orderBy: [
            { recordDate: { sort: "desc", nulls: "last" } },
            { recordTime: { sort: "desc", nulls: "last" } },
            { id: "desc" },
          ],
          take: 5,
          select: {
            id: true,
            type: true,
            transfer: true,
            amount: true,
            note: true,
            recordDate: true,
            payee: { select: { name: true } },
            category: { select: { name: true, icon: true } },
            account: { select: { name: true, currency: true } },
            transferAccount: { select: { name: true } },
          },
        }),
        db.record.count({ where: { organizationId: orgId, deletedAt: null } }),
      ]);

      const balanceByAccount = new Map<number, number>();
      for (const s of allAccountSums) {
        balanceByAccount.set(s.accountId, s._sum.amount ?? 0);
      }

      // Totals by currency
      const primaryTotalMinor = primaryAccountIds.reduce(
        (sum, id) => sum + (balanceByAccount.get(id) ?? 0),
        0,
      );
      const others = rankedCurrencies.slice(1).map(([currency]) => {
        const ids = statsAccounts
          .filter((a) => a.currency === currency)
          .map((a) => a.id);
        const totalMinor = ids.reduce(
          (sum, id) => sum + (balanceByAccount.get(id) ?? 0),
          0,
        );
        return { currency, amount: totalMinor / MINOR_UNIT };
      });

      // 7-point trend: balance at start of each of the last 6 months + current
      const trendPoints: { label: string; value: number }[] = [];
      let runningMinor = beforeTrendAgg._sum.amount ?? 0;
      const monthShort = (d: Date) =>
        d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });

      for (let i = 0; i < trendDates.length; i++) {
        if (i > 0) {
          const prevBoundary = trendDates[i - 1];
          const curBoundary = trendDates[i];
          for (const r of trendRecords) {
            if (
              r.recordDate &&
              r.recordDate >= prevBoundary &&
              r.recordDate < curBoundary
            ) {
              runningMinor += r.amount;
            }
          }
        }
        const label =
          i === trendDates.length - 1
            ? "Now"
            : monthShort(trendDates[i]);
        trendPoints.push({ label, value: runningMinor / MINOR_UNIT });
      }

      // Month summary (in, out, byNature, change)
      let monthChangeMinor = 0;
      let monthInMinor = 0;
      let monthOutMinor = 0;
      const byNatureMinor = { DEBO: 0, NECESITO: 0, QUIERO: 0 };

      for (const r of monthRecords) {
        monthChangeMinor += r.amount;
        if (r.transfer || r.type === "TRANSFER" || r.excludeFromStats) continue;
        if (r.type === "INCOME") {
          monthInMinor += r.amount;
        } else if (r.type === "EXPENSE") {
          const abs = -r.amount;
          monthOutMinor += abs;
          const nature = r.spendingNature ?? r.category?.spendingNature ?? "NECESITO";
          byNatureMinor[nature] += abs;
        }
      }

      // Upcoming (next 7 days): credit card payments due
      const upcoming = accounts
        .filter((a) => a.type === "CREDIT_CARD" && a.paymentDay != null)
        .map((card) => {
          const due = computeCardDue(card.paymentDay, now);
          if (!due || due.dueInDays > 7) return null;
          const balanceMinor = balanceByAccount.get(card.id) ?? 0;
          const owed = Math.max(0, -balanceMinor) / MINOR_UNIT;
          if (owed <= 0) return null;
          return {
            id: `card-${card.id}`,
            accountId: card.id,
            date: due.date,
            title: card.name,
            amount: owed,
            currency: card.currency,
            dueInDays: due.dueInDays,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.dueInDays - b.dueInDays);

      const recent = recentRows.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount / MINOR_UNIT,
        currency: r.account.currency,
        date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
        title: r.transfer
          ? r.transferAccount
            ? `${r.account.name} → ${r.transferAccount.name}`
            : r.account.name
          : r.payee?.name || r.category?.name || r.note || r.account.name,
        category: r.category,
        accountName: r.account.name,
      }));

      return {
        isEmpty: false,
        month: monthStr,
        hasRecords: recordCount > 0,
        balance: {
          currency: primaryCurrency,
          amount: primaryTotalMinor / MINOR_UNIT,
          others,
        },
        change: monthChangeMinor / MINOR_UNIT,
        trend: trendPoints,
        split: null,
        monthSummary: {
          currency: primaryCurrency,
          in: monthInMinor / MINOR_UNIT,
          out: monthOutMinor / MINOR_UNIT,
          byNature: {
            DEBO: byNatureMinor.DEBO / MINOR_UNIT,
            NECESITO: byNatureMinor.NECESITO / MINOR_UNIT,
            QUIERO: byNatureMinor.QUIERO / MINOR_UNIT,
          },
          pace,
          daysLeft,
        },
        upcoming,
        recent,
        insight: null,
      };
    }),
});
