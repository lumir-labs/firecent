import { TRPCError } from "@trpc/server";
import z from "zod";
import { db, type Prisma } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";
import {
  applyStatementProposalBatch,
  undoStatementProposalBatch,
} from "../assistant/reconciliation";
import {
  cancelActiveRunForUser,
  isThreadRunningForUser,
  reconcileProposalWithLiveDb,
  resolveProposalAccountDeterministic,
} from "../assistant/orchestrator";
import {
  recomputeReconciliationSummary,
  type AssistantUiBlock,
  type ExistingPeriodRecord,
  type ProposalPayload,
  type ReconciledRow,
  type RunningBalanceLedger,
  type StoredAttachmentMeta,
  type TokenUsageSummary,
} from "../assistant/types";

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

const reconciledRowInputSchema = z.object({
  uid: z.string().min(1).max(64),
  selected: z.boolean(),
  sourceStatementIndex: z.number().int().nonnegative().default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amountMinor: z.number().int().min(-2_000_000_000).max(2_000_000_000),
  description: z.string().max(300),
  note: z.string().max(500).nullable().default(null),
  payeeId: z.number().int().positive().nullable().default(null),
  payeeName: z.string().max(120).nullable().default(null),
  payeeMatchKind: z
    .enum(["EXACT", "FUZZY", "HISTORY", "NEW", "NONE"])
    .default("NONE"),
  categoryId: z.number().int().positive().nullable().default(null),
  categoryName: z.string().max(120).nullable().default(null),
  categorySource: z.enum(["PAYEE_HISTORY", "AI", "NONE"]).default("NONE"),
  spendingNature: z
    .enum(["DEBO", "NECESITO", "QUIERO"])
    .nullable()
    .default(null),
  paymentType: z
    .enum(["CASH", "CREDIT_CARD", "WEB_PAYMENT"])
    .default("WEB_PAYMENT"),
  isDuplicate: z.boolean().default(false),
  duplicateRecordId: z.number().int().positive().nullable().default(null),
  duplicateReason: z.string().max(120).nullable().default(null),
  transferMode: z
    .enum(["UNMATCHED", "LINK_EXISTING", "CREATE_PAIR"])
    .default("UNMATCHED"),
  matchedTransferRecordId: z.number().int().positive().nullable().default(null),
  matchedTransferInfo: z
    .object({
      recordId: z.number().int().positive(),
      accountId: z.number().int().positive(),
      accountName: z.string(),
      accountColor: z.string().nullable(),
      accountType: z.string(),
      currency: z.string(),
      date: z.string(),
      amountMinor: z.number().int(),
      note: z.string().nullable(),
      daysDiff: z.number().int(),
    })
    .nullable()
    .default(null),
  transferAccountId: z.number().int().positive().nullable().default(null),
  statementRunningBalanceMinor: z.number().int().nullable().optional(),
});

