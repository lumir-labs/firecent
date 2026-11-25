import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import {
  computeLastCycleDate,
  computeNextCycleDate,
  summarizeCardInstallments,
} from "../lib/card-cycle";
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

      const [accounts, assistantThreadCount] = await Promise.all([
        db.bankAccount.findMany({
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
            color: true,
            accountNumber: true,
            creditLimit: true,
            interestRate: true,
            excludeFromStats: true,
            paymentDay: true,
            paymentDayType: true,
            paymentEveryDays: true,
            paymentAnchorDate: true,
            cutoffDay: true,
            cutoffDayType: true,
            cutoffEveryDays: true,
            cutoffAnchorDate: true,
          },
        }),
        db.assistantThread.count({
          where: {
            organizationId: orgId,
            userId,
            deletedAt: null,
          },
        }),
      ]);

      if (accounts.length === 0) {
        return {
          isEmpty: true,
          month: monthStr,
          hasRecords: false,
          hasAssistantThreads: assistantThreadCount > 0,
          balance: null,
          change: 0,
          trend: [] as { label: string; value: number }[],
          split: null,
          monthSummary: {
            currency: "USD",
            in: 0,
            out: 0,
            byNature: { DEBO: 0, NECESITO: 0, QUIERO: 0 },
            topCategories: [] as {
              id: number | null;
              name: string;
              nameEn: string | null;
              nameEs: string | null;
              icon: string | null;
              color: string | null;
              spent: number;
            }[],
            pace,
            daysLeft,
          },
          upcoming: [] as {
            id: string;
            accountId: number;
            date: string;
            title: string;
            amount: number;
            minPayment: number;
            isCashPayment: boolean;
            currency: string;
            dueInDays: number;
          }[],
          cardTimeline: [] as {
            id: number;
            name: string;
            color: string | null;
            accountNumber: string | null;
            currency: string;
            debt: number;
            cashPayment: number | null;
            creditLimit: number | null;
            interestRate: number | null;
            cycleDays: number;
            estimatedInterest: number | null;
            estimatedMinPayment: number;
            installmentsMonthly: number;
            nextCutoffDate: string | null;
            cutoffInDays: number | null;
            nextDueDate: string | null;
            dueInDays: number | null;
          }[],
          recent: [] as {
            id: number;
            type: "EXPENSE" | "INCOME" | "TRANSFER";
            transfer: boolean;
            amount: number;
            currency: string;
            date: string | null;
            title: string;
            note: string | null;
            category: {
              name: string;
              nameEn: string | null;
              nameEs: string | null;
              icon: string | null;
              color: string | null;
            } | null;
            accountName: string;
            accountColor: string | null;
            transferAccount: { name: string; color: string | null } | null;
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
                category: {
                  select: {
                    id: true,
                    name: true,
                    nameEn: true,
                    nameEs: true,
                    icon: true,
                    color: true,
                    spendingNature: true,
                  },
                },
              },
            })
          : Promise.resolve([]),
        db.record.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            NOT: {
              AND: [
                { transfer: true },
                { amount: { gt: 0 } },
                { transferGroupId: { not: null } },
              ],
            },
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
            category: {
              select: {
                name: true,
                nameEn: true,
                nameEs: true,
                icon: true,
                color: true,
              },
            },
            account: { select: { name: true, color: true, currency: true } },
            transferAccount: { select: { name: true, color: true } },
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

      // Month summary (in, out, byNature, topCategories, change)
      let monthChangeMinor = 0;
      let monthInMinor = 0;
      let monthOutMinor = 0;
      const byNatureMinor = { DEBO: 0, NECESITO: 0, QUIERO: 0 };
      const byCategoryMap = new Map<
        string,
        {
          id: number | null;
          name: string;
          nameEn: string | null;
          nameEs: string | null;
          icon: string | null;
          color: string | null;
          spentMinor: number;
        }
      >();

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
          const key = r.category ? String(r.category.id) : "uncategorized";
          const prev = byCategoryMap.get(key);
          if (prev) {
            prev.spentMinor += abs;
          } else {
            byCategoryMap.set(key, {
              id: r.category?.id ?? null,
              name: r.category?.name ?? "Other",
              nameEn: r.category?.nameEn ?? null,
              nameEs: r.category?.nameEs ?? null,
              icon: r.category?.icon ?? "tag",
              color: r.category?.color ?? null,
              spentMinor: abs,
            });
          }
        }
      }

      const topCategories = [...byCategoryMap.values()]
        .sort((a, b) => b.spentMinor - a.spentMinor)
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          name: c.name,
          nameEn: c.nameEn,
          nameEs: c.nameEs,
          icon: c.icon,
          color: c.color,
          spent: c.spentMinor / MINOR_UNIT,
        }));

      // Compact timeline for all active credit cards (cutoff, due date, installments & estimated cycle interest)
      const creditCards = accounts.filter((a) => a.type === "CREDIT_CARD");
      const creditCardIds = creditCards.map((c) => c.id);

      const rollingCardIds = creditCards
        .filter(
          (a) =>
            a.paymentDayType === "EVERY_X_DAYS" &&
            a.paymentEveryDays != null &&
            !a.paymentAnchorDate,
        )
        .map((a) => a.id);

      const [lastPayments, allInstallments] = await Promise.all([
        rollingCardIds.length > 0
          ? db.record.groupBy({
              by: ["accountId"],
              where: {
                organizationId: orgId,
                accountId: { in: rollingCardIds },
                deletedAt: null,
                amount: { gt: 0 },
                recordDate: { not: null },
              },
              _max: { recordDate: true },
            })
          : Promise.resolve([]),
        creditCardIds.length > 0
          ? db.cardInstallment.findMany({
              where: {
                organizationId: orgId,
                accountId: { in: creditCardIds },
                deletedAt: null,
              },
              select: {
                accountId: true,
                totalAmount: true,
                totalInstallments: true,
                paidInstallments: true,
                monthlyAmount: true,
                interestRate: true,
                includedInBalance: true,
              },
            })
          : Promise.resolve([]),
      ]);

      const lastPaymentByCard = new Map<number, Date>();
      for (const p of lastPayments) {
        if (p._max.recordDate) {
          lastPaymentByCard.set(p.accountId, p._max.recordDate);
        }
      }

      const installmentsByCard = new Map<
        number,
        {
          totalAmount: number;
          totalInstallments: number;
          paidInstallments: number;
          monthlyAmount: number;
          interestRate: number;
          includedInBalance: boolean;
        }[]
      >();
      for (const inst of allInstallments) {
        const list = installmentsByCard.get(inst.accountId) ?? [];
        list.push({
          totalAmount: inst.totalAmount / MINOR_UNIT,
          totalInstallments: inst.totalInstallments,
          paidInstallments: inst.paidInstallments,
          monthlyAmount: inst.monthlyAmount / MINOR_UNIT,
          interestRate: inst.interestRate,
          includedInBalance: inst.includedInBalance,
        });
        installmentsByCard.set(inst.accountId, list);
      }

      const lastCutoffByCard = new Map<number, Date>();
      for (const card of creditCards) {
        const lc = computeLastCycleDate(
          card.cutoffDayType,
          card.cutoffDay,
          card.cutoffEveryDays,
          card.cutoffAnchorDate,
          now,
        );
        if (lc) lastCutoffByCard.set(card.id, lc);
      }

      const cardCutoffAggs = new Map<
        number,
        { owedAtCutoffMinor: number; paidSinceCutoffMinor: number }
      >();
      if (lastCutoffByCard.size > 0) {
        const results = await Promise.all(
          [...lastCutoffByCard.entries()].map(async ([cardId, lastCutoff]) => {
            const [atCutoff, paidAfter] = await Promise.all([
              db.record.aggregate({
                where: {
                  organizationId: orgId,
                  accountId: cardId,
                  deletedAt: null,
                  OR: [{ recordDate: { lte: lastCutoff } }, { recordDate: null }],
                },
                _sum: { amount: true },
              }),
              db.record.aggregate({
                where: {
                  organizationId: orgId,
                  accountId: cardId,
                  deletedAt: null,
                  amount: { gt: 0 },
                  recordDate: { gt: lastCutoff },
                },
                _sum: { amount: true },
              }),
            ]);
            return {
              cardId,
              owedAtCutoffMinor: Math.max(0, -(atCutoff._sum.amount ?? 0)),
              paidSinceCutoffMinor: paidAfter._sum.amount ?? 0,
            };
          }),
        );
        for (const r of results) {
          cardCutoffAggs.set(r.cardId, {
            owedAtCutoffMinor: r.owedAtCutoffMinor,
            paidSinceCutoffMinor: r.paidSinceCutoffMinor,
          });
        }
      }

      const cardTimeline = creditCards
        .map((card) => {
          const balanceMinor = balanceByAccount.get(card.id) ?? 0;
          const debtMinor = Math.max(0, -balanceMinor);
          const debt = debtMinor / MINOR_UNIT;
          const creditLimit =
            card.creditLimit != null ? card.creditLimit / MINOR_UNIT : null;
          const due = computeNextCycleDate(
            card.paymentDayType,
            card.paymentDay,
            card.paymentEveryDays,
            card.paymentAnchorDate,
            lastPaymentByCard.get(card.id) ?? null,
            now,
          );
          const cutoff = computeNextCycleDate(
            card.cutoffDayType,
            card.cutoffDay,
            card.cutoffEveryDays,
            card.cutoffAnchorDate,
            null,
            now,
          );
          const cycleDays =
            card.paymentDayType === "EVERY_X_DAYS" && card.paymentEveryDays
              ? card.paymentEveryDays
              : card.cutoffDayType === "EVERY_X_DAYS" && card.cutoffEveryDays
                ? card.cutoffEveryDays
                : 30;

          const instSummary = summarizeCardInstallments(
            debt,
            installmentsByCard.get(card.id) ?? [],
          );
          const cutoffAgg = cardCutoffAggs.get(card.id);
          const cashPayment = cutoffAgg
            ? Math.max(
                0,
                Math.min(
                  debtMinor,
                  cutoffAgg.owedAtCutoffMinor -
                    cutoffAgg.paidSinceCutoffMinor -
                    Math.round(instSummary.deferredInBalance * MINOR_UNIT),
                ),
              ) / MINOR_UNIT
            : null;
          const revDebt = instSummary.revolvingDebt;
          const revInterest =
            card.interestRate != null && card.interestRate > 0 && revDebt > 0
              ? revDebt * (card.interestRate / 100) * (cycleDays / 365)
              : 0;
          const hasAnyRate =
            (card.interestRate != null && card.interestRate > 0) ||
            instSummary.monthlyInterest > 0;
          const estimatedInterest = hasAnyRate
            ? Math.round((revInterest + instSummary.monthlyInterest) * 100) / 100
            : null;

          // Standard local minimum payment: revolving (1/60 + interest, min $15) + full monthly installment quotas
          const revolvingMin =
            revDebt > 0
              ? Math.min(revDebt, Math.max(15, revDebt / 60 + revInterest))
              : 0;
          const estimatedMinPayment =
            Math.round((revolvingMin + instSummary.monthlyTotal) * 100) / 100;

          return {
            id: card.id,
            name: card.name,
            color: card.color,
            accountNumber: card.accountNumber,
            currency: card.currency,
            debt,
            cashPayment,
            creditLimit,
            interestRate: card.interestRate,
            cycleDays,
            estimatedInterest,
            estimatedMinPayment,
            installmentsMonthly: instSummary.monthlyTotal,
            nextCutoffDate: cutoff.nextDate,
            cutoffInDays: cutoff.inDays,
            nextDueDate: due.nextDate,
            dueInDays: due.inDays,
          };
        })
        .sort((a, b) => {
          const aSoonest = Math.min(a.dueInDays ?? 999, a.cutoffInDays ?? 999);
          const bSoonest = Math.min(b.dueInDays ?? 999, b.cutoffInDays ?? 999);
          if (aSoonest !== bSoonest) return aSoonest - bSoonest;
          return b.debt - a.debt;
        });

      // Upcoming (next 7 days): derived directly from cardTimeline with exact cash payment + min payment
      const upcoming = cardTimeline
        .filter((card) => {
          if (!card.nextDueDate || card.dueInDays == null || card.dueInDays > 7) {
            return false;
          }
          const dueAmount = card.cashPayment ?? card.debt;
          return dueAmount > 0;
        })
        .map((card) => ({
          id: `card-${card.id}`,
          accountId: card.id,
          date: card.nextDueDate!,
          title: card.name,
          amount: card.cashPayment ?? card.debt,
          minPayment: card.estimatedMinPayment,
          isCashPayment: card.cashPayment != null,
          currency: card.currency,
          dueInDays: card.dueInDays!,
        }))
        .sort((a, b) => a.dueInDays - b.dueInDays);

      const recent = recentRows.map((r) => ({
        id: r.id,
        type: r.type,
        transfer: r.transfer,
        amount: r.amount / MINOR_UNIT,
        currency: r.account.currency,
        date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
        title: r.transfer
          ? r.transferAccount
            ? `${r.account.name} → ${r.transferAccount.name}`
            : r.account.name
          : r.payee?.name || r.category?.name || r.note || r.account.name,
        note: r.note,
        category: r.category,
        accountName: r.account.name,
        accountColor: r.account.color,
        transferAccount: r.transferAccount,
      }));

      return {
        isEmpty: false,
        month: monthStr,
        hasRecords: recordCount > 0,
        hasAssistantThreads: assistantThreadCount > 0,
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
          topCategories,
          pace,
          daysLeft,
        },
        upcoming,
        cardTimeline,
        recent,
        insight: null,
      };
    }),
});
