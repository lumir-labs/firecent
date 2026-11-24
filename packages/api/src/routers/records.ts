import { TRPCError } from "@trpc/server";
import z from "zod";
import { db, type Prisma } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

/** `Record.amount` is stored in minor units (cents), signed: − out, + in. */
const MINOR_UNIT = 100;

const natureEnum = z.enum(["DEBO", "NECESITO", "QUIERO"]);

const filterInput = z.object({
  search: z.string().trim().max(120).nullish(),
  /** "YYYY-MM" */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullish(),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).nullish(),
  natures: z.array(natureEnum).nullish(),
  accountId: z.number().int().positive().nullish(),
  accountIds: z.array(z.number().int().positive()).nullish(),
  categoryId: z.number().int().positive().nullish(),
  createdBy: z.string().nullish(),
  /** Absolute amount bounds in major units */
  minAmount: z.number().nonnegative().nullish(),
  maxAmount: z.number().nonnegative().nullish(),
  labelIds: z.array(z.number().int().positive()).nullish(),
});

const listInput = filterInput.extend({
  limit: z.number().int().min(1).max(200).default(100),
  cursor: z.number().int().min(0).nullish(),
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
    /** Optional destination amount in minor units for cross-currency transfers. */
    receiveAmount: z.number().int().positive().max(2_000_000_000).nullish(),
    accountId: z.number().int().positive(),
    transferAccountId: z.number().int().positive().nullish(),
    categoryId: z.number().int().positive().nullish(),
    payeeId: z.number().int().positive().nullish(),
    payeeName: z.string().trim().max(100).nullish(),
    spendingNature: natureEnum.nullish(),
    labelIds: z.array(z.number().int().positive()).max(20).optional(),
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

const updateInput = z.object({
  id: z.number().int().positive(),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).optional(),
  /** Positive amount in minor units */
  amount: z.number().int().positive().max(2_000_000_000).optional(),
  receiveAmount: z.number().int().positive().max(2_000_000_000).nullish(),
  accountId: z.number().int().positive().optional(),
  transferAccountId: z.number().int().positive().nullish(),
  categoryId: z.number().int().positive().nullish(),
  payeeId: z.number().int().positive().nullish(),
  payeeName: z.string().trim().max(100).nullish(),
  spendingNature: natureEnum.nullish(),
  labelIds: z.array(z.number().int().positive()).max(20).optional(),
  paymentType: z.enum(["CASH", "CREDIT_CARD", "WEB_PAYMENT"]).optional(),
  note: z.string().trim().max(500).nullish(),
  recordDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  recordTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

const recordSelect = {
  id: true,
  type: true,
  amount: true,
  note: true,
  spendingNature: true,
  paymentType: true,
  transfer: true,
  transferGroupId: true,
  recordDate: true,
  recordTime: true,
  createdBy: true,
  payee: { select: { id: true, name: true } },
  category: {
    select: { id: true, name: true, color: true, icon: true, spendingNature: true },
  },
  account: { select: { id: true, name: true, color: true, currency: true } },
  transferAccount: { select: { id: true, name: true, color: true, currency: true } },
  labels: { select: { id: true, name: true, color: true } },
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

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 1)),
  };
}