export const assistantRouter = router({
  /** Lists the current user's private threads in the active Space + sidebar stats. */
  listThreads: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .query(async ({ ctx }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const [threads, unmatchedTransferCount, pendingProposalCount] =
        await Promise.all([
          db.assistantThread.findMany({
            where: { organizationId: orgId, userId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            take: 50,
            select: {
              id: true,
              title: true,
              activeAccountId: true,
              createdAt: true,
              updatedAt: true,
              _count: { select: { messages: true } },
              proposals: {
                where: { status: { in: ["AWAITING_ACCOUNT", "PENDING"] } },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, status: true, title: true },
              },
            },
          }),
          db.record.count({
            where: {
              organizationId: orgId,
              deletedAt: null,
              transfer: true,
              transferGroupId: null,
              transferAccountId: null,
            },
          }),
          db.assistantProposal.count({
            where: {
              organizationId: orgId,
              userId,
              status: { in: ["AWAITING_ACCOUNT", "PENDING"] },
            },
          }),
        ]);

      return {
        threads: threads.map((t) => {
          const runState = isThreadRunningForUser({
            threadId: t.id,
            orgId,
            userId,
          });
          return {
            id: t.id,
            title: t.title,
            messageCount: t._count.messages,
            activeProposal: t.proposals[0] ?? null,
            isRunning: runState.running,
            runningStartedAt: runState.startedAt,
            updatedAt: t.updatedAt.toISOString(),
            createdAt: t.createdAt.toISOString(),
          };
        }),
        unmatchedTransferCount,
        pendingProposalCount,
      };
    }),

  /** Loads a thread with its messages and current proposal states (1 parallel batch). */
  getThread: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        threadId: z.string().min(1),
        locale: z.enum(["es", "en"]).default("es"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const thread = await db.assistantThread.findFirst({
        where: {
          id: input.threadId,
          organizationId: orgId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          activeAccountId: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "asc" },
            take: 100,
            select: {
              id: true,
              role: true,
              content: true,
              attachments: true,
              uiBlocks: true,
              tokenUsage: true,
              createdAt: true,
            },
          },
          proposals: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              accountId: true,
              title: true,
              appliedAt: true,
              appliedRecordIds: true,
              payload: true,
            },
          },
        },
      });

      if (!thread) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      }

      // Auto-sync any PENDING proposal whose account's live DB balance changed
      // (e.g. user manually added a missing $50 entry outside the assistant).
      const pendingWithAcc = thread.proposals.filter(
        (p) => p.status === "PENDING" && p.accountId != null,
      );
      const liveBalanceByAcc = new Map<number, number>();
      if (pendingWithAcc.length > 0) {
        const accIds = [
          ...new Set(pendingWithAcc.map((p) => p.accountId as number)),
        ];
        const sums = await db.record.groupBy({
          by: ["accountId"],
          where: {
            organizationId: orgId,
            accountId: { in: accIds },
            deletedAt: null,
          },
          _sum: { amount: true },
        });
        for (const s of sums) {
          liveBalanceByAcc.set(s.accountId, s._sum.amount ?? 0);
        }
      }

      const proposalStates: Record<
        string,
        {
          id: string;
          status: string;
          accountId: number | null;
          appliedAt: string | null;
          appliedCount: number;
          summary: ProposalPayload["summary"];
        }
      > = {};

      for (const prop of thread.proposals) {
        const pData = prop.payload as unknown as ProposalPayload;
        let summary = pData.summary ?? null;

        if (
          prop.status === "PENDING" &&
          prop.accountId != null &&
          summary &&
          pData.extracts?.length > 0
        ) {
          const liveBal = liveBalanceByAcc.get(prop.accountId) ?? 0;
          if (liveBal !== summary.currentDbBalanceMinor) {
            try {
              const refreshed = await reconcileProposalWithLiveDb({
                orgId,
                userId,
                proposalId: prop.id,
                locale: input.locale,
              });
              summary = refreshed.summary;
            } catch {
              // Fall back to saved summary if refresh fails
            }
          }
        }

        proposalStates[prop.id] = {
          id: prop.id,
          status: prop.status,
          accountId: prop.accountId,
          appliedAt: prop.appliedAt ? prop.appliedAt.toISOString() : null,
          appliedCount:
            pData.appliedMeta?.appliedCount ?? prop.appliedRecordIds.length,
          summary,
        };
      }

      const runState = isThreadRunningForUser({
        threadId: thread.id,
        orgId,
        userId,
      });

      return {
        id: thread.id,
        title: thread.title,
        activeAccountId: thread.activeAccountId,
        isRunning: runState.running,
        runningStartedAt: runState.startedAt,
        updatedAt: thread.updatedAt.toISOString(),
        messages: thread.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          attachments: (m.attachments as StoredAttachmentMeta[] | null) ?? [],
          uiBlocks: (m.uiBlocks as AssistantUiBlock[] | null) ?? [],
          tokenUsage: (m.tokenUsage as TokenUsageSummary | null) ?? null,
          createdAt: m.createdAt.toISOString(),
        })),
        proposalStates,
      };
    }),

  renameThread: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        threadId: z.string().min(1),
        title: z.string().trim().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      const res = await db.assistantThread.updateMany({
        where: {
          id: input.threadId,
          organizationId: orgId,
          userId,
          deletedAt: null,
        },
        data: { title: input.title },
      });
      if (res.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
      }
      return { ok: true };
    }),

  deleteThread: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ threadId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      await db.assistantThread.updateMany({
        where: {
          id: input.threadId,
          organizationId: orgId,
          userId,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
      return { ok: true };
    }),

  /**
   * Resolves an AWAITING_ACCOUNT proposal deterministically after the user clicks
   * an account in the interactive Account Picker (ZERO extra LLM tokens!).
   */
  selectProposalAccount: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        proposalId: z.string().min(1),
        accountId: z.number().int().positive(),
        locale: z.enum(["es", "en"]).default("es"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      try {
        return await resolveProposalAccountDeterministic({
          orgId,
          userId,
          proposalId: input.proposalId,
          accountId: input.accountId,
          locale: input.locale,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Failed to select account",
        });
      }
    }),

  /**
   * Loads full editable rows + org reference options for the separate Review Drawer
   * in ONE parallel batch. Automatically re-reconciles PENDING proposals when the
   * account's live DB balance changed (e.g. user manually added a missing entry).
   */
  getProposal: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        proposalId: z.string().min(1),
        locale: z.enum(["es", "en"]).default("es"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const [proposal, accounts, categories, payees, openTransfers] =
        await Promise.all([
          db.assistantProposal.findFirst({
            where: {
              id: input.proposalId,
              organizationId: orgId,
              userId,
            },
          }),
          db.bankAccount.findMany({
            where: { organizationId: orgId, deletedAt: null, archived: false },
            orderBy: [{ position: "asc" }, { id: "asc" }],
            select: {
              id: true,
              name: true,
              type: true,
              currency: true,
              color: true,
              accountNumber: true,
            },
          }),
          db.category.findMany({
            where: { organizationId: orgId, deletedAt: null, hidden: false },
            orderBy: [{ type: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameEs: true,
              icon: true,
              color: true,
              type: true,
              spendingNature: true,
              parentId: true,
            },
          }),
          db.payee.findMany({
            where: { organizationId: orgId, deletedAt: null },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          }),
          db.record.findMany({
            where: {
              organizationId: orgId,
              deletedAt: null,
              transfer: true,
              transferGroupId: null,
              transferAccountId: null,
            },
            orderBy: { recordDate: "desc" },
            take: 100,
            select: {
              id: true,
              accountId: true,
              amount: true,
              recordDate: true,
              note: true,
              account: {
                select: { name: true, color: true, type: true, currency: true },
              },
            },
          }),
        ]);

      if (!proposal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proposal not found",
        });
      }

      let payload = proposal.payload as unknown as ProposalPayload;

      // Auto-refresh live DB balance & duplicates if the account changed since proposal creation
      if (
        proposal.status === "PENDING" &&
        proposal.accountId &&
        payload.extracts?.length > 0 &&
        payload.summary
      ) {
        const liveAgg = await db.record.aggregate({
          where: {
            organizationId: orgId,
            accountId: proposal.accountId,
            deletedAt: null,
          },
          _sum: { amount: true },
        });
        const liveBalanceMinor = liveAgg._sum.amount ?? 0;
        if (liveBalanceMinor !== payload.summary.currentDbBalanceMinor) {
          const refreshed = await reconcileProposalWithLiveDb({
            orgId,
            userId,
            proposalId: proposal.id,
            locale: input.locale,
          });
          payload = {
            ...payload,
            summary: refreshed.summary,
            rows: refreshed.rows,
          };
        }
      }

      // Build exact running-balance ledger for this account across the statement window
      // (2 tiny indexed queries; works immediately for both new and already-saved proposals!)
      let runningBalanceLedger: RunningBalanceLedger | null = null;
      const finalRows = payload.rows ?? [];
      if (proposal.accountId && finalRows.length > 0) {
        const sortedRowDates = finalRows.map((r) => r.date).sort();
        const minRowDate = sortedRowDates[0]!;
        const maxRowDate = sortedRowDates[sortedRowDates.length - 1]!;
        const periodStartDate =
          payload.summary?.statementPeriodFrom &&
          payload.summary.statementPeriodFrom < minRowDate
            ? payload.summary.statementPeriodFrom
            : minRowDate;
        const periodEndDate = payload.summary?.statementPeriodTo ?? maxRowDate;

        const duplicateIds = finalRows
          .filter((r) => r.isDuplicate && r.duplicateRecordId != null)
          .map((r) => r.duplicateRecordId!);

        // If proposal was already applied (read-only view), exclude its own created rows
        // so the running balance preview doesn't double-count them.
        const excludedAppliedIds =
          proposal.status === "APPLIED"
            ? [
                ...(payload.appliedMeta?.createdRecordIds ?? []),
                ...(payload.appliedMeta?.adjustmentRecordId != null
                  ? [payload.appliedMeta.adjustmentRecordId]
                  : []),
              ]
            : [];

        const startDateObj = new Date(`${periodStartDate}T00:00:00.000Z`);
        const endDateObj = new Date(`${periodEndDate}T00:00:00.000Z`);
        const notAppliedFilter =
          excludedAppliedIds.length > 0
            ? { id: { notIn: excludedAppliedIds } }
            : {};

        const [periodRecordsRaw, beforeAgg] = await Promise.all([
          db.record.findMany({
            where: {
              organizationId: orgId,
              accountId: proposal.accountId,
              deletedAt: null,
              ...notAppliedFilter,
              AND: [
                {
                  OR: [{ recordDate: { lte: endDateObj } }, { recordDate: null }],
                },
                {
                  OR: [
                    { recordDate: { gte: startDateObj } },
                    ...(duplicateIds.length > 0
                      ? [{ id: { in: duplicateIds } }]
                      : []),
                  ],
                },
              ],
            },
            orderBy: [
              { recordDate: "asc" },
              { recordTime: "asc" },
              { id: "asc" },
            ],
            select: {
              id: true,
              amount: true,
              recordDate: true,
              recordTime: true,
              note: true,
              transfer: true,
              payee: { select: { name: true } },
            },
          }),
          db.record.aggregate({
            where: {
              organizationId: orgId,
              accountId: proposal.accountId,
              deletedAt: null,
              ...notAppliedFilter,
              ...(duplicateIds.length > 0
                ? { id: { notIn: [...excludedAppliedIds, ...duplicateIds] } }
                : {}),
              OR: [
                { recordDate: { lt: startDateObj } },
                { recordDate: null },
              ],
            },
            _sum: { amount: true },
          }),
        ]);

        const periodRecords: ExistingPeriodRecord[] = periodRecordsRaw.map(
          (r) => ({
            id: r.id,
            date: r.recordDate
              ? r.recordDate.toISOString().slice(0, 10)
              : periodStartDate,
            time: r.recordTime ? r.recordTime.toISOString().slice(11, 16) : null,
            amountMinor: r.amount,
            label: r.payee?.name || r.note || "—",
            transfer: r.transfer,
          }),
        );

        runningBalanceLedger = {
          openingDbBalanceMinor: beforeAgg._sum.amount ?? 0,
          periodStartDate,
          periodEndDate,
          periodRecords,
        };
      }

      return {
        id: proposal.id,
        threadId: proposal.threadId,
        status: proposal.status,
        accountId: proposal.accountId,
        title: proposal.title,
        appliedAt: proposal.appliedAt ? proposal.appliedAt.toISOString() : null,
        appliedMeta: payload.appliedMeta ?? null,
        summary: payload.summary,
        rows: finalRows,
        runningBalanceLedger,
        options: {
          accounts,
          categories,
          payees,
          openTransfers: openTransfers
            .filter((t) => t.accountId !== proposal.accountId)
            .map((t) => ({
              recordId: t.id,
              accountId: t.accountId,
              accountName: t.account.name,
              accountColor: t.account.color,
              accountType: t.account.type,
              currency: t.account.currency,
              amountMinor: t.amount,
              date: t.recordDate ? t.recordDate.toISOString().slice(0, 10) : "",
              note: t.note,
            })),
        },
      };
    }),

  /** Explicitly re-reconciles a pending proposal against the live DB (0 LLM tokens!). */
  reconcileProposal: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        proposalId: z.string().min(1),
        locale: z.enum(["es", "en"]).default("es"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      try {
        return await reconcileProposalWithLiveDb({
          orgId,
          userId,
          proposalId: input.proposalId,
          locale: input.locale,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            err instanceof Error ? err.message : "Failed to refresh proposal",
        });
      }
    }),

  /** Cancels an active detached server-side assistant run (explicit user Stop). */
  cancelRun: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ threadId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      const cancelled = cancelActiveRunForUser({
        threadId: input.threadId,
        orgId,
        userId,
      });
      return { cancelled };
    }),

  /** Saves user edits to a pending proposal draft without applying yet. */
  saveProposalDraft: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        proposalId: z.string().min(1),
        rows: z.array(reconciledRowInputSchema).max(600),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );

      const proposal = await db.assistantProposal.findFirst({
        where: {
          id: input.proposalId,
          organizationId: orgId,
          userId,
          status: "PENDING",
        },
      });
      if (!proposal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pending proposal not found",
        });
      }

      const payload = proposal.payload as unknown as ProposalPayload;
      const rows = input.rows as ReconciledRow[];
      const nextSummary = payload.summary
        ? recomputeReconciliationSummary(payload.summary, rows)
        : null;

      await db.assistantProposal.update({
        where: { id: proposal.id },
        data: {
          payload: {
            ...payload,
            rows,
            summary: nextSummary,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return { summary: nextSummary };
    }),

  /** Commits selected rows in ONE batch database transaction. */
  applyProposal: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        proposalId: z.string().min(1),
        rows: z.array(reconciledRowInputSchema).max(600),
        includeBalanceAdjustment: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      try {
        return await applyStatementProposalBatch({
          orgId,
          userId,
          proposalId: input.proposalId,
          rows: input.rows as ReconciledRow[],
          includeBalanceAdjustment: input.includeBalanceAdjustment,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            err instanceof Error ? err.message : "Failed to import transactions",
        });
      }
    }),

  /** Reverts an applied batch import cleanly (soft-deletes created rows & unlinks orphans). */
  undoProposal: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ proposalId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      try {
        return await undoStatementProposalBatch({
          orgId,
          userId,
          proposalId: input.proposalId,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Failed to undo batch",
        });
      }
    }),

  dismissProposal: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ proposalId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireOrgAndUser(
        ctx.orgId,
        ctx.session?.user.id,
      );
      await db.assistantProposal.updateMany({
        where: {
          id: input.proposalId,
          organizationId: orgId,
          userId,
          status: { in: ["AWAITING_ACCOUNT", "PENDING"] },
        },
        data: { status: "DISMISSED" },
      });
      return { ok: true };
    }),

  /** Quick list of open unmatched transfers across the Space. */
  unmatchedTransfers: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .query(async ({ ctx }) => {
      const { orgId } = requireOrgAndUser(ctx.orgId, ctx.session?.user.id);
      const rows = await db.record.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          transfer: true,
          transferGroupId: null,
          transferAccountId: null,
        },
        orderBy: [{ recordDate: "desc" }, { id: "desc" }],
        take: 30,
        select: {
          id: true,
          amount: true,
          recordDate: true,
          note: true,
          account: { select: { id: true, name: true, currency: true, color: true, type: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        amount: r.amount / MINOR_UNIT,
        currency: r.account.currency,
        date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
        note: r.note,
        account: r.account,
      }));
    }),
});
