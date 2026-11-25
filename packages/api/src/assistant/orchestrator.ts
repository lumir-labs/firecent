import { randomUUID } from "node:crypto";
import { db, type Prisma } from "@app/db";
import {
  streamKimiCompletion,
  type KimiContentPart,
  type KimiMessage,
  type KimiToolDefinition,
} from "./kimi";
import {
  auditStatementInternalMath,
  rankAccountCandidates,
  reconcileStatementsWithDb,
  type OrgAccountInfo,
} from "./reconciliation";
import {
  cancelActiveRunForUser,
  getActiveRunForUser,
  isThreadRunningForUser,
  pushRunEvent,
  registerActiveRun,
  scheduleRunCleanup,
  subscribeToRun,
  type ActiveAssistantRun,
  type AssistantStreamEvent,
} from "./run-manager";
import {
  rawStatementExtractSchema,
  recomputeReconciliationSummary,
  type AssistantTraceStep,
  type AssistantUiBlock,
  type PreparedAttachment,
  type ProposalPayload,
  type RawStatementExtract,
  type ReconciledRow,
  type ReconciliationSummary,
  type StoredAttachmentMeta,
  type TokenUsageSummary,
} from "./types";

export {
  cancelActiveRunForUser,
  getActiveRunForUser,
  isThreadRunningForUser,
  subscribeToRun,
  type ActiveAssistantRun,
  type AssistantStreamEvent,
};

const MINOR_UNIT = 100;

/**
 * Static system prompt kept IDENTICAL across requests so NVIDIA NIM / Kimi
 * maximizes prompt-cache hits (`prompt_tokens_details.cached_tokens`).
 */
const STATIC_SYSTEM_PROMPT = `You are Firecent's personal finance AI assistant.
Core rules:
- You NEVER directly modify balances or insert records without user approval. Every statement import goes through \`stage_statement_extraction\` which generates an interactive approval proposal.
- CRITICAL EFFICIENCY RULE: NEVER do mental arithmetic, add numbers, or verify totals in your reasoning! Do NOT sum charges or payments in your head — just transcribe every row cleanly and pass \`statementTotalCharges\` and \`statementTotalCredits\` (if printed in the statement summary) to \`stage_statement_extraction\`. The server's deterministic integer-cent engine verifies every sum in <1ms and will tell you immediately if a row was missed.
- Always respond in the user's language (Spanish if they write in Spanish or locale is "es", otherwise English). Keep replies concise, warm, clear, and scannable (2-5 short sentences max when a UI card already shows the structured details).
- NEVER dump long lists of transactions in plain text markdown when \`stage_statement_extraction\` has already produced a UI proposal card — the user opens the full interactive review drawer from the card!

Statement extraction rules (when user attaches PDF, Excel, CSV, or image of a bank/card statement):
1. Extract EVERY actual transaction row (charges, purchases, fees, interest, installment billings, payments, refunds). Skip internal accounting breakdown sub-lines (such as "-A Capital", "-A Intereses", "-A Comisiones" under a payment) and subtotal/summary lines.
2. For each transaction:
   - \`date\`: ISO \`YYYY-MM-DD\`. Infer year from statement header/period if row only shows DD/MM or DD MMM.
   - \`amount\`: ALWAYS a positive number in major units (e.g. 42.50). NEVER negative.
   - \`direction\`:
     * For checking/savings/debit/cash accounts: purchases/withdrawals/debits/outgoing transfers = "OUT"; deposits/salary/credits/incoming transfers = "IN".
     * For credit cards: purchases/charges/fees/interest = "OUT"; payments received ("PAGO", "PAGO RECIBIDO", "ABONO", "PAYMENT THANK YOU") and refunds = "IN".
   - \`type\`: "EXPENSE", "INCOME", or "TRANSFER". Mark card payments, bank-to-bank transfers, ACH/Transfer365/SPEI/SINPE, and internal movements as "TRANSFER".
   - \`payeeId\` & \`payeeName\`: Match each merchant against \`TopPayees\` in \`[SPACE_CONTEXT]\` FIRST and pass its exact \`payeeId\` when it refers to the same business (handling abbreviations and ignoring payment-gateway suffixes like N1CO/WOMPI, e.g. "UNO SAN MARCOS" -> Gasolinera UNO, "FCIA SAN NICOLAS"/"FASANI" -> Farmacia San Nicolás, "OD EL SALVADOR" -> Office Depot). If no existing payee matches, leave \`payeeId: null\` and provide a clean human-friendly \`payeeName\`. Leave both null for transfers.
   - \`description\`: exact/concise original statement description.
   - \`categoryId\`: choose the best active category ID from \`Categories\` (only for EXPENSE/INCOME; omit for TRANSFER). Use the matched payee's \`typicalCat\` hint from \`TopPayees\` to map to the right active category ID.
3. Header metadata:
   - Extract \`institution\`, \`accountHint\`, \`last4\` (last 4 digits if visible), \`currency\` (e.g. USD, MXN), \`accountTypeHint\`, \`periodFrom\`, \`periodTo\`, \`openingBalance\`, \`closingBalance\`, \`statementTotalCharges\`, \`statementTotalCredits\`.
   - Set \`balanceConvention\`:
     * "CREDIT_DEBT_POSITIVE" for credit card statements where a positive number like "$450.00" means debt owed (the most common format).
     * "SIGNED" for bank/checking/savings accounts or statements where debt is already negative.
4. Account selection:
   - Pass \`accountId\` ONLY if you are confident which org account matches (exact last 4 digits, unmistakable name, or user explicitly named it / active pending draft in this thread).
   - If uncertain or ambiguous, set \`accountId: null\` — the server will store your extraction and display an interactive Account Picker UI component without needing to re-read the file!
5. If \`stage_statement_extraction\` returns \`status: "EXTRACTION_MISMATCH"\`, re-check ONLY the specific section (charges or credits) mentioned in the server's diff to locate the missed/duplicated row in the document and call \`stage_statement_extraction\` once more with the corrected list.

General finance Q&A rules:
- Use \`get_financial_overview\`, \`query_transactions\`, or \`list_unmatched_transfers\` (each runs in batch and returns pre-computed totals/breakdowns so you never need mental math).
- If the user asks you to move real money or pay a bank bill, remind them Firecent records finances and does not move money at their bank.`;

