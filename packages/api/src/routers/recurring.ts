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

function advanceDate(
  from: Date,
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY",
  interval: number,
  daysOfMonth: number[],
): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();

  if (frequency === "WEEKLY") {
    return new Date(Date.UTC(y, m, d + 7 * Math.max(1, interval)));
  }
  if (frequency === "YEARLY") {
    return new Date(Date.UTC(y + Math.max(1, interval), m, d));
  }
  // MONTHLY
  const targetDay = daysOfMonth[0] ?? d;
  const nextMonth = m + Math.max(1, interval);
  const daysInTarget = new Date(Date.UTC(y, nextMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, nextMonth, Math.min(targetDay, daysInTarget)));
}

function monthlyEquivalent(
  amountMinor: number,
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY",
  interval: number,
): number {
  const step = Math.max(1, interval);
  if (frequency === "WEEKLY") return (amountMinor * 52) / 12 / step;
  if (frequency === "YEARLY") return amountMinor / 12 / step;
  return amountMinor / step;
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

export const recurringRouter = router({
  list: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .query(async ({ ctx }) => {
      const orgId = requireOrg(ctx.orgId);
      const now = new Date();

      const [templates, accounts, categories] = await Promise.all([
        db.recurring.findMany({
          where: { organizationId: orgId, deletedAt: null },
          orderBy: [{ nextDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
        }),
        db.bankAccount.findMany({
          where: { organizationId: orgId, deletedAt: null },
          select: { id: true, name: true, currency: true },
        }),
        db.category.findMany({
          where: { organizationId: orgId, deletedAt: null },
          select: { id: true, name: true, icon: true },
        }),
      ]);

      const accMap = new Map(accounts.map((a) => [a.id, a]));
      const catMap = new Map(categories.map((c) => [c.id, c]));

      const curCount = new Map<string, number>();
      for (const a of accounts) {
        curCount.set(a.currency, (curCount.get(a.currency) ?? 0) + 1);
      }
      const currency =
        [...curCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

      const items = templates.map((r) => {
        const acc = accMap.get(r.accountId);
        const cat = r.categoryId ? catMap.get(r.categoryId) ?? null : null;
        const due = r.pausedAt ? null : daysUntil(r.nextDate, now);
        return {
          id: r.id,
          name: r.name,
          type: r.type,
          amount: Math.abs(r.amount) / MINOR_UNIT,
          isEstimate: r.isEstimate,
          currency: acc?.currency ?? currency,
          accountId: r.accountId,
          accountName: acc?.name ?? "Account",
          transferAccountId: r.transferAccountId,
          category: cat,
          mode: r.mode,
          frequency: r.frequency,
          interval: r.interval,
          daysOfMonth: r.daysOfMonth,
          startDate: r.startDate.toISOString().slice(0, 10),
          nextDate: r.nextDate ? r.nextDate.toISOString().slice(0, 10) : null,
          endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
          paused: Boolean(r.pausedAt),
          dueInDays: due,
          note: r.note,
        };
      });

      const activeExpenses = items.filter(
        (i) => !i.paused && i.type === "EXPENSE",
      );
      const monthlyPaymentsTotal =
        activeExpenses.reduce(
          (s, i) =>
            s +
            monthlyEquivalent(
              Math.round(i.amount * MINOR_UNIT),
              i.frequency,
              i.interval,
            ),
          0,
        ) / MINOR_UNIT;

      const needsYou = items.filter(
        (i) => !i.paused && i.dueInDays != null && i.dueInDays <= 0,
      );
      const next7Days = items.filter(
        (i) => !i.paused && i.dueInDays != null && i.dueInDays > 0 && i.dueInDays <= 7,
      );
      const later = items.filter(
        (i) => !i.paused && i.dueInDays != null && i.dueInDays > 7,
      );

      return {
        currency,
        monthlyPaymentsTotal,
        activeExpenseCount: activeExpenses.length,
        needsYou,
        next7Days,
        later,
        items,
      };
    }),

  create: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).default("EXPENSE"),
        /** Positive amount in major units */
        amount: z.number().positive().max(20_000_000),
        isEstimate: z.boolean().default(false),
        accountId: z.number().int().positive(),
        transferAccountId: z.number().int().positive().nullish(),
        categoryId: z.number().int().positive().nullish(),
        mode: z.enum(["AUTO", "MANUAL"]).default("MANUAL"),
        frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
        interval: z.number().int().min(1).max(12).default(1),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
        note: z.string().trim().max(300).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const acc = await db.bankAccount.findFirst({
        where: { id: input.accountId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!acc) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid account" });
      }

      const start = new Date(`${input.startDate}T00:00:00.000Z`);
      const mode = input.isEstimate ? "MANUAL" : input.mode;

      const created = await db.recurring.create({
        data: {
          organizationId: orgId,
          name: input.name,
          type: input.type,
          amount: Math.round(input.amount * MINOR_UNIT),
          isEstimate: input.isEstimate,
          accountId: input.accountId,
          transferAccountId:
            input.type === "TRANSFER" ? (input.transferAccountId ?? null) : null,
          categoryId: input.type !== "TRANSFER" ? (input.categoryId ?? null) : null,
          mode,
          frequency: input.frequency,
          interval: input.interval,
          daysOfMonth:
            input.frequency === "MONTHLY" ? [start.getUTCDate()] : [],
          startDate: start,
          nextDate: start,
          endDate: input.endDate
            ? new Date(`${input.endDate}T00:00:00.000Z`)
            : null,
          note: input.note || null,
          createdBy: userId,
        },
        select: { id: true },
      });

      return { id: created.id };
    }),

  confirm: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        id: z.number().int().positive(),
        /** Optional actual amount override in major units */
        amount: z.number().positive().max(20_000_000).optional(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const rec = await db.recurring.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
      });
      if (!rec) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recurring not found" });
      }

      const dueDate = rec.nextDate ?? new Date();
      const recordDate = input.date
        ? new Date(`${input.date}T00:00:00.000Z`)
        : dueDate;
      const amountMinor =
        input.amount != null
          ? Math.round(input.amount * MINOR_UNIT)
          : Math.abs(rec.amount);
      const nextDue = advanceDate(
        dueDate,
        rec.frequency,
        rec.interval,
        rec.daysOfMonth,
      );
      const finalNext =
        rec.endDate && nextDue > rec.endDate ? null : nextDue;

      await db.$transaction(async (tx) => {
        let createdRecordId: number;
        if (rec.type === "TRANSFER" && rec.transferAccountId) {
          const exit = await tx.record.create({
            data: {
              organizationId: orgId,
              accountId: rec.accountId,
              transferAccountId: rec.transferAccountId,
              type: "TRANSFER",
              transfer: true,
              amount: -amountMinor,
              note: rec.name,
              recordDate,
              recordTime: new Date("1970-01-01T12:00:00.000Z"),
              recurringId: rec.id,
              createdBy: userId,
            },
            select: { id: true },
          });
          await tx.record.create({
            data: {
              organizationId: orgId,
              accountId: rec.transferAccountId,
              transferAccountId: rec.accountId,
              type: "TRANSFER",
              transfer: true,
              transferGroupId: exit.id,
              amount: amountMinor,
              note: rec.name,
              recordDate,
              recordTime: new Date("1970-01-01T12:00:00.000Z"),
              recurringId: rec.id,
              createdBy: userId,
            },
          });
          await tx.record.update({
            where: { id: exit.id },
            data: { transferGroupId: exit.id },
          });
          createdRecordId = exit.id;
        } else {
          const created = await tx.record.create({
            data: {
              organizationId: orgId,
              accountId: rec.accountId,
              categoryId: rec.categoryId,
              type: rec.type,
              amount: rec.type === "EXPENSE" ? -amountMinor : amountMinor,
              note: rec.name,
              recordDate,
              recordTime: new Date("1970-01-01T12:00:00.000Z"),
              recurringId: rec.id,
              createdBy: userId,
            },
            select: { id: true },
          });
          createdRecordId = created.id;
        }

        await tx.recurringOccurrence.upsert({
          where: { recurringId_dueDate: { recurringId: rec.id, dueDate } },
          create: {
            recurringId: rec.id,
            dueDate,
            amount: amountMinor,
            status: "CONFIRMED",
            recordId: createdRecordId,
            decidedBy: userId,
            decidedAt: new Date(),
          },
          update: {
            amount: amountMinor,
            status: "CONFIRMED",
            recordId: createdRecordId,
            decidedBy: userId,
            decidedAt: new Date(),
          },
        });

        await tx.recurring.update({
          where: { id: rec.id },
          data: { nextDate: finalNext, updatedBy: userId },
        });
      });

      return { id: rec.id };
    }),

  skip: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const rec = await db.recurring.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
      });
      if (!rec || !rec.nextDate) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recurring not found" });
      }

      const nextDue = advanceDate(
        rec.nextDate,
        rec.frequency,
        rec.interval,
        rec.daysOfMonth,
      );
      const finalNext =
        rec.endDate && nextDue > rec.endDate ? null : nextDue;

      await db.$transaction(async (tx) => {
        await tx.recurringOccurrence.upsert({
          where: {
            recurringId_dueDate: { recurringId: rec.id, dueDate: rec.nextDate! },
          },
          create: {
            recurringId: rec.id,
            dueDate: rec.nextDate!,
            amount: rec.amount,
            status: "SKIPPED",
            decidedBy: userId,
            decidedAt: new Date(),
          },
          update: {
            status: "SKIPPED",
            decidedBy: userId,
            decidedAt: new Date(),
          },
        });
        await tx.recurring.update({
          where: { id: rec.id },
          data: { nextDate: finalNext, updatedBy: userId },
        });
      });

      return { id: rec.id };
    }),

  update: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        id: z.number().int().positive(),
        mode: z.enum(["AUTO", "MANUAL"]).optional(),
        paused: z.boolean().optional(),
        amount: z.number().positive().max(20_000_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const rec = await db.recurring.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
      });
      if (!rec) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recurring not found" });
      }
      if (input.mode === "AUTO" && rec.isEstimate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Auto needs a fixed amount.",
        });
      }

      await db.recurring.update({
        where: { id: rec.id },
        data: {
          ...(input.mode !== undefined ? { mode: input.mode } : {}),
          ...(input.paused !== undefined
            ? { pausedAt: input.paused ? new Date() : null }
            : {}),
          ...(input.amount !== undefined
            ? { amount: Math.round(input.amount * MINOR_UNIT) }
            : {}),
          updatedBy: userId,
        },
      });
      return { id: rec.id };
    }),

  delete: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const rec = await db.recurring.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!rec) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recurring not found" });
      }
      await db.recurring.update({
        where: { id: rec.id },
        data: { deletedAt: new Date(), deletedBy: userId },
      });
      return { id: rec.id };
    }),
});