async function buildWhere(
  orgId: string,
  input: z.infer<typeof filterInput>,
): Promise<{
  where: Prisma.RecordWhereInput;
  singleAccountMode: boolean;
}> {
  const and: Prisma.RecordWhereInput[] = [
    { organizationId: orgId, deletedAt: null },
  ];

  // Accounts filter
  const accountIds = [
    ...(input.accountId ? [input.accountId] : []),
    ...(input.accountIds ?? []),
  ];
  const uniqueAccountIds = [...new Set(accountIds)];
  const singleAccountMode = uniqueAccountIds.length === 1;

  if (uniqueAccountIds.length === 1) {
    and.push({ accountId: uniqueAccountIds[0] });
  } else if (uniqueAccountIds.length > 1) {
    and.push({ accountId: { in: uniqueAccountIds } });
  }

  // Transfer deduplication (D6): when not viewing a single account, hide the
  // positive entry half of transfers so each transfer appears once (the exit).
  if (!singleAccountMode) {
    and.push({
      NOT: {
        AND: [{ transfer: true }, { amount: { gt: 0 } }],
      },
    });
  }

  if (input.month) {
    const { start, end } = monthBounds(input.month);
    and.push({ recordDate: { gte: start, lt: end } });
  }

  if (input.type) {
    if (input.type === "TRANSFER") {
      and.push({ OR: [{ type: "TRANSFER" }, { transfer: true }] });
    } else {
      and.push({ type: input.type, transfer: false });
    }
  }

  if (input.categoryId) {
    const children = await db.category.findMany({
      where: { organizationId: orgId, parentId: input.categoryId, deletedAt: null },
      select: { id: true },
    });
    const ids = [input.categoryId, ...children.map((c) => c.id)];
    and.push({ categoryId: { in: ids } });
  }

  if (input.natures && input.natures.length > 0) {
    and.push({
      type: "EXPENSE",
      transfer: false,
      OR: [
        { spendingNature: { in: input.natures } },
        {
          spendingNature: null,
          category: { spendingNature: { in: input.natures } },
        },
      ],
    });
  }

  if (input.createdBy) {
    and.push({ createdBy: input.createdBy });
  }

  if (input.labelIds && input.labelIds.length > 0) {
    and.push({
      labels: { some: { id: { in: input.labelIds } } },
    });
  }

  if (input.minAmount != null || input.maxAmount != null) {
    const minMinor =
      input.minAmount != null ? Math.round(input.minAmount * MINOR_UNIT) : null;
    const maxMinor =
      input.maxAmount != null ? Math.round(input.maxAmount * MINOR_UNIT) : null;
    const pos: Prisma.IntFilter = { gte: 0 };
    const neg: Prisma.IntFilter = { lt: 0 };
    if (minMinor != null) {
      pos.gte = minMinor;
      neg.lte = -minMinor;
    }
    if (maxMinor != null) {
      pos.lte = maxMinor;
      neg.gte = -maxMinor;
    }
    and.push({ OR: [{ amount: pos }, { amount: neg }] });
  }

  if (input.search) {
    const q = input.search.trim();
    const num = Number.parseFloat(q.replace(/[^0-9.]/g, ""));
    const searchOr: Prisma.RecordWhereInput[] = [
      { note: { contains: q, mode: "insensitive" } },
      { payee: { name: { contains: q, mode: "insensitive" } } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { account: { name: { contains: q, mode: "insensitive" } } },
    ];
    // Improvement over prototype: approximate amount match (e.g. "41" matches $41.00..$41.99)
    if (Number.isFinite(num) && num > 0 && /^\$?\d+(\.\d{1,2})?$/.test(q)) {
      const hasDecimals = q.includes(".");
      if (hasDecimals) {
        const exact = Math.round(num * MINOR_UNIT);
        searchOr.push({ amount: exact }, { amount: -exact });
      } else {
        const low = Math.floor(num) * MINOR_UNIT;
        const high = low + 99;
        searchOr.push(
          { amount: { gte: low, lte: high } },
          { amount: { gte: -high, lte: -low } },
        );
      }
    }
    and.push({ OR: searchOr });
  }

  return { where: { AND: and }, singleAccountMode };
}

async function resolvePayeeId(
  orgId: string,
  userId: string | null,
  payeeId?: number | null,
  payeeName?: string | null,
): Promise<number | null> {
  if (payeeId) {
    const found = await db.payee.findFirst({
      where: { id: payeeId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!found) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid payee" });
    }
    return found.id;
  }
  const trimmed = payeeName?.trim();
  if (!trimmed) return null;
  const existing = await db.payee.findFirst({
    where: {
      organizationId: orgId,
      name: { equals: trimmed, mode: "insensitive" },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await db.payee.create({
    data: {
      organizationId: orgId,
      name: trimmed,
      createdBy: userId,
    },
    select: { id: true },
  });
  return created.id;
}

export const recordsRouter = router({
  list: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const offset = input.cursor ?? 0;

      const { where, singleAccountMode } = await buildWhere(orgId, input);
      const withBalance =
        singleAccountMode &&
        !input.categoryId &&
        !input.search &&
        !input.type &&
        !(input.natures && input.natures.length > 0);

      const [rows, total, accountSum, newer, members] = await Promise.all([
        db.record.findMany({
          where,
          orderBy: [...listOrder],
          skip: offset,
          take: input.limit + 1,
          select: recordSelect,
        }),
        offset === 0 ? db.record.count({ where }) : Promise.resolve(null),
        withBalance
          ? db.record.aggregate({ where, _sum: { amount: true } })
          : Promise.resolve(null),
        withBalance && offset > 0
          ? db.record.findMany({
              where,
              orderBy: [...listOrder],
              take: offset,
              select: { amount: true },
            })
          : Promise.resolve([] as { amount: number }[]),
        db.member.findMany({
          where: { organizationId: orgId },
          select: { user: { select: { id: true, name: true, email: true } } },
        }),
      ]);

      const userMap = new Map<string, { name: string; initial: string }>();
      for (const m of members) {
        const display = m.user.name || m.user.email;
        userMap.set(m.user.id, {
          name: display,
          initial: display.trim().charAt(0).toUpperCase() || "U",
        });
      }

      const hasMore = rows.length > input.limit;
      let running =
        (accountSum?._sum.amount ?? 0) -
        newer.reduce((sum, r) => sum + r.amount, 0);

      const items = rows.slice(0, input.limit).map((r) => {
        const balance = withBalance ? running / MINOR_UNIT : null;
        running -= r.amount;
        const effectiveNature =
          r.type === "EXPENSE" && !r.transfer
            ? (r.spendingNature ?? r.category?.spendingNature ?? null)
            : null;
        const creator = r.createdBy ? userMap.get(r.createdBy) ?? null : null;

        return {
          id: r.id,
          type: r.type,
          transfer: r.transfer,
          transferGroupId: r.transferGroupId,
          amount: r.amount / MINOR_UNIT,
          currency: r.account.currency,
          note: r.note,
          spendingNature: r.spendingNature,
          nature: effectiveNature,
          paymentType: r.paymentType,
          date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
          time: r.recordTime ? r.recordTime.toISOString().slice(11, 16) : null,
          payee: r.payee?.name ?? null,
          payeeId: r.payee?.id ?? null,
          category: r.category,
          account: r.account,
          transferAccount: r.transferAccount,
          labels: r.labels,
          createdBy: creator,
          balance,
        };
      });

      return {
        items,
        total,
        nextCursor: hasMore ? offset + input.limit : null,
      };
    }),

  monthSummary: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(filterInput)
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const { where } = await buildWhere(orgId, input);

      const rows = await db.record.findMany({
        where,
        select: {
          amount: true,
          type: true,
          transfer: true,
          recordDate: true,
          account: { select: { currency: true } },
        },
      });

      let inMinor = 0;
      let outMinor = 0;
      const byDayMinor: Record<string, number> = {};
      const currencyCount = new Map<string, number>();

      for (const r of rows) {
        currencyCount.set(
          r.account.currency,
          (currencyCount.get(r.account.currency) ?? 0) + 1,
        );
        const day = r.recordDate ? r.recordDate.toISOString().slice(0, 10) : "undated";
        if (!r.transfer && r.type !== "TRANSFER") {
          if (r.type === "INCOME") {
            inMinor += r.amount;
          } else if (r.type === "EXPENSE") {
            outMinor += -r.amount;
          }
          byDayMinor[day] = (byDayMinor[day] ?? 0) + r.amount;
        }
      }

      const byDay: Record<string, number> = {};
      for (const [d, v] of Object.entries(byDayMinor)) {
        byDay[d] = v / MINOR_UNIT;
      }

      const primaryCurrency =
        [...currencyCount.entries()].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0]?.[0] ?? "USD";

      return {
        currency: primaryCurrency,
        in: inMinor / MINOR_UNIT,
        out: outMinor / MINOR_UNIT,
        count: rows.length,
        byDay,
      };
    }),

  get: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const r = await db.record.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: recordSelect,
      });
      if (!r) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }
      const effectiveNature =
        r.type === "EXPENSE" && !r.transfer
          ? (r.spendingNature ?? r.category?.spendingNature ?? null)
          : null;

      return {
        id: r.id,
        type: r.type,
        transfer: r.transfer,
        transferGroupId: r.transferGroupId,
        amount: r.amount / MINOR_UNIT,
        currency: r.account.currency,
        note: r.note,
        spendingNature: r.spendingNature,
        nature: effectiveNature,
        paymentType: r.paymentType,
        date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
        time: r.recordTime ? r.recordTime.toISOString().slice(11, 16) : null,
        payee: r.payee,
        category: r.category,
        account: r.account,
        transferAccount: r.transferAccount,
        labels: r.labels,
      };
    }),

  formOptions: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .query(async ({ ctx }) => {
      const orgId = requireOrg(ctx.orgId);
      const [accounts, categories, payees, labels] = await Promise.all([
        db.bankAccount.findMany({
          where: { organizationId: orgId, deletedAt: null, archived: false },
          select: { id: true, name: true, color: true, currency: true, type: true },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        }),
        db.category.findMany({
          where: { organizationId: orgId, deletedAt: null, hidden: false },
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            type: true,
            spendingNature: true,
            parentId: true,
          },
          orderBy: { name: "asc" },
        }),
        db.payee.findMany({
          where: { organizationId: orgId, deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        db.label.findMany({
          where: { organizationId: orgId, deletedAt: null },
          select: { id: true, name: true, color: true },
          orderBy: { name: "asc" },
        }),
      ]);
      return { accounts, categories, payees, labels };
    }),

  suggestions: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        accountId: z.number().int().positive().nullish(),
        type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).default("EXPENSE"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const currentHour = now.getHours();

      const [recentRecords, allCategories, lastUserRecord] = await Promise.all([
        db.record.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            transfer: false,
            type: input.type === "INCOME" ? "INCOME" : "EXPENSE",
            recordDate: { gte: ninetyDaysAgo },
          },
          select: {
            categoryId: true,
            accountId: true,
            payeeId: true,
            amount: true,
            recordDate: true,
            recordTime: true,
            payee: { select: { id: true, name: true } },
            category: { select: { id: true, name: true, icon: true } },
            account: { select: { id: true, name: true, currency: true } },
          },
          orderBy: { recordDate: "desc" },
          take: 400,
        }),
        db.category.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            hidden: false,
            type: input.type === "INCOME" ? "INCOME" : "EXPENSE",
          },
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            spendingNature: true,
            parentId: true,
          },
          orderBy: { name: "asc" },
        }),
        userId
          ? db.record.findFirst({
              where: {
                organizationId: orgId,
                deletedAt: null,
                createdBy: userId,
              },
              orderBy: [{ createdAt: "desc" }],
              select: { accountId: true },
            })
          : null,
      ]);

      // Score categories: +3 if within ±2h & same account, +2 if same account, +1 overall
      const catScore = new Map<number, number>();
      // Repeats in last 60 days: key = payeeId|absAmount|categoryId|accountId
      const repeatMap = new Map<
        string,
        {
          count: number;
          payeeId: number;
          payeeName: string;
          amount: number;
          currency: string;
          categoryId: number;
          categoryName: string;
          categoryIcon: string | null;
          accountId: number;
          accountName: string;
        }
      >();

      for (const r of recentRecords) {
        if (r.categoryId) {
          let weight = 1;
          if (input.accountId && r.accountId === input.accountId) weight += 2;
          if (r.recordTime) {
            const h = r.recordTime.getUTCHours();
            const diff = Math.min(
              Math.abs(h - currentHour),
              24 - Math.abs(h - currentHour),
            );
            if (diff <= 2) weight += 1;
          }
          catScore.set(r.categoryId, (catScore.get(r.categoryId) ?? 0) + weight);
        }

        if (
          r.recordDate &&
          r.recordDate >= sixtyDaysAgo &&
          r.payee &&
          r.category &&
          r.account
        ) {
          const absMinor = Math.abs(r.amount);
          const key = `${r.payee.id}|${absMinor}|${r.category.id}|${r.account.id}`;
          const prev = repeatMap.get(key);
          if (prev) {
            prev.count += 1;
          } else {
            repeatMap.set(key, {
              count: 1,
              payeeId: r.payee.id,
              payeeName: r.payee.name,
              amount: absMinor / MINOR_UNIT,
              currency: r.account.currency,
              categoryId: r.category.id,
              categoryName: r.category.name,
              categoryIcon: r.category.icon,
              accountId: r.account.id,
              accountName: r.account.name,
            });
          }
        }
      }

      const sortedCategories = [...allCategories]
        .sort((a, b) => (catScore.get(b.id) ?? 0) - (catScore.get(a.id) ?? 0))
        .slice(0, 7);

      const repeats = [...repeatMap.values()]
        .filter((x) => x.count >= 3)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Payee → most used category map (for quick-add auto-category enhancement)
      const payeeCatFreq = new Map<number, Map<number, number>>();
      for (const r of recentRecords) {
        if (!r.payeeId || !r.categoryId) continue;
        let inner = payeeCatFreq.get(r.payeeId);
        if (!inner) {
          inner = new Map();
          payeeCatFreq.set(r.payeeId, inner);
        }
        inner.set(r.categoryId, (inner.get(r.categoryId) ?? 0) + 1);
      }
      const payeeDefaultCategory: Record<number, number> = {};
      for (const [pId, freq] of payeeCatFreq.entries()) {
        const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
        if (top) payeeDefaultCategory[pId] = top[0];
      }

      return {
        categories: sortedCategories,
        repeats,
        lastAccountId: lastUserRecord?.accountId ?? null,
        payeeDefaultCategory,
      };
    }),

  create: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;
      const isTransfer = input.type === "TRANSFER";

      const accountIds = [input.accountId];
      if (isTransfer && input.transferAccountId) {
        accountIds.push(input.transferAccountId);
      }
      const [accountCount, category] = await Promise.all([
        db.bankAccount.count({
          where: { id: { in: accountIds }, organizationId: orgId, deletedAt: null },
        }),
        !isTransfer && input.categoryId
          ? db.category.findFirst({
              where: { id: input.categoryId, organizationId: orgId, deletedAt: null },
              select: { id: true },
            })
          : null,
      ]);
      if (
        accountCount !== accountIds.length ||
        (!isTransfer && input.categoryId && !category)
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid reference" });
      }

      const resolvedPayeeId = !isTransfer
        ? await resolvePayeeId(orgId, userId, input.payeeId, input.payeeName)
        : null;

      let validLabelIds: number[] = [];
      if (input.labelIds && input.labelIds.length > 0) {
        const labels = await db.label.findMany({
          where: { id: { in: input.labelIds }, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        validLabelIds = labels.map((l) => l.id);
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
        const entryAmount = input.receiveAmount ?? input.amount;
        const exitId = await db.$transaction(async (tx) => {
          const exit = await tx.record.create({
            data: {
              ...common,
              type: "TRANSFER",
              transfer: true,
              accountId: input.accountId,
              transferAccountId: to,
              amount: -input.amount,
              ...(validLabelIds.length > 0
                ? { labels: { connect: validLabelIds.map((id) => ({ id })) } }
                : {}),
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
              amount: entryAmount,
              transferGroupId: exit.id,
              ...(validLabelIds.length > 0
                ? { labels: { connect: validLabelIds.map((id) => ({ id })) } }
                : {}),
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
          payeeId: resolvedPayeeId,
          spendingNature: input.type === "EXPENSE" ? (input.spendingNature ?? null) : null,
          amount: input.type === "EXPENSE" ? -input.amount : input.amount,
          ...(validLabelIds.length > 0
            ? { labels: { connect: validLabelIds.map((id) => ({ id })) } }
            : {}),
        },
        select: { id: true },
      });
      return { id: record.id };
    }),

  update: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const existing = await db.record.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      let labelUpdate: Prisma.LabelUpdateManyWithoutRecordsNestedInput | undefined;
      if (input.labelIds !== undefined) {
        const labels = await db.label.findMany({
          where: { id: { in: input.labelIds }, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        labelUpdate = { set: labels.map((l) => ({ id: l.id })) };
      }

      const nextDate = input.recordDate
        ? new Date(`${input.recordDate}T00:00:00.000Z`)
        : undefined;
      const nextTime = input.recordTime
        ? new Date(`1970-01-01T${input.recordTime}:00.000Z`)
        : undefined;

      // Transfer pair update in one transaction (D6)
      if (existing.transfer && existing.transferGroupId) {
        const pair = await db.record.findMany({
          where: {
            organizationId: orgId,
            transferGroupId: existing.transferGroupId,
            deletedAt: null,
          },
        });
        const exit = pair.find((r) => r.amount < 0) ?? existing;
        const entry = pair.find((r) => r.id !== exit.id);

        const nextFrom = input.accountId ?? exit.accountId;
        const nextTo = input.transferAccountId ?? exit.transferAccountId ?? entry?.accountId;
        const nextExitAmount = input.amount != null ? -input.amount : exit.amount;
        const nextEntryAmount =
          input.receiveAmount != null
            ? input.receiveAmount
            : input.amount != null
              ? input.amount
              : entry?.amount ?? Math.abs(exit.amount);

        await db.$transaction(async (tx) => {
          await tx.record.update({
            where: { id: exit.id },
            data: {
              accountId: nextFrom,
              transferAccountId: nextTo ?? null,
              amount: nextExitAmount,
              ...(input.note !== undefined ? { note: input.note || null } : {}),
              ...(nextDate ? { recordDate: nextDate } : {}),
              ...(nextTime ? { recordTime: nextTime } : {}),
              ...(input.paymentType ? { paymentType: input.paymentType } : {}),
              ...(labelUpdate ? { labels: labelUpdate } : {}),
              updatedBy: userId,
            },
          });
          if (entry && nextTo) {
            await tx.record.update({
              where: { id: entry.id },
              data: {
                accountId: nextTo,
                transferAccountId: nextFrom,
                amount: nextEntryAmount,
                ...(input.note !== undefined ? { note: input.note || null } : {}),
                ...(nextDate ? { recordDate: nextDate } : {}),
                ...(nextTime ? { recordTime: nextTime } : {}),
                ...(input.paymentType ? { paymentType: input.paymentType } : {}),
                ...(labelUpdate ? { labels: labelUpdate } : {}),
                updatedBy: userId,
              },
            });
          }
        });
        return { id: existing.id };
      }

      const nextType = input.type ?? existing.type;
      const absMinor =
        input.amount != null ? input.amount : Math.abs(existing.amount);
      const signedMinor = nextType === "EXPENSE" ? -absMinor : absMinor;

      const resolvedPayeeId =
        input.payeeId !== undefined || input.payeeName !== undefined
          ? await resolvePayeeId(orgId, userId, input.payeeId, input.payeeName)
          : undefined;

      await db.record.update({
        where: { id: existing.id },
        data: {
          type: nextType,
          amount: signedMinor,
          ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(resolvedPayeeId !== undefined ? { payeeId: resolvedPayeeId } : {}),
          ...(input.spendingNature !== undefined
            ? { spendingNature: input.spendingNature }
            : {}),
          ...(input.note !== undefined ? { note: input.note || null } : {}),
          ...(nextDate ? { recordDate: nextDate } : {}),
          ...(nextTime ? { recordTime: nextTime } : {}),
          ...(input.paymentType ? { paymentType: input.paymentType } : {}),
          ...(labelUpdate ? { labels: labelUpdate } : {}),
          updatedBy: userId,
        },
      });
      return { id: existing.id };
    }),

  delete: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const existing = await db.record.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true, transfer: true, transferGroupId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      const now = new Date();
      if (existing.transfer && existing.transferGroupId) {
        await db.record.updateMany({
          where: {
            organizationId: orgId,
            transferGroupId: existing.transferGroupId,
            deletedAt: null,
          },
          data: { deletedAt: now, deletedBy: userId },
        });
      } else {
        await db.record.update({
          where: { id: existing.id },
          data: { deletedAt: now, deletedBy: userId },
        });
      }
      return { id: existing.id };
    }),

  restore: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const existing = await db.record.findFirst({
        where: { id: input.id, organizationId: orgId },
        select: { id: true, transfer: true, transferGroupId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      if (existing.transfer && existing.transferGroupId) {
        await db.record.updateMany({
          where: {
            organizationId: orgId,
            transferGroupId: existing.transferGroupId,
          },
          data: { deletedAt: null, deletedBy: null, updatedBy: userId },
        });
      } else {
        await db.record.update({
          where: { id: existing.id },
          data: { deletedAt: null, deletedBy: null, updatedBy: userId },
        });
      }
      return { id: existing.id };
    }),

  bulkUpdate: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        ids: z.array(z.number().int().positive()).min(1).max(200),
        categoryId: z.number().int().positive().nullish(),
        labelIds: z.array(z.number().int().positive()).max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      if (input.categoryId !== undefined) {
        await db.record.updateMany({
          where: {
            id: { in: input.ids },
            organizationId: orgId,
            deletedAt: null,
            transfer: false,
          },
          data: { categoryId: input.categoryId, updatedBy: userId },
        });
      }

      if (input.labelIds && input.labelIds.length > 0) {
        const labels = await db.label.findMany({
          where: { id: { in: input.labelIds }, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        const ownedRecords = await db.record.findMany({
          where: { id: { in: input.ids }, organizationId: orgId, deletedAt: null },
          select: { id: true },
        });
        await db.$transaction(
          ownedRecords.map((r) =>
            db.record.update({
              where: { id: r.id },
              data: {
                labels: { connect: labels.map((l) => ({ id: l.id })) },
                updatedBy: userId,
              },
            }),
          ),
        );
      }

      return { count: input.ids.length };
    }),

  bulkDelete: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;
      const now = new Date();

      const records = await db.record.findMany({
        where: { id: { in: input.ids }, organizationId: orgId, deletedAt: null },
        select: { id: true, transferGroupId: true },
      });
      const groupIds = records
        .map((r) => r.transferGroupId)
        .filter((g): g is number => g != null);

      const res = await db.record.updateMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { id: { in: records.map((r) => r.id) } },
            ...(groupIds.length > 0 ? [{ transferGroupId: { in: groupIds } }] : []),
          ],
        },
        data: { deletedAt: now, deletedBy: userId },
      });

      return { count: res.count };
    }),

  exportCsv: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(filterInput)
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const { where } = await buildWhere(orgId, input);

      const rows = await db.record.findMany({
        where,
        orderBy: [...listOrder],
        take: 5000,
        select: recordSelect,
      });

      const esc = (v: string) => {
        if (v.includes(",") || v.includes('"') || v.includes("\n")) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      };

      const header = "Date,Payee,Category,Account,Amount,Currency,Note,Labels";
      const lines = rows.map((r) =>
        [
          r.recordDate ? r.recordDate.toISOString().slice(0, 10) : "",
          r.payee?.name ?? "",
          r.category?.name ?? "",
          r.account.name,
          (r.amount / MINOR_UNIT).toFixed(2),
          r.account.currency,
          r.note ?? "",
          r.labels.map((l) => l.name).join("; "),
        ]
          .map(esc)
          .join(","),
      );

      return { csv: [header, ...lines].join("\n"), count: rows.length };
    }),
});