const TOOLS: KimiToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "stage_statement_extraction",
      description:
        "Submit extracted transactions and metadata from an attached bank/card statement. Server deterministically matches payees, categories, duplicates, balances, and cross-account transfers (±5 days) and creates an interactive UI proposal.",
      parameters: {
        type: "object",
        properties: {
          accountId: {
            type: ["integer", "null"],
            description:
              "Matching org BankAccount ID if clearly identifiable; null if ambiguous so the UI asks the user.",
          },
          sourceFileName: { type: ["string", "null"] },
          institution: { type: ["string", "null"] },
          accountHint: { type: ["string", "null"] },
          last4: { type: ["string", "null"] },
          currency: { type: ["string", "null"] },
          accountTypeHint: {
            type: ["string", "null"],
            enum: [
              "CREDIT_CARD",
              "CHECKING_ACCOUNT",
              "SAVINGS_ACCOUNT",
              "CASH",
              "BANK",
              "GENERAL",
              null,
            ],
          },
          periodFrom: {
            type: ["string", "null"],
            description: "YYYY-MM-DD",
          },
          periodTo: {
            type: ["string", "null"],
            description: "YYYY-MM-DD",
          },
          openingBalance: { type: ["number", "null"] },
          closingBalance: { type: ["number", "null"] },
          statementTotalCharges: {
            type: ["number", "null"],
            description:
              "Total charges/debits printed in the statement summary (positive major units) so the server can audit extraction completeness.",
          },
          statementTotalCredits: {
            type: ["number", "null"],
            description:
              "Total payments/credits printed in the statement summary (positive major units) so the server can audit extraction completeness.",
          },
          balanceConvention: {
            type: "string",
            enum: ["SIGNED", "CREDIT_DEBT_POSITIVE"],
            description:
              "Use CREDIT_DEBT_POSITIVE on credit card statements where positive balance = amount owed.",
          },
          transactions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "YYYY-MM-DD" },
                time: { type: ["string", "null"], description: "HH:MM" },
                description: { type: "string" },
                payeeId: {
                  type: ["integer", "null"],
                  description:
                    "Matching ID from TopPayees in SPACE_CONTEXT if the merchant already exists.",
                },
                payeeName: { type: ["string", "null"] },
                amount: {
                  type: "number",
                  description: "Positive major units (e.g. 24.99)",
                },
                direction: {
                  type: "string",
                  enum: ["OUT", "IN"],
                },
                type: {
                  type: "string",
                  enum: ["EXPENSE", "INCOME", "TRANSFER"],
                },
                categoryId: { type: ["integer", "null"] },
                spendingNature: {
                  type: ["string", "null"],
                  enum: ["DEBO", "NECESITO", "QUIERO", null],
                },
                note: { type: ["string", "null"] },
                runningBalance: {
                  type: ["number", "null"],
                  description:
                    "Printed running balance ('Saldo') after this row if shown on the statement (major units).",
                },
              },
              required: ["date", "description", "amount", "direction", "type"],
            },
          },
        },
        required: ["transactions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_overview",
      description:
        "Fetch a compact batch snapshot of the Space's accounts, current month income/expenses by nature, top spending categories, budget summary, and count of unmatched transfers.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: ["string", "null"],
            description: "Optional YYYY-MM month (defaults to current month)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_transactions",
      description:
        "Search and aggregate transactions with optional filters (date range, accountId, categoryId, type, text search). Returns totals + up to 40 matching rows.",
      parameters: {
        type: "object",
        properties: {
          fromDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
          toDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
          accountId: { type: ["integer", "null"] },
          categoryId: { type: ["integer", "null"] },
          type: {
            type: ["string", "null"],
            enum: ["EXPENSE", "INCOME", "TRANSFER", null],
          },
          search: { type: ["string", "null"] },
          limit: { type: ["integer", "null"], description: "Max 40" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_unmatched_transfers",
      description:
        "List all open transfers across accounts that were imported without a counterpart yet (transferGroupId is null).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

export type StreamEvent =
  | { type: "thread"; threadId: string; title: string }
  | { type: "status"; phase: string; label: string }
  | { type: "trace_step"; step: AssistantTraceStep }
  | { type: "text_delta"; delta: string }
  | { type: "ui_block"; block: AssistantUiBlock }
  | {
      type: "done";
      threadId: string;
      messageId: string;
      uiBlocks: AssistantUiBlock[];
      tokenUsage: TokenUsageSummary;
    }
  | { type: "error"; message: string };

type OrgContextSnapshot = {
  accounts: OrgAccountInfo[];
  categories: Array<{
    id: number;
    name: string;
    type: string;
    nature: string | null;
  }>;
  topPayees: Array<{
    id: number;
    name: string;
    typicalCategory: string | null;
  }>;
  unmatchedTransferCount: number;
};

/** Loads compact org context in ONE parallel batch (accounts, categories, top 80 payees + category hints). */
async function loadOrgSnapshot(
  orgId: string,
  locale: "es" | "en",
): Promise<OrgContextSnapshot> {
  const [
    accountsRaw,
    balanceSums,
    allCategoriesRaw,
    payeesRaw,
    payeeCatGroups,
    unmatchedCount,
  ] = await Promise.all([
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
    db.record.groupBy({
      by: ["accountId"],
      where: { organizationId: orgId, deletedAt: null },
      _sum: { amount: true },
    }),
    db.category.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        nameEn: true,
        nameEs: true,
        type: true,
        spendingNature: true,
        hidden: true,
      },
    }),
    db.payee.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
    db.record.groupBy({
      by: ["payeeId", "categoryId"],
      where: {
        organizationId: orgId,
        deletedAt: null,
        transfer: false,
        payeeId: { not: null },
      },
      _count: { id: true },
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
  ]);

  const balMap = new Map<number, number>();
  for (const s of balanceSums) {
    balMap.set(s.accountId, (s._sum.amount ?? 0) / MINOR_UNIT);
  }

  const catNameById = new Map<number, string>();
  for (const c of allCategoriesRaw) {
    catNameById.set(
      c.id,
      locale === "es" ? c.nameEs || c.name : c.nameEn || c.name,
    );
  }

  // Rank payees by total usage and pick each payee's most frequent historical category label
  const payeeTotals = new Map<
    number,
    { total: number; topCatId: number | null; topCatCount: number }
  >();
  for (const g of payeeCatGroups) {
    if (!g.payeeId) continue;
    const count = g._count.id;
    const prev = payeeTotals.get(g.payeeId) ?? {
      total: 0,
      topCatId: null,
      topCatCount: 0,
    };
    prev.total += count;
    if (g.categoryId && count > prev.topCatCount) {
      prev.topCatId = g.categoryId;
      prev.topCatCount = count;
    }
    payeeTotals.set(g.payeeId, prev);
  }

  const topPayees = payeesRaw
    .map((p) => {
      const stats = payeeTotals.get(p.id);
      return {
        id: p.id,
        name: p.name,
        usage: stats?.total ?? 0,
        typicalCategory:
          stats?.topCatId != null ? (catNameById.get(stats.topCatId) ?? null) : null,
      };
    })
    .sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name))
    .slice(0, 80)
    .map(({ id, name, typicalCategory }) => ({ id, name, typicalCategory }));

  return {
    accounts: accountsRaw.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      color: a.color,
      last4: a.accountNumber,
      balance: balMap.get(a.id) ?? 0,
    })),
    categories: allCategoriesRaw
      .filter((c) => !c.hidden)
      .map((c) => ({
        id: c.id,
        name: locale === "es" ? c.nameEs || c.name : c.nameEn || c.name,
        type: c.type,
        nature: c.spendingNature,
      })),
    topPayees,
    unmatchedTransferCount: unmatchedCount,
  };
}

