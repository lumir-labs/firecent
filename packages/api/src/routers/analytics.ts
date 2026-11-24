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

const PERIOD_MONTHS = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
} as const;

export const analyticsRouter = router({
  overview: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        period: z.enum(["1m", "3m", "6m", "12m"]).default("6m"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const count = PERIOD_MONTHS[input.period];
      const now = new Date();
      const curY = now.getUTCFullYear();
      const curM = now.getUTCMonth(); // 0-based
      const curDay = now.getUTCDate();

      const accounts = await db.bankAccount.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          archived: false,
          excludeFromStats: false,
        },
        select: { id: true, currency: true },
      });

      const curCount = new Map<string, number>();
      for (const a of accounts) {
        curCount.set(a.currency, (curCount.get(a.currency) ?? 0) + 1);
      }
      const currency =
        [...curCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
      const primaryAccountIds = accounts
        .filter((a) => a.currency === currency)
        .map((a) => a.id);

      // Build monthly buckets oldest → newest (ending with current month)
      const months: {
        key: string;
        label: string;
        start: Date;
        end: Date;
        isCurrent: boolean;
      }[] = [];
      for (let i = count - 1; i >= 0; i--) {
        const start = new Date(Date.UTC(curY, curM - i, 1));
        const end = new Date(Date.UTC(curY, curM - i + 1, 1));
        const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
        const label = start.toLocaleString("en-US", {
          month: "short",
          timeZone: "UTC",
        });
        months.push({ key, label, start, end, isCurrent: i === 0 });
      }

      const periodStart = months[0].start;
      const periodEnd = months[months.length - 1].end;
      const prevMonthStart = new Date(Date.UTC(curY, curM - 1, 1));
      const queryStart =
        prevMonthStart < periodStart ? prevMonthStart : periodStart;

      const [beforeStartAgg, records] = await Promise.all([
        primaryAccountIds.length > 0
          ? db.record.aggregate({
              where: {
                organizationId: orgId,
                deletedAt: null,
                accountId: { in: primaryAccountIds },
                OR: [{ recordDate: { lt: periodStart } }, { recordDate: null }],
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
                recordDate: { gte: queryStart, lt: periodEnd },
              },
              select: {
                type: true,
                transfer: true,
                excludeFromStats: true,
                amount: true,
                recordDate: true,
                spendingNature: true,
                category: {
                  select: { id: true, name: true, spendingNature: true },
                },
                payee: { select: { id: true, name: true } },
              },
            })
          : Promise.resolve([]),
      ]);

      // 1. Monthly cash flow & nature split
      const cashFlow = months.map((m) => ({
        key: m.key,
        label: m.label,
        isCurrent: m.isCurrent,
        in: 0,
        out: 0,
        net: 0,
        DEBO: 0,
        NECESITO: 0,
        QUIERO: 0,
      }));
      const bucketMap = new Map(cashFlow.map((c) => [c.key, c]));

      // 2. Balance growth (monthly checkpoints)
      const deltaByMonth = new Map<string, number>();

      // 3. What changed since last month (current MTD vs previous month same day)
      const curMonthKey = months[months.length - 1].key;
      const prevMonthKey = `${prevMonthStart.getUTCFullYear()}-${String(prevMonthStart.getUTCMonth() + 1).padStart(2, "0")}`;
      const catCur = new Map<string, number>();
      const catPrev = new Map<string, number>();
      const merchCur = new Map<string, number>();
      const merchPrev = new Map<string, number>();

      for (const r of records) {
        if (!r.recordDate) continue;
        const ym = r.recordDate.toISOString().slice(0, 7);
        const day = r.recordDate.getUTCDate();

        deltaByMonth.set(ym, (deltaByMonth.get(ym) ?? 0) + r.amount);

        if (r.transfer || r.type === "TRANSFER" || r.excludeFromStats) continue;

        const b = bucketMap.get(ym);
        if (b) {
          if (r.type === "INCOME") {
            b.in += Math.max(0, r.amount);
          } else if (r.type === "EXPENSE") {
            const abs = Math.abs(r.amount);
            b.out += abs;
            const nat = r.spendingNature ?? r.category?.spendingNature ?? "NECESITO";
            b[nat] += abs;
          }
        }

        if (r.type === "EXPENSE") {
          const abs = Math.abs(r.amount);
          const catName = r.category?.name ?? "Uncategorized";
          const merchName = r.payee?.name ?? catName;

          if (ym === curMonthKey) {
            catCur.set(catName, (catCur.get(catName) ?? 0) + abs);
            merchCur.set(merchName, (merchCur.get(merchName) ?? 0) + abs);
          } else if (ym === prevMonthKey && day <= curDay) {
            catPrev.set(catName, (catPrev.get(catName) ?? 0) + abs);
            merchPrev.set(merchName, (merchPrev.get(merchName) ?? 0) + abs);
          }
        }
      }

      const cashFlowMajor = cashFlow.map((c) => ({
        key: c.key,
        label: c.label,
        isCurrent: c.isCurrent,
        in: c.in / MINOR_UNIT,
        out: c.out / MINOR_UNIT,
        net: (c.in - c.out) / MINOR_UNIT,
        DEBO: c.DEBO / MINOR_UNIT,
        NECESITO: c.NECESITO / MINOR_UNIT,
        QUIERO: c.QUIERO / MINOR_UNIT,
      }));

      // Balance curve: start of each month + today
      let runningMinor = beforeStartAgg._sum.amount ?? 0;
      const balanceTrend: { label: string; value: number }[] = [];
      for (const m of months) {
        balanceTrend.push({
          label: m.label,
          value: runningMinor / MINOR_UNIT,
        });
        runningMinor += deltaByMonth.get(m.key) ?? 0;
      }
      balanceTrend.push({ label: "Now", value: runningMinor / MINOR_UNIT });

      const buildChanges = (
        curMap: Map<string, number>,
        prevMap: Map<string, number>,
      ) => {
        const names = new Set([...curMap.keys(), ...prevMap.keys()]);
        return [...names]
          .map((name) => {
            const cur = (curMap.get(name) ?? 0) / MINOR_UNIT;
            const prev = (prevMap.get(name) ?? 0) / MINOR_UNIT;
            return { name, current: cur, previous: prev, delta: cur - prev };
          })
          .filter((x) => x.current > 0 || x.previous > 0)
          .sort((a, b) => b.current - a.current)
          .slice(0, 6);
      };

      const categoriesDiff = buildChanges(catCur, catPrev);
      const merchantsDiff = buildChanges(merchCur, merchPrev);
      const curTotalOut = [...catCur.values()].reduce((s, v) => s + v, 0) / MINOR_UNIT;
      const prevTotalOut =
        [...catPrev.values()].reduce((s, v) => s + v, 0) / MINOR_UNIT;

      return {
        currency,
        hasHistory: records.length > 0,
        compareDay: curDay,
        cashFlow: cashFlowMajor,
        balanceTrend,
        balanceDelta:
          balanceTrend.length >= 2
            ? balanceTrend[balanceTrend.length - 1].value - balanceTrend[0].value
            : 0,
        changes: {
          totalDelta: curTotalOut - prevTotalOut,
          categories: categoriesDiff,
          merchants: merchantsDiff,
        },
      };
    }),
});
