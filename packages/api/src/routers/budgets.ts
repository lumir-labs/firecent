import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

const MINOR_UNIT = 100;
const NATURES = ["DEBO", "NECESITO", "QUIERO"] as const;
type Nature = (typeof NATURES)[number];

function requireOrg(orgId: string | null): string {
  if (!orgId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active organization",
    });
  }
  return orgId;
}

function parseMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return {
    year: y,
    monthNum: m,
    start: new Date(Date.UTC(y, m - 1, 1)),
    nextStart: new Date(Date.UTC(y, m, 1)),
    prevStart: new Date(Date.UTC(y, m - 2, 1)),
    daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
}

export const budgetsRouter = router({
  get: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const { year, monthNum, start, nextStart, prevStart, daysInMonth } =
        parseMonth(input.month);

      const now = new Date();
      const isCurrentMonth =
        year === now.getUTCFullYear() && monthNum === now.getUTCMonth() + 1;
      const isPastMonth =
        year < now.getUTCFullYear() ||
        (year === now.getUTCFullYear() && monthNum < now.getUTCMonth() + 1);
      const currentDay = isCurrentMonth
        ? now.getUTCDate()
        : isPastMonth
          ? daysInMonth
          : 0;
      const pace = daysInMonth > 0 ? currentDay / daysInMonth : 0;
      const daysLeft = isCurrentMonth
        ? Math.max(1, daysInMonth - currentDay + 1)
        : 0;

      const threeMonthsAgo = new Date(Date.UTC(year, monthNum - 4, 1));

      const [budget, prevBudget, accounts, categories, monthRecords, histRecords] =
        await Promise.all([
          db.budget.findFirst({
            where: { organizationId: orgId, month: start, deletedAt: null },
            include: { natures: true, categories: true },
          }),
          db.budget.findFirst({
            where: { organizationId: orgId, month: prevStart, deletedAt: null },
            select: { id: true },
          }),
          db.bankAccount.findMany({
            where: {
              organizationId: orgId,
              deletedAt: null,
              archived: false,
              excludeFromStats: false,
            },
            select: { id: true, currency: true },
          }),
          db.category.findMany({
            where: {
              organizationId: orgId,
              deletedAt: null,
              hidden: false,
              type: "EXPENSE",
            },
            select: { id: true, name: true, icon: true, spendingNature: true },
            orderBy: { name: "asc" },
          }),
          db.record.findMany({
            where: {
              organizationId: orgId,
              deletedAt: null,
              transfer: false,
              excludeFromStats: false,
              recordDate: { gte: start, lt: nextStart },
            },
            select: {
              type: true,
              amount: true,
              categoryId: true,
              spendingNature: true,
              category: { select: { spendingNature: true } },
            },
          }),
          db.record.findMany({
            where: {
              organizationId: orgId,
              deletedAt: null,
              transfer: false,
              excludeFromStats: false,
              recordDate: { gte: threeMonthsAgo, lt: start },
            },
            select: {
              type: true,
              amount: true,
              spendingNature: true,
              category: { select: { spendingNature: true } },
            },
          }),
        ]);

      const curCount = new Map<string, number>();
      for (const a of accounts) {
        curCount.set(a.currency, (curCount.get(a.currency) ?? 0) + 1);
      }
      const currency =
        [...curCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

      // Actual spending & income this month
      let actualIncomeMinor = 0;
      const spentByNature: Record<Nature, number> = {
        DEBO: 0,
        NECESITO: 0,
        QUIERO: 0,
      };
      const spentByCategory = new Map<number, number>();

      for (const r of monthRecords) {
        if (r.type === "INCOME") {
          actualIncomeMinor += Math.max(0, r.amount);
        } else if (r.type === "EXPENSE") {
          const abs = Math.abs(r.amount);
          const nature = (r.spendingNature ??
            r.category?.spendingNature ??
            "NECESITO") as Nature;
          spentByNature[nature] += abs;
          if (r.categoryId) {
            spentByCategory.set(
              r.categoryId,
              (spentByCategory.get(r.categoryId) ?? 0) + abs,
            );
          }
        }
      }

      // 3-month average suggestions (for creating a first plan!)
      let histIncome = 0;
      const histNature: Record<Nature, number> = {
        DEBO: 0,
        NECESITO: 0,
        QUIERO: 0,
      };
      for (const r of histRecords) {
        if (r.type === "INCOME") histIncome += Math.max(0, r.amount);
        else if (r.type === "EXPENSE") {
          const nature = (r.spendingNature ??
            r.category?.spendingNature ??
            "NECESITO") as Nature;
          histNature[nature] += Math.abs(r.amount);
        }
      }
      const suggestion = {
        expectedIncome: Math.round(histIncome / 3 / MINOR_UNIT),
        DEBO: Math.round(histNature.DEBO / 3 / MINOR_UNIT),
        NECESITO: Math.round(histNature.NECESITO / 3 / MINOR_UNIT),
        QUIERO: Math.round(histNature.QUIERO / 3 / MINOR_UNIT),
      };

      if (!budget) {
        return {
          month: input.month,
          currency,
          hasPlan: false,
          hasPreviousPlan: Boolean(prevBudget),
          isPastMonth,
          isCurrentMonth,
          pace,
          daysLeft,
          actualIncome: actualIncomeMinor / MINOR_UNIT,
          totalSpent:
            (spentByNature.DEBO + spentByNature.NECESITO + spentByNature.QUIERO) /
            MINOR_UNIT,
          suggestion,
          plan: null,
        };
      }

      const naturePlanMap = new Map<Nature, number>();
      for (const bn of budget.natures) {
        naturePlanMap.set(bn.nature as Nature, bn.amount);
      }
      const catLimitMap = new Map<number, number>();
      for (const bc of budget.categories) {
        catLimitMap.set(bc.categoryId, bc.amount);
      }

      const buckets = NATURES.map((nature) => {
        const plannedMinor = naturePlanMap.get(nature) ?? 0;
        const spentMinor = spentByNature[nature];
        const bucketCategories = categories.filter(
          (c) => (c.spendingNature ?? "NECESITO") === nature,
        );

        const limited = bucketCategories
          .filter((c) => catLimitMap.has(c.id))
          .map((c) => {
            const limitMinor = catLimitMap.get(c.id)!;
            const catSpentMinor = spentByCategory.get(c.id) ?? 0;
            const ratio = limitMinor > 0 ? catSpentMinor / limitMinor : 0;
            const status =
              catSpentMinor > limitMinor
                ? ("over" as const)
                : isCurrentMonth && ratio > pace + 0.15
                  ? ("above_pace" as const)
                  : ("on_pace" as const);
            const leftMinor = Math.max(0, limitMinor - catSpentMinor);
            return {
              categoryId: c.id,
              name: c.name,
              icon: c.icon,
              spent: catSpentMinor / MINOR_UNIT,
              limit: limitMinor / MINOR_UNIT,
              perDayLeft:
                isCurrentMonth && daysLeft > 0
                  ? leftMinor / MINOR_UNIT / daysLeft
                  : 0,
              status,
            };
          });

        const otherSpent = bucketCategories
          .filter((c) => !catLimitMap.has(c.id))
          .map((c) => ({
            categoryId: c.id,
            name: c.name,
            icon: c.icon,
            spent: (spentByCategory.get(c.id) ?? 0) / MINOR_UNIT,
          }))
          .filter((c) => c.spent > 0)
          .sort((a, b) => b.spent - a.spent);

        const sumLimitsMinor = limited.reduce(
          (s, l) => s + Math.round(l.limit * MINOR_UNIT),
          0,
        );
        const flexibleMinor = Math.max(0, plannedMinor - sumLimitsMinor);

        return {
          nature,
          planned: plannedMinor / MINOR_UNIT,
          spent: spentMinor / MINOR_UNIT,
          left: (plannedMinor - spentMinor) / MINOR_UNIT,
          limited,
          otherSpent,
          flexible: flexibleMinor / MINOR_UNIT,
        };
      });

      const totalPlannedMinor = NATURES.reduce(
        (s, n) => s + (naturePlanMap.get(n) ?? 0),
        0,
      );
      const totalSpentMinor =
        spentByNature.DEBO + spentByNature.NECESITO + spentByNature.QUIERO;

      return {
        month: input.month,
        currency,
        hasPlan: true,
        hasPreviousPlan: Boolean(prevBudget),
        isPastMonth,
        isCurrentMonth,
        pace,
        daysLeft,
        actualIncome: actualIncomeMinor / MINOR_UNIT,
        totalSpent: totalSpentMinor / MINOR_UNIT,
        suggestion,
        plan: {
          id: budget.id,
          expectedIncome: budget.expectedIncome / MINOR_UNIT,
          totalPlanned: totalPlannedMinor / MINOR_UNIT,
          leftToSpend: (totalPlannedMinor - totalSpentMinor) / MINOR_UNIT,
          notPlanned: (budget.expectedIncome - totalPlannedMinor) / MINOR_UNIT,
          buckets,
        },
      };
    }),

  upsertPlan: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        expectedIncome: z.number().nonnegative().max(20_000_000),
        DEBO: z.number().nonnegative().max(20_000_000),
        NECESITO: z.number().nonnegative().max(20_000_000),
        QUIERO: z.number().nonnegative().max(20_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;
      const { start } = parseMonth(input.month);

      const expectedMinor = Math.round(input.expectedIncome * MINOR_UNIT);
      const natureAmounts: Record<Nature, number> = {
        DEBO: Math.round(input.DEBO * MINOR_UNIT),
        NECESITO: Math.round(input.NECESITO * MINOR_UNIT),
        QUIERO: Math.round(input.QUIERO * MINOR_UNIT),
      };

      const budget = await db.$transaction(async (tx) => {
        const b = await tx.budget.upsert({
          where: { organizationId_month: { organizationId: orgId, month: start } },
          create: {
            organizationId: orgId,
            month: start,
            expectedIncome: expectedMinor,
            createdBy: userId,
          },
          update: {
            expectedIncome: expectedMinor,
            deletedAt: null,
            updatedBy: userId,
          },
          select: { id: true },
        });

        for (const nature of NATURES) {
          await tx.budgetNature.upsert({
            where: { budgetId_nature: { budgetId: b.id, nature } },
            create: { budgetId: b.id, nature, amount: natureAmounts[nature] },
            update: { amount: natureAmounts[nature] },
          });
        }

        return b;
      });

      return { id: budget.id };
    }),

  setCategoryLimit: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        categoryId: z.number().int().positive(),
        /** null removes the limit */
        limit: z.number().positive().max(20_000_000).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const { start } = parseMonth(input.month);

      const [budget, category] = await Promise.all([
        db.budget.findFirst({
          where: { organizationId: orgId, month: start, deletedAt: null },
          include: { natures: true, categories: { include: { category: true } } },
        }),
        db.category.findFirst({
          where: { id: input.categoryId, organizationId: orgId, deletedAt: null },
          select: { id: true, spendingNature: true },
        }),
      ]);
      if (!budget || !category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan or category not found" });
      }

      if (input.limit === null) {
        await db.budgetCategory.deleteMany({
          where: { budgetId: budget.id, categoryId: category.id },
        });
        return { ok: true };
      }

      const limitMinor = Math.round(input.limit * MINOR_UNIT);
      const nature = (category.spendingNature ?? "NECESITO") as Nature;
      const bucketCap =
        budget.natures.find((n) => n.nature === nature)?.amount ?? 0;

      const otherLimitsMinor = budget.categories
        .filter(
          (c) =>
            c.categoryId !== category.id &&
            (c.category.spendingNature ?? "NECESITO") === nature,
        )
        .reduce((s, c) => s + c.amount, 0);

      if (bucketCap > 0 && otherLimitsMinor + limitMinor > bucketCap) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Category limits exceed this bucket (${((otherLimitsMinor + limitMinor) / MINOR_UNIT).toFixed(0)} > ${(bucketCap / MINOR_UNIT).toFixed(0)}). Raise the bucket or lower a limit.`,
        });
      }

      await db.budgetCategory.upsert({
        where: {
          budgetId_categoryId: { budgetId: budget.id, categoryId: category.id },
        },
        create: { budgetId: budget.id, categoryId: category.id, amount: limitMinor },
        update: { amount: limitMinor },
      });

      return { ok: true };
    }),

  copyPrevious: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;
      const { start, prevStart } = parseMonth(input.month);

      const prev = await db.budget.findFirst({
        where: { organizationId: orgId, month: prevStart, deletedAt: null },
        include: { natures: true, categories: true },
      });
      if (!prev) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No previous month plan to copy.",
        });
      }

      const created = await db.$transaction(async (tx) => {
        const b = await tx.budget.upsert({
          where: { organizationId_month: { organizationId: orgId, month: start } },
          create: {
            organizationId: orgId,
            month: start,
            expectedIncome: prev.expectedIncome,
            createdBy: userId,
          },
          update: {
            expectedIncome: prev.expectedIncome,
            deletedAt: null,
            updatedBy: userId,
          },
          select: { id: true },
        });
        for (const n of prev.natures) {
          await tx.budgetNature.upsert({
            where: { budgetId_nature: { budgetId: b.id, nature: n.nature } },
            create: { budgetId: b.id, nature: n.nature, amount: n.amount },
            update: { amount: n.amount },
          });
        }
        for (const c of prev.categories) {
          await tx.budgetCategory.upsert({
            where: {
              budgetId_categoryId: { budgetId: b.id, categoryId: c.categoryId },
            },
            create: { budgetId: b.id, categoryId: c.categoryId, amount: c.amount },
            update: { amount: c.amount },
          });
        }
        return b;
      });

      return { id: created.id };
    }),
});