function formatMoneySimple(minor: number, currency: string): string {
  const sign = minor < 0 ? "-" : "";
  const abs = (Math.abs(minor) / MINOR_UNIT).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${currency === "USD" ? "$" : `${currency} `}${abs}`;
}

function buildCompactContextBlock(opts: {
  locale: "es" | "en";
  todayIso: string;
  snapshot: OrgContextSnapshot;
  pendingDraft?: {
    proposalId: string;
    accountId: number;
    accountName: string;
    periodFrom: string | null;
    periodTo: string | null;
    discrepancyMinor: number | null;
    currency: string;
    statementsCount: number;
  } | null;
}): string {
  const accLines = opts.snapshot.accounts.map(
    (a) =>
      `${a.id}|${a.name}|${a.type}|${a.currency}|last4:${a.last4 ?? "-"}|bal:${a.balance.toFixed(2)}`,
  );
  const catLines = opts.snapshot.categories.map(
    (c) => `${c.id}|${c.name}|${c.type}${c.nature ? `|${c.nature}` : ""}`,
  );
  const payeeLines = opts.snapshot.topPayees.map(
    (p) => `${p.id}|${p.name}${p.typicalCategory ? `|${p.typicalCategory}` : ""}`,
  );

  const lines = [
    `Locale: ${opts.locale} | Today: ${opts.todayIso} | OpenUnmatchedTransfers: ${opts.snapshot.unmatchedTransferCount}`,
    `Accounts (id|name|type|currency|last4|balance):`,
    accLines.length > 0 ? accLines.join("\n") : "(none)",
    `Categories (id|name|type|nature):`,
    catLines.length > 0 ? catLines.join("\n") : "(none)",
  ];

  if (payeeLines.length > 0) {
    lines.push(
      `TopPayees (id|name|typicalCat):`,
      payeeLines.join("; "),
    );
  }

  if (opts.pendingDraft) {
    const d = opts.pendingDraft;
    lines.push(
      `ActivePendingImportInThread: proposal=${d.proposalId} accountId=${d.accountId} (${d.accountName}) period=${d.periodFrom ?? "?"}..${d.periodTo ?? "?"} statements=${d.statementsCount} discrepancy=${d.discrepancyMinor != null ? formatMoneySimple(d.discrepancyMinor, d.currency) : "none"}. If user uploads another statement for this same account (e.g. an earlier period to close the gap), pass accountId=${d.accountId} and extract ONLY the newly uploaded file — the server will merge it automatically.`,
    );
  }

  return lines.join("\n");
}

function buildUserContentWithAttachments(
  userText: string,
  attachments: PreparedAttachment[],
): string | KimiContentPart[] {
  const hasImages = attachments.some(
    (a) => a.images && a.images.length > 0,
  );
  const textParts: string[] = [];
  if (userText.trim()) textParts.push(userText.trim());

  for (const att of attachments) {
    if (att.textContent) {
      textParts.push(
        `[Attached file: ${att.name} (${att.kind}${att.pageCount ? `, ${att.pageCount} pages` : ""}${att.rowCount ? `, ${att.rowCount} rows` : ""})]\n${att.textContent}`,
      );
    } else if (att.images && att.images.length > 0) {
      textParts.push(
        `[Attached visual file: ${att.name} (${att.kind}, ${att.images.length} image(s))]`,
      );
    }
  }

  const combinedText = textParts.join("\n\n");
  if (!hasImages) {
    return combinedText;
  }

  const parts: KimiContentPart[] = [{ type: "text", text: combinedText }];
  for (const att of attachments) {
    for (const imgUrl of att.images ?? []) {
      parts.push({ type: "image_url", image_url: { url: imgUrl } });
    }
  }
  return parts;
}

function deriveThreadTitle(
  message: string,
  attachments: PreparedAttachment[],
  locale: "es" | "en",
): string {
  if (attachments.length > 0) {
    const first = attachments[0]!.name.replace(/\.[^.]+$/, "");
    return first.slice(0, 60) || (locale === "es" ? "Estado de cuenta" : "Statement import");
  }
  const clean = message.trim().replace(/\s+/g, " ");
  if (clean.length <= 52) return clean || (locale === "es" ? "Nueva conversación" : "New chat");
  return `${clean.slice(0, 49)}…`;
}

/**
 * Generates a concise localized message when an account is picked via the
 * AccountPicker UI component (ZERO extra LLM calls!).
 */
export function buildDeterministicReconcileMessage(
  summary: ReconciliationSummary,
  locale: "es" | "en",
): string {
  const es = locale === "es";
  const c = summary.accountCurrency;
  const parts: string[] = [];

  if (summary.duplicateCount > 0 && summary.anchorDescription) {
    parts.push(
      es
        ? `Encontré dónde te habías quedado en **${summary.accountName}** (${summary.anchorDescription}): detecté **${summary.newCount} transacciones nuevas** y omití **${summary.duplicateCount} ya registradas**.`
        : `Found where you left off on **${summary.accountName}** (${summary.anchorDescription}): **${summary.newCount} new transactions** found and **${summary.duplicateCount} already recorded** skipped.`,
    );
  } else {
    parts.push(
      es
        ? `Listo el análisis para **${summary.accountName}**: detecté **${summary.newCount} transacciones nuevas**${summary.duplicateCount > 0 ? ` (${summary.duplicateCount} ya registradas)` : ""}.`
        : `Analyzed **${summary.accountName}**: found **${summary.newCount} new transactions**${summary.duplicateCount > 0 ? ` (${summary.duplicateCount} already recorded)` : ""}.`,
    );
  }

  if (summary.status === "MATCHED" && summary.statementClosingBalanceMinor != null) {
    parts.push(
      es
        ? `El balance final cuadra exacto en **${formatMoneySimple(summary.projectedBalanceMinor, c)}**.`
        : `The closing balance matches to the cent at **${formatMoneySimple(summary.projectedBalanceMinor, c)}**.`,
    );
  } else if (
    summary.status === "GAP_DETECTED" &&
    summary.discrepancyMinor != null &&
    summary.statementClosingBalanceMinor != null
  ) {
    parts.push(
      es
        ? `El balance proyectado (${formatMoneySimple(summary.projectedBalanceMinor, c)}) no cuadra con el cierre del estado de cuenta (${formatMoneySimple(summary.statementClosingBalanceMinor, c)}): hay una diferencia de **${formatMoneySimple(summary.discrepancyMinor, c)}**. Puede que falte un estado de cuenta anterior — puedes subirlo aquí mismo para unirlo, o abrir la revisión e importar así.`
        : `Projected balance (${formatMoneySimple(summary.projectedBalanceMinor, c)}) differs from statement closing balance (${formatMoneySimple(summary.statementClosingBalanceMinor, c)}) by **${formatMoneySimple(summary.discrepancyMinor, c)}**. An earlier statement may be missing — upload it right here to bridge the gap, or review and import as-is.`,
    );
  }

  if (summary.transferMatchCount > 0) {
    parts.push(
      es
        ? `Además encontré **${summary.transferMatchCount} transferencia(s)** que hacen match con movimientos pendientes de otras cuentas (≤5 días).`
        : `I also matched **${summary.transferMatchCount} transfer(s)** against pending transfers in your other accounts (≤5 days).`,
    );
  } else if (summary.unmatchedTransferCount > 0) {
    parts.push(
      es
        ? `Hay **${summary.unmatchedTransferCount} transferencia(s)** sin contraparte por ahora; quedarán abiertas para cuadrar automáticamente cuando subas el otro estado de cuenta.`
        : `There are **${summary.unmatchedTransferCount} transfer(s)** without a counterpart yet; they will stay open to auto-match when you upload the other statement.`,
    );
  }

  if (summary.internalAudit && !summary.internalAudit.ok) {
    const a = summary.internalAudit;
    const notes: string[] = [];
    if (a.chargesDiffMinor && a.chargesDiffMinor !== 0) {
      notes.push(
        es
          ? `cargos (${formatMoneySimple(a.chargesDiffMinor, c)})`
          : `charges (${formatMoneySimple(a.chargesDiffMinor, c)})`,
      );
    }
    if (a.creditsDiffMinor && a.creditsDiffMinor !== 0) {
      notes.push(
        es
          ? `abonos (${formatMoneySimple(a.creditsDiffMinor, c)})`
          : `credits (${formatMoneySimple(a.creditsDiffMinor, c)})`,
      );
    }
    if (notes.length > 0) {
      parts.push(
        es
          ? `Nota de auditoría interna del PDF: hay una diferencia de ${notes.join(" y ")} respecto al resumen del estado de cuenta — revisa las filas antes de importar.`
          : `Internal PDF audit note: there is a ${notes.join(" and ")} difference vs the statement summary — double-check the rows before importing.`,
      );
    }
  }

  return parts.join(" ");
}

/**
 * Resolves an AWAITING_ACCOUNT proposal deterministically after the user clicks
 * an account in the interactive Account Picker (ZERO extra LLM tokens!).
 */
export async function resolveProposalAccountDeterministic(opts: {
  orgId: string;
  userId: string;
  proposalId: string;
  accountId: number;
  locale?: "es" | "en";
}): Promise<{
  proposalId: string;
  messageId: string;
  summary: ReconciliationSummary;
  uiBlocks: AssistantUiBlock[];
  content: string;
}> {
  const locale = opts.locale ?? "es";
  const proposal = await db.assistantProposal.findFirst({
    where: {
      id: opts.proposalId,
      organizationId: opts.orgId,
      userId: opts.userId,
    },
  });

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  const payload = proposal.payload as unknown as ProposalPayload;
  if (!payload.extracts || payload.extracts.length === 0) {
    throw new Error("Proposal has no staged statement data");
  }

  // Check if there is an earlier PENDING proposal on the same thread + same account to merge!
  const existingPending = await db.assistantProposal.findFirst({
    where: {
      threadId: proposal.threadId,
      organizationId: opts.orgId,
      userId: opts.userId,
      accountId: opts.accountId,
      status: "PENDING",
      id: { not: proposal.id },
    },
    orderBy: { createdAt: "desc" },
  });

  const combinedExtracts: RawStatementExtract[] = [
    ...((existingPending?.payload as unknown as ProposalPayload | undefined)
      ?.extracts ?? []),
    ...payload.extracts,
  ];

  const reconciled = await reconcileStatementsWithDb({
    orgId: opts.orgId,
    accountId: opts.accountId,
    extracts: combinedExtracts,
    locale,
  });

  const uiBlocks: AssistantUiBlock[] = [
    {
      type: "statement_proposal",
      proposalId: proposal.id,
      summary: reconciled.summary,
    },
  ];

  if (reconciled.transferMatches.length > 0) {
    uiBlocks.push({
      type: "transfer_matches",
      proposalId: proposal.id,
      accountName: reconciled.summary.accountName,
      matches: reconciled.transferMatches,
    });
  }

  if (reconciled.summary.status === "GAP_DETECTED") {
    uiBlocks.push({
      type: "quick_actions",
      actions: [
        {
          id: `upload-prev-${proposal.id}`,
          label:
            locale === "es"
              ? "Subir estado de cuenta anterior"
              : "Upload earlier statement",
          kind: "upload_previous_statement",
          proposalId: proposal.id,
        },
        {
          id: `review-anyway-${proposal.id}`,
          label:
            locale === "es"
              ? `Revisar e importar así (${reconciled.summary.selectedCount})`
              : `Review & import as-is (${reconciled.summary.selectedCount})`,
          kind: "open_proposal",
          proposalId: proposal.id,
        },
      ],
    });
  }

  const content = buildDeterministicReconcileMessage(reconciled.summary, locale);

  const nextPayload: ProposalPayload = {
    extracts: combinedExtracts,
    rows: reconciled.rows,
    summary: reconciled.summary,
  };

  const assistantMsg = await db.$transaction(async (tx) => {
    if (existingPending) {
      await tx.assistantProposal.update({
        where: { id: existingPending.id },
        data: { status: "SUPERSEDED" },
      });
    }

    const msg = await tx.assistantMessage.create({
      data: {
        threadId: proposal.threadId,
        role: "ASSISTANT",
        content,
        uiBlocks: uiBlocks as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await tx.assistantProposal.update({
      where: { id: proposal.id },
      data: {
        status: "PENDING",
        accountId: opts.accountId,
        messageId: msg.id,
        title: `${reconciled.summary.accountName} (${reconciled.summary.newCount})`,
        payload: nextPayload as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.assistantThread.update({
      where: { id: proposal.threadId },
      data: { activeAccountId: opts.accountId, updatedAt: new Date() },
    });

    return msg;
  });

  return {
    proposalId: proposal.id,
    messageId: assistantMsg.id,
    summary: reconciled.summary,
    uiBlocks,
    content,
  };
}

/**
 * Re-reconciles an existing PENDING statement proposal against the LIVE database
 * (0 LLM tokens!). Updates account balance, re-detects duplicates (e.g. if the
 * user added a missing $50 transaction manually), re-checks cross-account ±5d
 * transfers, and preserves any manual category/payee/note/transfer edits.
 */
export async function reconcileProposalWithLiveDb(opts: {
  orgId: string;
  userId: string;
  proposalId: string;
  locale?: "es" | "en";
}): Promise<{
  proposalId: string;
  summary: ReconciliationSummary;
  rows: ReconciledRow[];
}> {
  const proposal = await db.assistantProposal.findFirst({
    where: {
      id: opts.proposalId,
      organizationId: opts.orgId,
      userId: opts.userId,
    },
  });

  if (!proposal) {
    throw new Error("Proposal not found");
  }
  if (proposal.status !== "PENDING" || !proposal.accountId) {
    throw new Error("Only pending proposals with an account can be refreshed");
  }

  const payload = proposal.payload as unknown as ProposalPayload;
  if (!payload.extracts || payload.extracts.length === 0) {
    throw new Error("Proposal has no staged statement data");
  }

  const fresh = await reconcileStatementsWithDb({
    orgId: opts.orgId,
    accountId: proposal.accountId,
    extracts: payload.extracts,
    locale: opts.locale ?? "es",
  });

  // Preserve manual edits from previously saved rows (matched 1-to-1 by date|amount|description)
  const prevRows = payload.rows ?? [];
  const consumedPrev = new Set<number>();

  const mergedRows: ReconciledRow[] = fresh.rows.map((freshRow) => {
    const prevIdx = prevRows.findIndex(
      (pr, i) =>
        !consumedPrev.has(i) &&
        pr.date === freshRow.date &&
        pr.amountMinor === freshRow.amountMinor &&
        pr.description === freshRow.description,
    );
    if (prevIdx === -1) return freshRow;

    consumedPrev.add(prevIdx);
    const prev = prevRows[prevIdx]!;

    // If a transaction just became a duplicate (user added it manually!), auto-unselect it.
    // Otherwise keep user's selection state.
    const becameDuplicate = !prev.isDuplicate && freshRow.isDuplicate;
    const selected = becameDuplicate ? false : prev.selected;

    // If a new cross-account transfer match appeared while prev was UNMATCHED, adopt it.
    const adoptNewTransferMatch =
      prev.transferMode === "UNMATCHED" &&
      freshRow.transferMode === "LINK_EXISTING" &&
      freshRow.matchedTransferRecordId != null;

    return {
      ...freshRow,
      uid: prev.uid,
      selected,
      type: prev.type,
      note: prev.note,
      payeeId: prev.payeeId,
      payeeName: prev.payeeName,
      payeeMatchKind: prev.payeeMatchKind,
      categoryId: prev.categoryId,
      categoryName: prev.categoryName,
      categorySource: prev.categorySource,
      spendingNature: prev.spendingNature,
      transferMode: adoptNewTransferMatch
        ? freshRow.transferMode
        : prev.transferMode,
      matchedTransferRecordId: adoptNewTransferMatch
        ? freshRow.matchedTransferRecordId
        : prev.matchedTransferRecordId,
      matchedTransferInfo: adoptNewTransferMatch
        ? freshRow.matchedTransferInfo
        : prev.matchedTransferInfo,
      transferAccountId: adoptNewTransferMatch
        ? null
        : prev.transferAccountId,
    };
  });

  const recomputedSummary = recomputeReconciliationSummary(
    fresh.summary,
    mergedRows,
  );

  const nextPayload: ProposalPayload = {
    ...payload,
    rows: mergedRows,
    summary: recomputedSummary,
  };

  await db.assistantProposal.update({
    where: { id: proposal.id },
    data: {
      title: `${recomputedSummary.accountName} (${recomputedSummary.newCount})`,
      payload: nextPayload as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    proposalId: proposal.id,
    summary: recomputedSummary,
    rows: mergedRows,
  };
}

/**
 * Starts an assistant turn DETACHED from the HTTP request lifecycle:
 * - Immediately creates/resolves the thread and persists the USER message so it
 *   is visible across all devices (phone -> desktop) right away.
 * - Runs Kimi + tools in the background on the server; closing the browser or
 *   locking the phone will NEVER abort the job.
 * - Any device can attach/resume via `GET /api/assistant/stream?threadId=...`.
 */
export async function startDetachedAssistantTurn(opts: {
  orgId: string;
  userId: string;
  threadId?: string | null;
  message: string;
  attachments?: PreparedAttachment[];
  locale?: "es" | "en";
}): Promise<{
  run: ActiveAssistantRun;
  threadId: string;
  threadTitle: string;
  isNewThread: boolean;
}> {
  const locale = opts.locale ?? "es";
  const attachments = opts.attachments ?? [];

  let threadId = opts.threadId ?? null;
  let threadTitle = deriveThreadTitle(opts.message, attachments, locale);
  let isNewThread = false;

  if (threadId) {
    const existing = await db.assistantThread.findFirst({
      where: {
        id: threadId,
        organizationId: opts.orgId,
        userId: opts.userId,
        deletedAt: null,
      },
      select: { id: true, title: true },
    });
    if (!existing) {
      threadId = null;
    } else {
      threadTitle = existing.title;
    }
  }

  if (!threadId) {
    const created = await db.assistantThread.create({
      data: {
        organizationId: opts.orgId,
        userId: opts.userId,
        title: threadTitle,
      },
      select: { id: true, title: true },
    });
    threadId = created.id;
    threadTitle = created.title;
    isNewThread = true;
  }

  const storedAttachments: StoredAttachmentMeta[] = attachments.map((a) => ({
    name: a.name,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    kind: a.kind,
    pageCount: a.pageCount,
    rowCount: a.rowCount,
  }));

  await db.assistantMessage.create({
    data: {
      threadId,
      role: "USER",
      content: opts.message.trim(),
      attachments:
        storedAttachments.length > 0
          ? (storedAttachments as unknown as Prisma.InputJsonValue)
          : undefined,
    },
  });

  await db.assistantThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  const run = registerActiveRun({
    runId: randomUUID(),
    threadId,
    orgId: opts.orgId,
    userId: opts.userId,
  });

  // Fire-and-forget detached server execution (only aborted by explicit cancelRun)
  void (async () => {
    try {
      await runAssistantTurn({
        orgId: opts.orgId,
        userId: opts.userId,
        threadId,
        message: opts.message,
        attachments,
        locale,
        signal: run.abortController.signal,
        skipUserMessagePersist: true,
        emit: (evt) => pushRunEvent(run, evt),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      const isAbort =
        !isTimeout &&
        (run.abortController.signal.aborted ||
          (err instanceof Error && err.name === "AbortError"));
      const msg = isTimeout
        ? locale === "es"
          ? "La consulta superó el tiempo máximo de 10 minutos. Intenta de nuevo."
          : "The request exceeded the 10-minute timeout. Please try again."
        : isAbort
          ? locale === "es"
            ? "Consulta detenida."
            : "Request stopped."
          : err instanceof Error
            ? err.message
            : "Assistant request failed";
      pushRunEvent(run, { type: "error", message: msg });
    } finally {
      scheduleRunCleanup(run);
    }
  })();

  return { run, threadId, threadTitle, isNewThread };
}

/**
 * Main streaming agent loop:
 * 1. Persists thread + user message (storing compact metadata, never multi-MB blobs).
 * 2. Loads compact org snapshot + recent thread history (capped to keep tokens tiny).
 * 3. Calls Kimi with native streaming + tool execution (max 3 tool rounds).
 * 4. Emits real-time SSE events (status, text deltas, interactive UI blocks).
 * 5. Persists final assistant message + token usage.
 */
export async function runAssistantTurn(opts: {
  orgId: string;
  userId: string;
  threadId?: string | null;
  message: string;
  attachments?: PreparedAttachment[];
  locale?: "es" | "en";
  signal?: AbortSignal;
  skipUserMessagePersist?: boolean;
  emit: (event: StreamEvent) => void;
}): Promise<void> {
  const locale = opts.locale ?? "es";
  const es = locale === "es";
  const attachments = opts.attachments ?? [];

  const traceSteps: AssistantTraceStep[] = [];
  const upsertStep = (step: AssistantTraceStep) => {
    const idx = traceSteps.findIndex((s) => s.id === step.id);
    if (idx >= 0) traceSteps[idx] = step;
    else traceSteps.push(step);
    opts.emit({ type: "trace_step", step });
  };

  const ctxStart = Date.now();
  upsertStep({
    id: "ctx",
    kind: "context",
    toolName: "load_space_context",
    label: es
      ? "Cargando cuentas y categorías del Space"
      : "Loading Space accounts & categories",
    status: "running",
    startedAt: ctxStart,
  });

  opts.emit({
    type: "status",
    phase: "preparing",
    label:
      attachments.length > 0
        ? es
          ? "Leyendo documento y contexto de cuentas…"
          : "Reading document and account context…"
        : es
          ? "Consultando contexto de tu Space…"
          : "Loading your Space context…",
  });

  // 1. Ensure thread exists (private to user + org)
  let threadId = opts.threadId ?? null;
  let threadTitle = deriveThreadTitle(opts.message, attachments, locale);

  if (threadId) {
    const existingThread = await db.assistantThread.findFirst({
      where: {
        id: threadId,
        organizationId: opts.orgId,
        userId: opts.userId,
        deletedAt: null,
      },
      select: { id: true, title: true },
    });
    if (!existingThread) {
      threadId = null;
    } else {
      threadTitle = existingThread.title;
    }
  }

  if (!threadId) {
    const created = await db.assistantThread.create({
      data: {
        organizationId: opts.orgId,
        userId: opts.userId,
        title: threadTitle,
      },
      select: { id: true, title: true },
    });
    threadId = created.id;
    threadTitle = created.title;
    opts.emit({ type: "thread", threadId, title: threadTitle });
  }

  // Persist user message (compact attachment metadata only) unless already persisted by startDetachedAssistantTurn
  if (!opts.skipUserMessagePersist) {
    const storedAttachments: StoredAttachmentMeta[] = attachments.map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      kind: a.kind,
      pageCount: a.pageCount,
      rowCount: a.rowCount,
    }));

    await db.assistantMessage.create({
      data: {
        threadId,
        role: "USER",
        content: opts.message.trim(),
        attachments:
          storedAttachments.length > 0
            ? (storedAttachments as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  // 2. Load org snapshot + recent thread messages + latest pending draft in ONE parallel batch
  const [snapshot, recentMsgs, latestPendingProposal] = await Promise.all([
    loadOrgSnapshot(opts.orgId, locale),
    db.assistantMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { role: true, content: true, attachments: true },
    }),
    db.assistantProposal.findFirst({
      where: {
        threadId,
        organizationId: opts.orgId,
        userId: opts.userId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, accountId: true, payload: true },
    }),
  ]);

  const pendingSummary = (
    latestPendingProposal?.payload as unknown as ProposalPayload | undefined
  )?.summary;

  upsertStep({
    id: "ctx",
    kind: "context",
    toolName: "load_space_context",
    label: es ? "Contexto del Space cargado" : "Space context loaded",
    detail: es
      ? `${snapshot.accounts.length} cuentas · ${snapshot.categories.length} categorías · ${snapshot.unmatchedTransferCount} transf. abiertas`
      : `${snapshot.accounts.length} accounts · ${snapshot.categories.length} categories · ${snapshot.unmatchedTransferCount} open transfers`,
    status: "done",
    startedAt: ctxStart,
    durationMs: Date.now() - ctxStart,
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const contextBlock = buildCompactContextBlock({
    locale,
    todayIso,
    snapshot,
    pendingDraft:
      latestPendingProposal &&
      latestPendingProposal.accountId &&
      pendingSummary
        ? {
            proposalId: latestPendingProposal.id,
            accountId: latestPendingProposal.accountId,
            accountName: pendingSummary.accountName,
            periodFrom: pendingSummary.statementPeriodFrom,
            periodTo: pendingSummary.statementPeriodTo,
            discrepancyMinor: pendingSummary.discrepancyMinor,
            currency: pendingSummary.accountCurrency,
            statementsCount: pendingSummary.statementsCount,
          }
        : null,
  });

  // Build chronological history (excluding the just-inserted current user msg so we attach files cleanly)
  const priorHistory = recentMsgs.slice(1).reverse();

  const messages: KimiMessage[] = [
    { role: "system", content: STATIC_SYSTEM_PROMPT },
    { role: "user", content: `[SPACE_CONTEXT]\n${contextBlock}` },
    {
      role: "assistant",
      content: "Understood. Ready to help using Firecent Space context.",
    },
  ];

  for (const m of priorHistory) {
    if (m.role === "USER") {
      const attMeta = m.attachments as StoredAttachmentMeta[] | null;
      const attNote =
        attMeta && attMeta.length > 0
          ? `[Previously attached: ${attMeta.map((a) => a.name).join(", ")}] `
          : "";
      messages.push({ role: "user", content: `${attNote}${m.content}`.trim() });
    } else {
      messages.push({ role: "assistant", content: m.content });
    }
  }

  messages.push({
    role: "user",
    content: buildUserContentWithAttachments(
      opts.message ||
        (attachments.length > 0
          ? es
            ? "Analiza este estado de cuenta y prepara las transacciones."
            : "Analyze this statement and prepare the transactions."
          : ""),
      attachments,
    ),
  });

  // 3. Agentic tool loop (at most 3 rounds; statement extraction is 1 extraction + 1 short summary)
  const uiBlocks: AssistantUiBlock[] = [];
  const createdProposalIds: string[] = [];
  const totalUsage: TokenUsageSummary = {
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    calls: 0,
  };

  let finalAssistantText = "";

  for (let round = 0; round < 3; round++) {
    const roundStart = Date.now();
    const thinkStepId = `kimi-${round}`;
    const thinkLabel =
      round === 0 && attachments.length > 0
        ? es
          ? "Kimi analizando el estado de cuenta"
          : "Kimi analyzing statement"
        : round === 0
          ? es
            ? "Kimi razonando consulta"
            : "Kimi reasoning"
          : es
            ? "Kimi redactando respuesta"
            : "Kimi composing answer";

    upsertStep({
      id: thinkStepId,
      kind: "thinking",
      label: thinkLabel,
      status: "running",
      startedAt: roundStart,
    });

    opts.emit({
      type: "status",
      phase: round === 0 ? "analyzing" : "summarizing",
      label: `${thinkLabel}…`,
    });

    let streamedThisRound = "";
    let fullReasoning = "";
    let lastReasoningEmit = 0;
    const primaryToolStepId = `tool-${round}-0`;
    let toolStreamStartedAt = 0;
    let activeStreamToolName: string | null = null;

    const toolLabelFor = (name: string) =>
      name === "stage_statement_extraction"
        ? es
          ? "Extrayendo movimientos del estado de cuenta"
          : "Extracting statement transactions"
        : name === "get_financial_overview"
          ? es
            ? "Consultando resumen financiero"
            : "Fetching financial overview"
          : name === "query_transactions"
            ? es
              ? "Buscando movimientos en tu DB"
              : "Searching your transactions"
            : name === "list_unmatched_transfers"
              ? es
                ? "Consultando transferencias sin contraparte"
                : "Checking unmatched transfers"
              : name;

    const cleanReasoning = (raw: string) => {
      const normalized = raw.trim();
      if (!normalized) return undefined;
      return normalized.length > 1800
        ? `${normalized.slice(0, 1800)}…`
        : normalized;
    };

    const result = await streamKimiCompletion({
      messages,
      tools: TOOLS,
      toolChoice: round < 2 ? "auto" : "none",
      reasoningEffort: "low",
      maxTokens: attachments.length > 0 && round === 0 ? 16384 : 2048,
      signal: opts.signal,
      callbacks: {
        onReasoningDelta: (delta) => {
          fullReasoning += delta;
          const now = Date.now();
          if (now - lastReasoningEmit >= 650) {
            lastReasoningEmit = now;
            upsertStep({
              id: thinkStepId,
              kind: "thinking",
              label: thinkLabel,
              detail: cleanReasoning(fullReasoning),
              status: "running",
              startedAt: roundStart,
            });
          }
        },
        onTextDelta: (delta) => {
          if (streamedThisRound.length === 0) {
            upsertStep({
              id: thinkStepId,
              kind: "thinking",
              label: thinkLabel,
              detail: cleanReasoning(fullReasoning),
              status: "done",
              startedAt: roundStart,
              durationMs: Date.now() - roundStart,
            });
          }
          streamedThisRound += delta;
          opts.emit({ type: "text_delta", delta });
        },
        onToolCallStarted: (name) => {
          activeStreamToolName = name;
          toolStreamStartedAt = Date.now();
          upsertStep({
            id: thinkStepId,
            kind: "thinking",
            label: thinkLabel,
            detail: cleanReasoning(fullReasoning),
            status: "done",
            startedAt: roundStart,
            durationMs: toolStreamStartedAt - roundStart,
          });
          const label = toolLabelFor(name);
          upsertStep({
            id: primaryToolStepId,
            kind: name === "stage_statement_extraction" ? "reconcile" : "tool",
            toolName: name,
            label,
            status: "running",
            startedAt: toolStreamStartedAt,
          });
          opts.emit({ type: "status", phase: `tool:${name}`, label: `${label}…` });
        },
        onToolCallProgress: ({ name, txCountEstimate, argChars }) => {
          const baseLabel = toolLabelFor(name);
          const detail =
            name === "stage_statement_extraction" && txCountEstimate > 0
              ? es
                ? `${txCountEstimate} transacciones detectadas…`
                : `${txCountEstimate} transactions detected…`
              : argChars > 10
                ? es
                  ? `${argChars} caracteres recibidos…`
                  : `${argChars} chars streamed…`
                : undefined;
          upsertStep({
            id: primaryToolStepId,
            kind: name === "stage_statement_extraction" ? "reconcile" : "tool",
            toolName: name,
            label: baseLabel,
            detail,
            status: "running",
            startedAt: toolStreamStartedAt || Date.now(),
          });
        },
      },
    });

    if (!activeStreamToolName) {
      upsertStep({
        id: thinkStepId,
        kind: "thinking",
        label: thinkLabel,
        detail: cleanReasoning(result.reasoningContent || fullReasoning),
        status: "done",
        startedAt: roundStart,
        durationMs: Date.now() - roundStart,
      });
    }

    totalUsage.promptTokens += result.usage.promptTokens;
    totalUsage.completionTokens += result.usage.completionTokens;
    totalUsage.cachedTokens += result.usage.cachedTokens;
    totalUsage.reasoningTokens += result.usage.reasoningTokens;
    totalUsage.totalTokens += result.usage.totalTokens;
    totalUsage.calls += 1;

    if (result.toolCalls.length === 0) {
      finalAssistantText = result.content.trim() || streamedThisRound.trim();
      break;
    }

    // Preserve assistant tool-call turn (including reasoning_content for thinking models)
    messages.push({
      role: "assistant",
      content: result.content || null,
      ...(result.reasoningContent
        ? { reasoning_content: result.reasoningContent }
        : {}),
      tool_calls: result.toolCalls,
    });

    // Execute all tool calls in this round (updating the SAME step per tool call!)
    for (let tcIdx = 0; tcIdx < result.toolCalls.length; tcIdx++) {
      const tc = result.toolCalls[tcIdx]!;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }

      const stepId = `tool-${round}-${tcIdx}`;
      const stepStart =
        tcIdx === 0 && toolStreamStartedAt > 0
          ? toolStreamStartedAt
          : Date.now();
      const isStmt = tc.function.name === "stage_statement_extraction";
      const execLabel = isStmt
        ? es
          ? "Extrayendo y conciliando estado de cuenta"
          : "Extracting & reconciling statement"
        : toolLabelFor(tc.function.name);

      upsertStep({
        id: stepId,
        kind: isStmt ? "reconcile" : "tool",
        toolName: tc.function.name,
        label: execLabel,
        detail: isStmt
          ? es
            ? "Conciliando comercios, duplicados, balance y transferencias (±5 días)…"
            : "Matching payees, duplicates, balance, and transfers (±5 days)…"
          : es
            ? "Consultando base de datos…"
            : "Querying database…",
        status: "running",
        startedAt: stepStart,
      });

      const toolOut = await executeAssistantTool({
        name: tc.function.name,
        args,
        round,
        orgId: opts.orgId,
        userId: opts.userId,
        threadId,
        locale,
        snapshot,
        attachments,
        uiBlocks,
        createdProposalIds,
        emit: opts.emit,
      });

      let execDetail: string | undefined;
      if (toolOut.error) {
        execDetail = String(toolOut.error);
      } else if (isStmt) {
        if (toolOut.status === "EXTRACTION_MISMATCH") {
          execDetail = es
            ? `Auditoría interna detectó diferencia (${toolOut.diffSummary}) · re-verificando PDF`
            : `Internal audit found diff (${toolOut.diffSummary}) · re-checking PDF`;
        } else if (toolOut.status === "AWAITING_ACCOUNT") {
          execDetail = es
            ? `${toolOut.extractedCount} movs extraídos · esperando selección de cuenta`
            : `${toolOut.extractedCount} txns extracted · awaiting account pick`;
        } else if (typeof toolOut.newTransactions === "number") {
          execDetail = es
            ? `${toolOut.newTransactions} nuevas · ${toolOut.duplicatesSkipped ?? 0} duplicadas · ${toolOut.status === "MATCHED" ? "Balance cuadra ✓" : toolOut.discrepancy ? `Dif. ${toolOut.discrepancy}` : "Lista"}`
            : `${toolOut.newTransactions} new · ${toolOut.duplicatesSkipped ?? 0} dupes · ${toolOut.status === "MATCHED" ? "Matched ✓" : toolOut.discrepancy ? `Diff ${toolOut.discrepancy}` : "Ready"}`;
        }
      } else if (typeof toolOut.count === "number") {
        execDetail = es
          ? `${toolOut.count} transferencias encontradas`
          : `${toolOut.count} transfers found`;
      } else if (typeof toolOut.totalCount === "number") {
        execDetail = es
          ? `${toolOut.totalCount} movimientos consultados`
          : `${toolOut.totalCount} transactions queried`;
      } else if (toolOut.month) {
        execDetail = es
          ? `Resumen de ${toolOut.month} cargado`
          : `Overview for ${toolOut.month} loaded`;
      }

      upsertStep({
        id: stepId,
        kind: isStmt ? "reconcile" : "tool",
        toolName: tc.function.name,
        label: execLabel,
        detail: execDetail,
        status: toolOut.error ? "error" : "done",
        startedAt: stepStart,
        durationMs: Date.now() - stepStart,
      });

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(toolOut),
      });
    }

    // Fast-path: if `stage_statement_extraction` or `list_unmatched_transfers`
    // succeeded and already emitted its structured UI block, skip a second LLM round!
    const stagedOk = result.toolCalls.some(
      (tc) => tc.function.name === "stage_statement_extraction",
    );
    const unmatchedOk =
      result.toolCalls.length === 1 &&
      result.toolCalls[0]?.function.name === "list_unmatched_transfers";

    if (
      (stagedOk &&
        uiBlocks.some(
          (b) =>
            b.type === "statement_proposal" || b.type === "account_picker",
        )) ||
      unmatchedOk
    ) {
      break;
    }
  }

  totalUsage.steps = traceSteps;

  // Fallback text if Kimi returned only tool calls with no trailing text
  if (!finalAssistantText) {
    const stmtBlock = uiBlocks.find((b) => b.type === "statement_proposal");
    const pickerBlock = uiBlocks.find((b) => b.type === "account_picker");
    const tableBlock = uiBlocks.find((b) => b.type === "data_table");
    if (stmtBlock && stmtBlock.type === "statement_proposal") {
      finalAssistantText = buildDeterministicReconcileMessage(
        stmtBlock.summary,
        locale,
      );
      opts.emit({ type: "text_delta", delta: finalAssistantText });
    } else if (pickerBlock && pickerBlock.type === "account_picker") {
      finalAssistantText = es
        ? `Extraje **${pickerBlock.transactionCount} movimientos** del documento, pero no pude determinar con certeza a qué cuenta pertenece. Elige la cuenta abajo para conciliar el balance al instante:`
        : `I extracted **${pickerBlock.transactionCount} transactions** from your file, but couldn't be sure which account it belongs to. Pick the account below to reconcile immediately:`;
      opts.emit({ type: "text_delta", delta: finalAssistantText });
    } else if (tableBlock && tableBlock.type === "data_table") {
      const shown = tableBlock.rows.length;
      const totalOpen = snapshot.unmatchedTransferCount;
      finalAssistantText = es
        ? `Tienes **${totalOpen} transferencias pendientes de contraparte**${totalOpen > shown ? ` (mostrando las ${shown} más recientes abajo)` : ""}. Cuando subas el estado de cuenta de la otra cuenta en cualquier chat, las emparejaré automáticamente si coinciden en monto con hasta 5 días de diferencia.`
        : `You have **${totalOpen} unmatched transfers awaiting a counterpart**${totalOpen > shown ? ` (showing the ${shown} most recent below)` : ""}. Whenever you upload the counterpart account's statement in any chat, I'll auto-match them by exact amount within ±5 days.`;
      opts.emit({ type: "text_delta", delta: finalAssistantText });
    } else if (snapshot.unmatchedTransferCount === 0 && traceSteps.some((s) => s.toolName === "list_unmatched_transfers")) {
      finalAssistantText = es
        ? "No tienes transferencias pendientes de cuadrar en este momento."
        : "You have no unmatched transfers waiting for a counterpart right now.";
      opts.emit({ type: "text_delta", delta: finalAssistantText });
    } else {
      finalAssistantText = es
        ? "No pude generar una respuesta completa en este intento. Intenta reformular o volver a enviar tu mensaje."
        : "I couldn't complete a full response on this try. Please rephrase or send your message again.";
      opts.emit({ type: "text_delta", delta: finalAssistantText });
    }
  }

  // 4. Persist final assistant message & link proposals
  const savedMsg = await db.$transaction(async (tx) => {
    const msg = await tx.assistantMessage.create({
      data: {
        threadId,
        role: "ASSISTANT",
        content: finalAssistantText,
        uiBlocks:
          uiBlocks.length > 0
            ? (uiBlocks as unknown as Prisma.InputJsonValue)
            : undefined,
        tokenUsage: totalUsage as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    if (createdProposalIds.length > 0) {
      await tx.assistantProposal.updateMany({
        where: { id: { in: createdProposalIds } },
        data: { messageId: msg.id },
      });
    }

    await tx.assistantThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    return msg;
  });

  opts.emit({
    type: "done",
    threadId,
    messageId: savedMsg.id,
    uiBlocks,
    tokenUsage: totalUsage,
  });
}

async function executeAssistantTool(ctx: {
  name: string;
  args: Record<string, unknown>;
  round: number;
  orgId: string;
  userId: string;
  threadId: string;
  locale: "es" | "en";
  snapshot: OrgContextSnapshot;
  attachments: PreparedAttachment[];
  uiBlocks: AssistantUiBlock[];
  createdProposalIds: string[];
  emit: (event: StreamEvent) => void;
}): Promise<Record<string, unknown>> {
  const es = ctx.locale === "es";

  if (ctx.name === "stage_statement_extraction") {
    const parsed = rawStatementExtractSchema.safeParse({
      ...ctx.args,
      sourceFileName:
        (typeof ctx.args.sourceFileName === "string" &&
          ctx.args.sourceFileName) ||
        ctx.attachments[0]?.name ||
        null,
    });

    if (!parsed.success) {
      return {
        error: "Invalid statement payload",
        details: parsed.error.issues.slice(0, 5),
      };
    }

    const extract: RawStatementExtract = parsed.data;
    const requestedAccountId =
      typeof ctx.args.accountId === "number" &&
      ctx.snapshot.accounts.some((a) => a.id === ctx.args.accountId)
        ? ctx.args.accountId
        : null;

    // Cross-check account ambiguity deterministically
    const ranked = rankAccountCandidates(extract, ctx.snapshot.accounts);
    const resolvedAccountId =
      requestedAccountId ?? (ranked.confident ? ranked.bestAccountId : null);

    // Server-side deterministic math audit on round 0: if printed statement totals
    // differ from the extracted rows (e.g. a missed $17.99 payment or duplicated line),
    // ask Kimi to fix ONLY the affected section before creating the UI proposal!
    const targetAcc = resolvedAccountId
      ? ctx.snapshot.accounts.find((a) => a.id === resolvedAccountId)
      : null;
    const accountTypeForAudit =
      targetAcc?.type ?? extract.accountTypeHint ?? "CHECKING_ACCOUNT";
    const currencyForAudit = targetAcc?.currency ?? extract.currency ?? "USD";
    const audit = auditStatementInternalMath(extract, accountTypeForAudit);

    if (
      ctx.round === 0 &&
      !audit.ok &&
      ((audit.chargesDiffMinor != null && audit.chargesDiffMinor !== 0) ||
        (audit.creditsDiffMinor != null && audit.creditsDiffMinor !== 0))
    ) {
      const diffs: string[] = [];
      if (audit.chargesDiffMinor && audit.chargesDiffMinor !== 0) {
        diffs.push(
          `charges diff ${formatMoneySimple(audit.chargesDiffMinor, currencyForAudit)} (extracted ${formatMoneySimple(audit.extractedChargesMinor, currencyForAudit)} vs statement ${formatMoneySimple(audit.statementTotalChargesMinor!, currencyForAudit)})`,
        );
      }
      if (audit.creditsDiffMinor && audit.creditsDiffMinor !== 0) {
        diffs.push(
          `credits/payments diff ${formatMoneySimple(audit.creditsDiffMinor, currencyForAudit)} (extracted ${formatMoneySimple(audit.extractedCreditsMinor, currencyForAudit)} vs statement ${formatMoneySimple(audit.statementTotalCreditsMinor!, currencyForAudit)})`,
        );
      }
      return {
        status: "EXTRACTION_MISMATCH",
        diffSummary: diffs.join("; "),
        extractedCount: extract.transactions.length,
        extractedCharges: +(audit.extractedChargesMinor / MINOR_UNIT).toFixed(2),
        statementTotalCharges:
          audit.statementTotalChargesMinor != null
            ? +(audit.statementTotalChargesMinor / MINOR_UNIT).toFixed(2)
            : null,
        chargesDiff:
          audit.chargesDiffMinor != null
            ? +(audit.chargesDiffMinor / MINOR_UNIT).toFixed(2)
            : null,
        extractedCredits: +(audit.extractedCreditsMinor / MINOR_UNIT).toFixed(2),
        statementTotalCredits:
          audit.statementTotalCreditsMinor != null
            ? +(audit.statementTotalCreditsMinor / MINOR_UNIT).toFixed(2)
            : null,
        creditsDiff:
          audit.creditsDiffMinor != null
            ? +(audit.creditsDiffMinor / MINOR_UNIT).toFixed(2)
            : null,
        instruction:
          "Server math audit caught a mismatch between your extracted rows and the printed statement summary totals. Check ONLY the section with non-zero diff (look for a missed row, a misread amount, or an accidental duplicate row), then call stage_statement_extraction once more with the corrected full list. Do NOT do manual arithmetic.",
      };
    }

    // Case A: Account is ambiguous -> stage extraction & show AccountPicker UI!
    if (!resolvedAccountId) {
      const stagedPayload: ProposalPayload = {
        extracts: [extract],
        rows: [],
        summary: null,
        candidates: ranked.candidates,
      };
      const proposal = await db.assistantProposal.create({
        data: {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          threadId: ctx.threadId,
          kind: "STATEMENT_IMPORT",
          status: "AWAITING_ACCOUNT",
          accountId: null,
          title:
            extract.sourceFileName ||
            (es ? "Estado de cuenta" : "Bank statement"),
          payload: stagedPayload as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      ctx.createdProposalIds.push(proposal.id);

      const pickerBlock: AssistantUiBlock = {
        type: "account_picker",
        proposalId: proposal.id,
        detectedHint: extract.accountHint || extract.institution || null,
        detectedLast4: extract.last4 || null,
        detectedCurrency: extract.currency || null,
        transactionCount: extract.transactions.length,
        sourceFileName: extract.sourceFileName || null,
        candidates: ranked.candidates,
      };
      ctx.uiBlocks.push(pickerBlock);
      ctx.emit({ type: "ui_block", block: pickerBlock });

      return {
        status: "AWAITING_ACCOUNT",
        proposalId: proposal.id,
        extractedCount: extract.transactions.length,
        note: "Extraction saved! An interactive Account Picker UI has been rendered. Briefly ask the user to click the matching account below (do NOT list transactions).",
      };
    }

    // Case B: Account is known -> check for an existing PENDING draft on the same thread+account to merge!
    const existingPending = await db.assistantProposal.findFirst({
      where: {
        threadId: ctx.threadId,
        organizationId: ctx.orgId,
        userId: ctx.userId,
        accountId: resolvedAccountId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    const prevExtracts =
      (existingPending?.payload as unknown as ProposalPayload | undefined)
        ?.extracts ?? [];
    const combinedExtracts = [...prevExtracts, extract];

    const reconciled = await reconcileStatementsWithDb({
      orgId: ctx.orgId,
      accountId: resolvedAccountId,
      extracts: combinedExtracts,
      locale: ctx.locale,
    });

    const payload: ProposalPayload = {
      extracts: combinedExtracts,
      rows: reconciled.rows,
      summary: reconciled.summary,
    };

    const proposal = await db.$transaction(async (tx) => {
      if (existingPending) {
        await tx.assistantProposal.update({
          where: { id: existingPending.id },
          data: { status: "SUPERSEDED" },
        });
      }
      const created = await tx.assistantProposal.create({
        data: {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          threadId: ctx.threadId,
          kind: "STATEMENT_IMPORT",
          status: "PENDING",
          accountId: resolvedAccountId,
          title: `${reconciled.summary.accountName} (${reconciled.summary.newCount})`,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await tx.assistantThread.update({
        where: { id: ctx.threadId },
        data: { activeAccountId: resolvedAccountId },
      });
      return created;
    });

    ctx.createdProposalIds.push(proposal.id);

    const stmtBlock: AssistantUiBlock = {
      type: "statement_proposal",
      proposalId: proposal.id,
      summary: reconciled.summary,
    };
    ctx.uiBlocks.push(stmtBlock);
    ctx.emit({ type: "ui_block", block: stmtBlock });

    if (reconciled.transferMatches.length > 0) {
      const matchBlock: AssistantUiBlock = {
        type: "transfer_matches",
        proposalId: proposal.id,
        accountName: reconciled.summary.accountName,
        matches: reconciled.transferMatches,
      };
      ctx.uiBlocks.push(matchBlock);
      ctx.emit({ type: "ui_block", block: matchBlock });
    }

    if (reconciled.summary.status === "GAP_DETECTED") {
      const actionsBlock: AssistantUiBlock = {
        type: "quick_actions",
        actions: [
          {
            id: `upload-prev-${proposal.id}`,
            label: es
              ? "Subir estado de cuenta anterior"
              : "Upload earlier statement",
            kind: "upload_previous_statement",
            proposalId: proposal.id,
          },
          {
            id: `review-anyway-${proposal.id}`,
            label: es
              ? `Revisar e importar así (${reconciled.summary.selectedCount})`
              : `Review & import as-is (${reconciled.summary.selectedCount})`,
            kind: "open_proposal",
            proposalId: proposal.id,
          },
        ],
      };
      ctx.uiBlocks.push(actionsBlock);
      ctx.emit({ type: "ui_block", block: actionsBlock });
    }

    const s = reconciled.summary;
    const c = s.accountCurrency;
    return {
      status: s.status,
      mergedWithPreviousDraft: Boolean(existingPending),
      statementsCount: s.statementsCount,
      accountName: s.accountName,
      totalExtracted: s.totalExtractedCount,
      newTransactions: s.newCount,
      duplicatesSkipped: s.duplicateCount,
      anchorFound: s.anchorDescription,
      currentDbBalance: formatMoneySimple(s.currentDbBalanceMinor, c),
      projectedBalance: formatMoneySimple(s.projectedBalanceMinor, c),
      statementClosingBalance:
        s.statementClosingBalanceMinor != null
          ? formatMoneySimple(s.statementClosingBalanceMinor, c)
          : null,
      discrepancy:
        s.discrepancyMinor != null
          ? formatMoneySimple(s.discrepancyMinor, c)
          : null,
      transferMatchesFound: reconciled.transferMatches.map((m) => ({
        amount: formatMoneySimple(m.rowAmountMinor, m.currency),
        rowDate: m.rowDate,
        matchedAccount: m.existingAccountName,
        matchedDate: m.existingDate,
        daysDiff: m.daysDiff,
      })),
      unmatchedTransfersCount: s.unmatchedTransferCount,
      instruction:
        "A rich UI summary card and separate review drawer button are already displayed to the user. Give a concise, friendly 2-4 sentence summary highlighting the reconciliation status, any found cutoff/anchor, balance match or gap, and transfer matches. Do NOT list all transactions in markdown.",
    };
  }

  if (ctx.name === "get_financial_overview") {
    const monthStr =
      typeof ctx.args.month === "string" && /^\d{4}-\d{2}$/.test(ctx.args.month)
        ? ctx.args.month
        : new Date().toISOString().slice(0, 7);
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(Date.UTC(y!, m! - 1, 1));
    const end = new Date(Date.UTC(y!, m!, 1));

    const [monthRecords, budget] = await Promise.all([
      db.record.findMany({
        where: {
          organizationId: ctx.orgId,
          deletedAt: null,
          transfer: false,
          excludeFromStats: false,
          recordDate: { gte: start, lt: end },
        },
        select: {
          type: true,
          amount: true,
          spendingNature: true,
          category: {
            select: { name: true, nameEs: true, nameEn: true, spendingNature: true },
          },
        },
      }),
      db.budget.findFirst({
        where: {
          organizationId: ctx.orgId,
          month: start,
          deletedAt: null,
        },
        include: { natures: true },
      }),
    ]);

    let incomeMinor = 0;
    let expenseMinor = 0;
    const byNature = { DEBO: 0, NECESITO: 0, QUIERO: 0 };
    const byCat = new Map<string, number>();

    for (const r of monthRecords) {
      if (r.type === "INCOME") {
        incomeMinor += r.amount;
      } else if (r.type === "EXPENSE") {
        const abs = Math.abs(r.amount);
        expenseMinor += abs;
        const nature = r.spendingNature ?? r.category?.spendingNature;
        if (nature && nature in byNature) {
          byNature[nature] += abs;
        }
        const catName =
          (es ? r.category?.nameEs : r.category?.nameEn) ||
          r.category?.name ||
          (es ? "Sin categoría" : "Uncategorized");
        byCat.set(catName, (byCat.get(catName) ?? 0) + abs);
      }
    }

    const topCategories = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, minor]) => ({ name, spent: +(minor / MINOR_UNIT).toFixed(2) }));

    return {
      month: monthStr,
      accounts: ctx.snapshot.accounts.map((a) => ({
        name: a.name,
        type: a.type,
        currency: a.currency,
        balance: +a.balance.toFixed(2),
      })),
      monthTotals: {
        income: +(incomeMinor / MINOR_UNIT).toFixed(2),
        expense: +(expenseMinor / MINOR_UNIT).toFixed(2),
        net: +((incomeMinor - expenseMinor) / MINOR_UNIT).toFixed(2),
        byNature: {
          DEBO: +(byNature.DEBO / MINOR_UNIT).toFixed(2),
          NECESITO: +(byNature.NECESITO / MINOR_UNIT).toFixed(2),
          QUIERO: +(byNature.QUIERO / MINOR_UNIT).toFixed(2),
        },
      },
      topCategories,
      budget: budget
        ? {
            expectedIncome: +(budget.expectedIncome / MINOR_UNIT).toFixed(2),
            natures: budget.natures.map((n) => ({
              nature: n.nature,
              planned: +(n.amount / MINOR_UNIT).toFixed(2),
            })),
          }
        : null,
      unmatchedTransferCount: ctx.snapshot.unmatchedTransferCount,
    };
  }

  if (ctx.name === "query_transactions") {
    const and: Prisma.RecordWhereInput[] = [
      { organizationId: ctx.orgId, deletedAt: null },
    ];
    if (typeof ctx.args.fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ctx.args.fromDate)) {
      and.push({ recordDate: { gte: new Date(`${ctx.args.fromDate}T00:00:00.000Z`) } });
    }
    if (typeof ctx.args.toDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ctx.args.toDate)) {
      and.push({ recordDate: { lte: new Date(`${ctx.args.toDate}T00:00:00.000Z`) } });
    }
    if (typeof ctx.args.accountId === "number") {
      and.push({ accountId: ctx.args.accountId });
    } else {
      and.push({
        NOT: {
          AND: [
            { transfer: true },
            { amount: { gt: 0 } },
            { transferGroupId: { not: null } },
          ],
        },
      });
    }
    if (typeof ctx.args.categoryId === "number") {
      and.push({ categoryId: ctx.args.categoryId });
    }
    if (
      ctx.args.type === "EXPENSE" ||
      ctx.args.type === "INCOME" ||
      ctx.args.type === "TRANSFER"
    ) {
      if (ctx.args.type === "TRANSFER") {
        and.push({ OR: [{ type: "TRANSFER" }, { transfer: true }] });
      } else {
        and.push({ type: ctx.args.type, transfer: false });
      }
    }
    if (typeof ctx.args.search === "string" && ctx.args.search.trim()) {
      const q = ctx.args.search.trim();
      and.push({
        OR: [
          { note: { contains: q, mode: "insensitive" } },
          { payee: { name: { contains: q, mode: "insensitive" } } },
          { category: { name: { contains: q, mode: "insensitive" } } },
          { category: { nameEs: { contains: q, mode: "insensitive" } } },
          { category: { nameEn: { contains: q, mode: "insensitive" } } },
        ],
      });
    }

    const limit = Math.min(
      40,
      Math.max(1, typeof ctx.args.limit === "number" ? ctx.args.limit : 25),
    );
    const where: Prisma.RecordWhereInput = { AND: and };

    const [rows, agg, allMatchingForBreakdown] = await Promise.all([
      db.record.findMany({
        where,
        orderBy: [{ recordDate: "desc" }, { id: "desc" }],
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          note: true,
          recordDate: true,
          payee: { select: { name: true } },
          category: { select: { name: true, nameEs: true, nameEn: true } },
          account: { select: { name: true, currency: true } },
        },
      }),
      db.record.aggregate({
        where,
        _count: { id: true },
        _sum: { amount: true },
      }),
      db.record.findMany({
        where,
        take: 1500,
        select: {
          type: true,
          transfer: true,
          amount: true,
          payee: { select: { name: true } },
          category: { select: { name: true, nameEs: true, nameEn: true } },
        },
      }),
    ]);

    let incomeMinor = 0;
    let expenseMinor = 0;
    const byCat = new Map<string, number>();
    const byPayee = new Map<string, number>();
    for (const r of allMatchingForBreakdown) {
      if (r.transfer || r.type === "TRANSFER") continue;
      if (r.type === "INCOME") {
        incomeMinor += r.amount;
      } else if (r.type === "EXPENSE") {
        const abs = Math.abs(r.amount);
        expenseMinor += abs;
        const cName =
          (es ? r.category?.nameEs : r.category?.nameEn) ||
          r.category?.name ||
          (es ? "Sin categoría" : "Uncategorized");
        byCat.set(cName, (byCat.get(cName) ?? 0) + abs);
        if (r.payee?.name) {
          byPayee.set(r.payee.name, (byPayee.get(r.payee.name) ?? 0) + abs);
        }
      }
    }

    return {
      totalCount: agg._count.id,
      netSum: +((agg._sum.amount ?? 0) / MINOR_UNIT).toFixed(2),
      incomeTotal: +(incomeMinor / MINOR_UNIT).toFixed(2),
      expenseTotal: +(expenseMinor / MINOR_UNIT).toFixed(2),
      byCategory: [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([category, total]) => ({
          category,
          total: +(total / MINOR_UNIT).toFixed(2),
        })),
      byPayee: [...byPayee.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([payee, total]) => ({
          payee,
          total: +(total / MINOR_UNIT).toFixed(2),
        })),
      items: rows.map((r) => ({
        date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
        type: r.type,
        amount: +(r.amount / MINOR_UNIT).toFixed(2),
        currency: r.account.currency,
        account: r.account.name,
        payee: r.payee?.name ?? null,
        category:
          (es ? r.category?.nameEs : r.category?.nameEn) ||
          r.category?.name ||
          null,
        note: r.note,
      })),
    };
  }

  if (ctx.name === "list_unmatched_transfers") {
    const rows = await db.record.findMany({
      where: {
        organizationId: ctx.orgId,
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
        account: { select: { name: true, currency: true } },
      },
    });

    if (rows.length > 0) {
      const tableBlock: AssistantUiBlock = {
        type: "data_table",
        title: es
          ? "Transferencias pendientes de contraparte"
          : "Unmatched transfers awaiting counterpart",
        columns: es
          ? ["Fecha", "Cuenta", "Detalle", "Monto"]
          : ["Date", "Account", "Note", "Amount"],
        rows: rows.map((r) => [
          r.recordDate ? r.recordDate.toISOString().slice(0, 10) : "—",
          r.account.name,
          r.note || "—",
          formatMoneySimple(r.amount, r.account.currency),
        ]),
        link: {
          label: es ? "Ver transferencias" : "View transfers",
          href: "/transactions?type=TRANSFER",
        },
      };
      ctx.uiBlocks.push(tableBlock);
      ctx.emit({ type: "ui_block", block: tableBlock });
    }

    return {
      count: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
        account: r.account.name,
        amount: +(r.amount / MINOR_UNIT).toFixed(2),
        currency: r.account.currency,
        note: r.note,
      })),
    };
  }

  return { error: `Unknown tool: ${ctx.name}` };
}
