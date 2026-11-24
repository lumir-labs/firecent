import z from "zod";

export const preparedAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().nonnegative().max(25 * 1024 * 1024),
  kind: z.enum(["image", "pdf_text", "pdf_images", "spreadsheet", "csv"]),
  /** Compact extracted text (for digital PDF, Excel, CSV). */
  textContent: z.string().max(220_000).optional(),
  /** Base64 data URLs (`data:image/jpeg;base64,...`) for images or scanned PDF pages. */
  images: z.array(z.string().max(4_000_000)).max(12).optional(),
  pageCount: z.number().int().positive().max(100).optional(),
  rowCount: z.number().int().nonnegative().max(5000).optional(),
});

export type PreparedAttachment = z.infer<typeof preparedAttachmentSchema>;

/** Compact attachment metadata stored on AssistantMessage (never stores raw image blobs). */
export type StoredAttachmentMeta = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: PreparedAttachment["kind"];
  pageCount?: number;
  rowCount?: number;
};

export const rawExtractedTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullish(),
  description: z.string().trim().min(1).max(300),
  payeeId: z.number().int().positive().nullish(),
  payeeName: z.string().trim().max(120).nullish(),
  /** Always positive major units (e.g. 42.50); direction determines sign. */
  amount: z.number().positive().max(20_000_000),
  /** OUT = outflow/charge/debit (negative in Firecent); IN = deposit/credit/payment received (positive). */
  direction: z.enum(["OUT", "IN"]),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]).default("EXPENSE"),
  categoryId: z.number().int().positive().nullish(),
  spendingNature: z.enum(["DEBO", "NECESITO", "QUIERO"]).nullish(),
  note: z.string().trim().max(300).nullish(),
  runningBalance: z.number().finite().nullish(),
});

export type RawExtractedTransaction = z.infer<typeof rawExtractedTransactionSchema>;

export const rawStatementExtractSchema = z.object({
  sourceFileName: z.string().trim().max(200).nullish(),
  institution: z.string().trim().max(120).nullish(),
  accountHint: z.string().trim().max(120).nullish(),
  last4: z.string().trim().max(16).nullish(),
  currency: z.string().trim().max(8).nullish(),
  accountTypeHint: z
    .enum([
      "CREDIT_CARD",
      "CHECKING_ACCOUNT",
      "SAVINGS_ACCOUNT",
      "CASH",
      "BANK",
      "GENERAL",
    ])
    .nullish(),
  periodFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  periodTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  openingBalance: z.number().finite().nullish(),
  closingBalance: z.number().finite().nullish(),
  /** Printed total charges/debits on statement summary (positive major units). */
  statementTotalCharges: z.number().nonnegative().nullish(),
  /** Printed total credits/payments on statement summary (positive major units). */
  statementTotalCredits: z.number().nonnegative().nullish(),
  /**
   * CREDIT_DEBT_POSITIVE: positive statement balances on credit cards represent debt owed (negated in Firecent).
   * SIGNED: balances already carry their mathematical sign.
   */
  balanceConvention: z
    .enum(["SIGNED", "CREDIT_DEBT_POSITIVE"])
    .default("SIGNED"),
  transactions: z.array(rawExtractedTransactionSchema).max(600),
});

export type RawStatementExtract = z.infer<typeof rawStatementExtractSchema>;

export type MatchedTransferInfo = {
  recordId: number;
  accountId: number;
  accountName: string;
  accountColor: string | null;
  accountType: string;
  currency: string;
  date: string;
  amountMinor: number;
  note: string | null;
  daysDiff: number;
};

export type ReconciledRow = {
  uid: string;
  selected: boolean;
  sourceStatementIndex: number;
  date: string;
  time: string | null;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  /** Signed minor units (cents): negative = outflow, positive = inflow */
  amountMinor: number;
  description: string;
  note: string | null;
  payeeId: number | null;
  payeeName: string | null;
  payeeMatchKind: "EXACT" | "FUZZY" | "HISTORY" | "NEW" | "NONE";
  categoryId: number | null;
  categoryName: string | null;
  categorySource: "PAYEE_HISTORY" | "AI" | "NONE";
  spendingNature: "DEBO" | "NECESITO" | "QUIERO" | null;
  paymentType: "CASH" | "CREDIT_CARD" | "WEB_PAYMENT";
  isDuplicate: boolean;
  duplicateRecordId: number | null;
  duplicateReason: string | null;
  transferMode: "UNMATCHED" | "LINK_EXISTING" | "CREATE_PAIR";
  matchedTransferRecordId: number | null;
  matchedTransferInfo: MatchedTransferInfo | null;
  transferAccountId: number | null;
};

export type StatementInternalAudit = {
  ok: boolean;
  extractedChargesMinor: number;
  extractedCreditsMinor: number;
  statementTotalChargesMinor: number | null;
  statementTotalCreditsMinor: number | null;
  /** statementTotalChargesMinor - extractedChargesMinor (positive = missing charges in extraction) */
  chargesDiffMinor: number | null;
  /** statementTotalCreditsMinor - extractedCreditsMinor (positive = missing credits/payments in extraction) */
  creditsDiffMinor: number | null;
  /** Difference between (opening + credits - charges) and closingBalance (in signed minor units) */
  equationDiffMinor: number | null;
};

export type ReconciliationSummary = {
  accountId: number;
  accountName: string;
  accountType: string;
  accountCurrency: string;
  accountColor: string | null;
  accountLast4: string | null;
  currentDbBalanceMinor: number;
  dbBalanceAtPeriodEndMinor: number;
  hasRecordsAfterPeriod: boolean;
  lastTrackedDate: string | null;
  anchorDescription: string | null;
  statementPeriodFrom: string | null;
  statementPeriodTo: string | null;
  statementOpeningBalanceMinor: number | null;
  statementClosingBalanceMinor: number | null;
  totalExtractedCount: number;
  newCount: number;
  selectedCount: number;
  duplicateCount: number;
  unmatchedTransferCount: number;
  transferMatchCount: number;
  selectedDeltaMinor: number;
  projectedBalanceMinor: number;
  projectedCurrentBalanceMinor: number;
  /** statementClosingBalanceMinor - projectedBalanceMinor (0 means exact match) */
  discrepancyMinor: number | null;
  status: "MATCHED" | "GAP_DETECTED" | "NO_CLOSING_BALANCE";
  statementsCount: number;
  sourceFiles: string[];
  internalAudit?: StatementInternalAudit | null;
};

export type AccountCandidate = {
  id: number;
  name: string;
  type: string;
  currency: string;
  color: string | null;
  last4: string | null;
  balance: number;
  score: number;
};

export type TransferMatchCardItem = {
  rowUid: string;
  rowDate: string;
  rowDescription: string;
  rowAmountMinor: number;
  existingRecordId: number;
  existingAccountId: number;
  existingAccountName: string;
  existingAccountColor: string | null;
  existingDate: string;
  existingAmountMinor: number;
  existingNote: string | null;
  daysDiff: number;
  currency: string;
};

export type AssistantUiBlock =
  | {
      type: "account_picker";
      proposalId: string;
      detectedHint?: string | null;
      detectedLast4?: string | null;
      detectedCurrency?: string | null;
      transactionCount: number;
      sourceFileName?: string | null;
      candidates: AccountCandidate[];
    }
  | {
      type: "statement_proposal";
      proposalId: string;
      summary: ReconciliationSummary;
    }
  | {
      type: "transfer_matches";
      proposalId: string;
      accountName: string;
      matches: TransferMatchCardItem[];
    }
  | {
      type: "data_table";
      title: string;
      subtitle?: string;
      columns: string[];
      rows: string[][];
      footer?: string;
      link?: { label: string; href: string };
    }
  | {
      type: "quick_actions";
      actions: Array<{
        id: string;
        label: string;
        kind: "upload_previous_statement" | "open_proposal" | "prompt";
        proposalId?: string;
        prompt?: string;
      }>;
    };

export type ProposalPayload = {
  extracts: RawStatementExtract[];
  rows: ReconciledRow[];
  summary: ReconciliationSummary | null;
  candidates?: AccountCandidate[];
  appliedMeta?: {
    createdRecordIds: number[];
    linkedExistingTransfers: Array<{
      existingRecordId: number;
      createdCounterpartId: number;
    }>;
    adjustmentRecordId: number | null;
    appliedCount: number;
  };
};

export type AssistantTraceStep = {
  id: string;
  kind: "context" | "thinking" | "tool" | "reconcile";
  toolName?: string;
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
  startedAt: number;
  durationMs?: number;
};

export type TokenUsageSummary = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  calls: number;
  steps?: AssistantTraceStep[];
};

/**
 * Pure helper shared between server and client so toggling rows or editing amounts
 * in the Review Drawer recomputes projected balance & discrepancy instantaneously.
 */
export function recomputeReconciliationSummary(
  base: ReconciliationSummary,
  rows: ReconciledRow[],
): ReconciliationSummary {
  let selectedCount = 0;
  let duplicateCount = 0;
  let newCount = 0;
  let selectedDeltaMinor = 0;
  let unmatchedTransferCount = 0;
  let transferMatchCount = 0;

  for (const r of rows) {
    if (r.isDuplicate) duplicateCount += 1;
    else newCount += 1;

    if (r.selected) {
      selectedCount += 1;
      selectedDeltaMinor += r.amountMinor;
      if (r.type === "TRANSFER") {
        if (r.transferMode === "LINK_EXISTING" && r.matchedTransferRecordId) {
          transferMatchCount += 1;
        } else if (r.transferMode === "UNMATCHED") {
          unmatchedTransferCount += 1;
        }
      }
    }
  }

  const projectedBalanceMinor = base.dbBalanceAtPeriodEndMinor + selectedDeltaMinor;
  const projectedCurrentBalanceMinor = base.currentDbBalanceMinor + selectedDeltaMinor;

  let discrepancyMinor: number | null = null;
  let status: ReconciliationSummary["status"] = "NO_CLOSING_BALANCE";
  if (base.statementClosingBalanceMinor != null) {
    discrepancyMinor = base.statementClosingBalanceMinor - projectedBalanceMinor;
    status = discrepancyMinor === 0 ? "MATCHED" : "GAP_DETECTED";
  }

  return {
    ...base,
    totalExtractedCount: rows.length,
    newCount,
    selectedCount,
    duplicateCount,
    unmatchedTransferCount,
    transferMatchCount,
    selectedDeltaMinor,
    projectedBalanceMinor,
    projectedCurrentBalanceMinor,
    discrepancyMinor,
    status,
  };
}
