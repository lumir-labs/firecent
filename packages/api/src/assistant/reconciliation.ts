import { randomUUID } from "node:crypto";
import { db, type Prisma } from "@app/db";
import {
  recomputeReconciliationSummary,
  type AccountCandidate,
  type MatchedTransferInfo,
  type ProposalPayload,
  type RawExtractedTransaction,
  type RawStatementExtract,
  type ReconciledRow,
  type ReconciliationSummary,
  type StatementInternalAudit,
  type TransferMatchCardItem,
} from "./types";

const MINOR_UNIT = 100;
const MS_PER_DAY = 86_400_000;
export const TRANSFER_MATCH_MAX_DAYS = 5;

const MERCHANT_NOISE_RE =
  /\b(compra|pos|pos\/|tarj|tarjeta|debito|credito|pago|consumo|retiro|transf|transferencia|ach|spei|sinpe|abono|cargo|web|online|sv|slv|sal|san salvador|santa tecla|antiguo cuscatlan|antiguo cusca|cuscatlan|merliot|la libertad|san marcos|marsella|chiltiupan|multiplaza|el salvador|gtm|guatemala|usa|us|mx|mex|suc|sucursal|tienda|store|sa de cv|sa de c|s\.a\.|envios|comid|no\.?|num\.?)\b/gi;

/** Payment processors / gateways that often ride along inside another merchant's POS descriptor (e.g. "FASANI CHILTIUPAN N1CO"). */
const PAYMENT_PROCESSOR_TOKENS = new Set([
  "n1co",
  "wompi",
  "paypal",
  "stripe",
  "dlocal",
  "serfinsa",
  "credomatic",
  "square",
  "mercadopago",
  "niubiz",
]);

const TRANSFER_KEYWORD_RE =
  /\b(transfer|transf|traspaso|pago\s*(de\s*)?tarj|pago\s*tc|abono\s*(a\s*)?tarj|abono\s*en\s*cuenta|ach|spei|sinpe|transfer365|transfer\s*365|uni\s*transf|card\s*payment|payment\s*thank\s*you|autopay|credit\s*card\s*pay|envio\s*entre\s*cuentas)\b/i;

/** Normalizes a bank merchant/description string for deterministic fuzzy matching. */
export function normalizeMerchant(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[#*_\-/\\.,:;()'"`]+/g, " ")
    .replace(/\bfcia\.?\b/g, "farmacia")
    .replace(/\bferret\.?\b/g, "ferreteria")
    .replace(MERCHANT_NOISE_RE, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic internal math audit for a single extracted statement.
 * Replaces slow & error-prone LLM mental arithmetic (runs in <1ms).
 */
export function auditStatementInternalMath(
  extract: RawStatementExtract,
  accountType: string,
): StatementInternalAudit {
  let extractedChargesMinor = 0;
  let extractedCreditsMinor = 0;
  for (const tx of extract.transactions) {
    const absMinor = Math.round(Math.abs(tx.amount) * MINOR_UNIT);
    if (tx.direction === "OUT") extractedChargesMinor += absMinor;
    else extractedCreditsMinor += absMinor;
  }

  const statementTotalChargesMinor =
    extract.statementTotalCharges != null
      ? Math.round(Math.abs(extract.statementTotalCharges) * MINOR_UNIT)
      : null;
  const statementTotalCreditsMinor =
    extract.statementTotalCredits != null
      ? Math.round(Math.abs(extract.statementTotalCredits) * MINOR_UNIT)
      : null;

  const chargesDiffMinor =
    statementTotalChargesMinor != null
      ? statementTotalChargesMinor - extractedChargesMinor
      : null;
  const creditsDiffMinor =
    statementTotalCreditsMinor != null
      ? statementTotalCreditsMinor - extractedCreditsMinor
      : null;

  let equationDiffMinor: number | null = null;
  if (extract.openingBalance != null && extract.closingBalance != null) {
    const openSigned = toFirecentSignedBalanceMinor(
      extract.openingBalance,
      accountType,
      extract.balanceConvention,
    );
    const closeSigned = toFirecentSignedBalanceMinor(
      extract.closingBalance,
      accountType,
      extract.balanceConvention,
    );
    const expectedClose =
      openSigned + extractedCreditsMinor - extractedChargesMinor;
    equationDiffMinor = closeSigned - expectedClose;
  }

  const chargesMismatch = chargesDiffMinor != null && Math.abs(chargesDiffMinor) > 0;
  const creditsMismatch = creditsDiffMinor != null && Math.abs(creditsDiffMinor) > 0;
  const eqMismatch =
    chargesDiffMinor == null &&
    creditsDiffMinor == null &&
    equationDiffMinor != null &&
    Math.abs(equationDiffMinor) > 0;

  return {
    ok: !chargesMismatch && !creditsMismatch && !eqMismatch,
    extractedChargesMinor,
    extractedCreditsMinor,
    statementTotalChargesMinor,
    statementTotalCreditsMinor,
    chargesDiffMinor,
    creditsDiffMinor,
    equationDiffMinor,
  };
}

/** Fast Dice bigram similarity (0..1) for merchant matching. */
export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg) ?? 0;
    if (count > 0) {
      bigramsA.set(bg, count - 1);
      intersection += 1;
    }
  }
  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

/** Exact UTC calendar day difference (`|a - b|`). */
export function daysBetweenIso(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00.000Z`);
  const tb = Date.parse(`${b}T00:00:00.000Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 9999;
  return Math.round(Math.abs(ta - tb) / MS_PER_DAY);
}

export function addDaysIso(iso: string, deltaDays: number): string {
  const t = Date.parse(`${iso}T00:00:00.000Z`);
  return new Date(t + deltaDays * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Converts a statement balance (major units) to Firecent's signed integer cents.
 * In Firecent, credit card debt is NEGATIVE (`-45000` means `$450.00` owed).
 */
export function toFirecentSignedBalanceMinor(
  majorBalance: number,
  accountType: string,
  convention: "SIGNED" | "CREDIT_DEBT_POSITIVE" = "SIGNED",
): number {
  const minor = Math.round(majorBalance * MINOR_UNIT);
  if (accountType === "CREDIT_CARD" && convention === "CREDIT_DEBT_POSITIVE") {
    return -minor;
  }
  return minor;
}

export function rawTxToSignedMinor(tx: RawExtractedTransaction): number {
  const absMinor = Math.round(Math.abs(tx.amount) * MINOR_UNIT);
  return tx.direction === "OUT" ? -absMinor : absMinor;
}

export type OrgAccountInfo = {
  id: number;
  name: string;
  type: string;
  currency: string;
  color: string | null;
  last4: string | null;
  balance: number; // major units
};

/**
 * Deterministically ranks org accounts against an extracted statement header.
 * Returns `confident: false` when ambiguous so the UI renders an Account Picker.
 */
export function rankAccountCandidates(
  extract: RawStatementExtract,
  accounts: OrgAccountInfo[],
): {
  bestAccountId: number | null;
  confident: boolean;
  candidates: AccountCandidate[];
} {
  if (accounts.length === 0) {
    return { bestAccountId: null, confident: false, candidates: [] };
  }

  const rawLast4 = extract.last4?.replace(/\D/g, "").slice(-4) || null;
  const hintTokens = normalizeMerchant(
    [extract.institution, extract.accountHint].filter(Boolean).join(" "),
  )
    .split(" ")
    .filter((t) => t.length >= 2);
  const currency = extract.currency?.trim().toUpperCase() || null;

  const scored: AccountCandidate[] = accounts.map((acc) => {
    let score = 0;
    const accLast4 = acc.last4?.replace(/\D/g, "").slice(-4) || null;

    if (rawLast4 && accLast4 && rawLast4 === accLast4) {
      score += 100;
    } else if (rawLast4 && accLast4 && rawLast4 !== accLast4) {
      score -= 30;
    }

    if (currency) {
      if (acc.currency.toUpperCase() === currency) score += 15;
      else score -= 45;
    }

    if (extract.accountTypeHint) {
      if (acc.type === extract.accountTypeHint) score += 20;
      else if (
        extract.accountTypeHint === "CREDIT_CARD" &&
        acc.type !== "CREDIT_CARD"
      ) {
        score -= 25;
      } else if (
        extract.accountTypeHint !== "CREDIT_CARD" &&
        acc.type === "CREDIT_CARD"
      ) {
        score -= 25;
      }
    }

    if (hintTokens.length > 0) {
      const accNorm = normalizeMerchant(acc.name);
      const accTokens = accNorm.split(" ").filter((t) => t.length >= 2);
      let matchedTokens = 0;
      for (const ht of hintTokens) {
        if (accTokens.some((at) => at === ht || at.includes(ht) || ht.includes(at))) {
          matchedTokens += 1;
        }
      }
      if (matchedTokens > 0) {
        score += Math.min(50, matchedTokens * 22);
      }
      const sim = diceSimilarity(hintTokens.join(" "), accNorm);
      if (sim >= 0.45) score += Math.round(sim * 30);
    }

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      color: acc.color,
      last4: acc.last4,
      balance: acc.balance,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.id - b.id);

  const top = scored[0]!;
  const second = scored[1];

  // Single account in org (and currency doesn't actively contradict)
  if (scored.length === 1 && top.score >= 0) {
    return { bestAccountId: top.id, confident: true, candidates: scored };
  }

  // Unique exact last4 match
  const exactLast4Matches = rawLast4
    ? scored.filter(
        (c) => (c.last4?.replace(/\D/g, "").slice(-4) || null) === rawLast4,
      )
    : [];
  if (exactLast4Matches.length === 1) {
    return {
      bestAccountId: exactLast4Matches[0]!.id,
      confident: true,
      candidates: scored,
    };
  }

  // Strong score and clear margin over second place
  const margin = second ? top.score - second.score : top.score;
  const confident = top.score >= 55 && margin >= 25;

  return {
    bestAccountId: confident ? top.id : null,
    confident,
    candidates: scored,
  };
}

/**
 * Merges multiple uploaded statements (e.g. when user uploads an earlier statement
 * to bridge a balance gap) and deduplicates identical overlapping boundary rows.
 */
export function mergeAndDedupStatements(extracts: RawStatementExtract[]): {
  orderedExtracts: RawStatementExtract[];
  mergedRows: Array<{ tx: RawExtractedTransaction; sourceStatementIndex: number }>;
  periodFrom: string | null;
  periodTo: string | null;
  openingBalance: number | null;
  openingConvention: "SIGNED" | "CREDIT_DEBT_POSITIVE";
  closingBalance: number | null;
  closingConvention: "SIGNED" | "CREDIT_DEBT_POSITIVE";
  sourceFiles: string[];
} {
  const dated = extracts.map((ext, origIdx) => {
    const txDates = ext.transactions.map((t) => t.date).sort();
    const minDate = ext.periodFrom ?? txDates[0] ?? "9999-12-31";
    const maxDate = ext.periodTo ?? txDates[txDates.length - 1] ?? "0000-01-01";
    return { ext, origIdx, minDate, maxDate };
  });

  // Earliest statement first
  dated.sort((a, b) => a.minDate.localeCompare(b.minDate) || a.maxDate.localeCompare(b.maxDate));

  const orderedExtracts = dated.map((d) => d.ext);
  const mergedRows: Array<{
    tx: RawExtractedTransaction;
    sourceStatementIndex: number;
  }> = [];

  // Per-statement cross-dedup: keep duplicates WITHIN the same statement (e.g. 2 identical coffees),
  // but remove identical overlaps BETWEEN two different statements.
  const committedByStatement = new Map<string, number>();

  for (let sIdx = 0; sIdx < orderedExtracts.length; sIdx++) {
    const ext = orderedExtracts[sIdx]!;
    const localCounts = new Map<string, number>();
    for (const tx of ext.transactions) {
      const signed = rawTxToSignedMinor(tx);
      const normDesc = normalizeMerchant(tx.payeeName || tx.description).slice(0, 40);
      const key = `${tx.date}|${signed}|${normDesc}`;
      const seenSoFar = (localCounts.get(key) ?? 0) + 1;
      localCounts.set(key, seenSoFar);

      const alreadyInEarlierStatements = committedByStatement.get(key) ?? 0;
      if (seenSoFar <= alreadyInEarlierStatements) {
        // Overlap with an earlier statement — skip!
        continue;
      }
      mergedRows.push({ tx, sourceStatementIndex: sIdx });
    }
    for (const [k, count] of localCounts.entries()) {
      committedByStatement.set(k, Math.max(committedByStatement.get(k) ?? 0, count));
    }
  }

  // Sort merged rows chronologically descending (newest first, matching Firecent lists)
  mergedRows.sort(
    (a, b) =>
      b.tx.date.localeCompare(a.tx.date) ||
      (b.tx.time ?? "").localeCompare(a.tx.time ?? ""),
  );

  const earliest = dated[0];
  const latest = dated[dated.length - 1];

  const allDates = mergedRows.map((r) => r.tx.date).sort();
  const periodFrom =
    earliest?.ext.periodFrom ?? allDates[0] ?? null;
  const periodTo =
    latest?.ext.periodTo ?? allDates[allDates.length - 1] ?? null;

  const sourceFiles = orderedExtracts
    .map((e, i) => e.sourceFileName || `Statement ${i + 1}`)
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  return {
    orderedExtracts,
    mergedRows,
    periodFrom,
    periodTo,
    openingBalance: earliest?.ext.openingBalance ?? null,
    openingConvention: earliest?.ext.balanceConvention ?? "SIGNED",
    closingBalance: latest?.ext.closingBalance ?? null,
    closingConvention: latest?.ext.balanceConvention ?? "SIGNED",
    sourceFiles,
  };
}

export type ExistingPayeeLite = {
  id: number;
  name: string;
  normalized: string;
};

export type ExistingCategoryLite = {
  id: number;
  name: string;
  nameEn: string | null;
  nameEs: string | null;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  spendingNature: "DEBO" | "NECESITO" | "QUIERO" | null;
};

export type ExistingAccountRecordLite = {
  id: number;
  amount: number;
  date: string | null;
  note: string | null;
  payeeName: string | null;
  transfer: boolean;
};

export type OpenUnmatchedTransferLite = {
  id: number;
  accountId: number;
  accountName: string;
  accountColor: string | null;
  accountType: string;
  currency: string;
  amount: number;
  date: string | null;
  note: string | null;
};

export function matchPayeeDeterministic(
  payeeSuggestion: string | null | undefined,
  description: string,
  payees: ExistingPayeeLite[],
  historicalNoteToPayee: Map<string, number>,
  suggestedPayeeId?: number | null,
): {
  payeeId: number | null;
  payeeName: string | null;
  matchKind: ReconciledRow["payeeMatchKind"];
} {
  // 0. Direct validated payeeId from Kimi (when org top payees were provided in context)
  if (suggestedPayeeId) {
    const byId = payees.find((p) => p.id === suggestedPayeeId);
    if (byId) {
      return { payeeId: byId.id, payeeName: byId.name, matchKind: "EXACT" };
    }
  }

  const candidateRaw = (payeeSuggestion || "").trim() || description.trim();
  const normCandidate = normalizeMerchant(candidateRaw);
  const normDesc = normalizeMerchant(description);

  // 1. Exact normalized match on payee name
  if (normCandidate) {
    const exact = payees.find((p) => p.normalized === normCandidate);
    if (exact) {
      return { payeeId: exact.id, payeeName: exact.name, matchKind: "EXACT" };
    }
  }
  if (normDesc && normDesc !== normCandidate) {
    const exactDesc = payees.find((p) => p.normalized === normDesc);
    if (exactDesc) {
      return {
        payeeId: exactDesc.id,
        payeeName: exactDesc.name,
        matchKind: "EXACT",
      };
    }
  }

  // 2. Historical bank memo -> payeeId match
  if (normDesc) {
    const histId = historicalNoteToPayee.get(normDesc);
    if (histId) {
      const found = payees.find((p) => p.id === histId);
      if (found) {
        return { payeeId: found.id, payeeName: found.name, matchKind: "HISTORY" };
      }
    }
  }

  // 3. Substring / prefix / Dice bigram similarity match
  // Guard against payment processors (e.g. "N1CO" riding inside "FASANI CHILTIUPAN N1CO")
  const probe = normCandidate || normDesc;
  if (probe && probe.length >= 3) {
    const probeTokens = probe.split(" ");
    const firstToken = probeTokens[0] ?? "";
    let best: { payee: ExistingPayeeLite; score: number } | null = null;
    for (const p of payees) {
      if (!p.normalized || p.normalized.length < 3) continue;
      // Never fuzzy-match a payment processor unless it is the actual leading/sole token
      if (
        PAYMENT_PROCESSOR_TOKENS.has(p.normalized) &&
        firstToken !== p.normalized
      ) {
        continue;
      }

      let score = diceSimilarity(probe, p.normalized);
      const isWholeWordInProbe =
        p.normalized.length >= 4 &&
        (probe === p.normalized ||
          probe.startsWith(`${p.normalized} `) ||
          probe.endsWith(` ${p.normalized}`) ||
          probe.includes(` ${p.normalized} `));
      const isWholeWordInPayee =
        probe.length >= 4 &&
        (p.normalized === probe ||
          p.normalized.startsWith(`${probe} `) ||
          p.normalized.endsWith(` ${probe}`) ||
          p.normalized.includes(` ${probe} `));

      if (isWholeWordInProbe || isWholeWordInPayee) {
        // Prefer matches at the start of the descriptor over trailing words
        score = Math.max(
          score,
          probe.startsWith(p.normalized) || p.normalized.startsWith(probe)
            ? 0.88
            : 0.78,
        );
      }

      if (score >= 0.72 && (!best || score > best.score)) {
        best = { payee: p, score };
      }
    }
    if (best) {
      return {
        payeeId: best.payee.id,
        payeeName: best.payee.name,
        matchKind: "FUZZY",
      };
    }
  }

  const cleanNew = (payeeSuggestion || "").trim();
  if (cleanNew) {
    return { payeeId: null, payeeName: cleanNew, matchKind: "NEW" };
  }
  if (normDesc && normDesc.length >= 2) {
    const titleCased = normDesc
      .split(" ")
      .slice(0, 4)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { payeeId: null, payeeName: titleCased, matchKind: "NEW" };
  }
  return { payeeId: null, payeeName: null, matchKind: "NONE" };
}

/**
 * Pure deterministic reconciliation function (zero DB calls, 100% unit-testable!).
 */
export function runDeterministicReconciliation(input: {
  account: {
    id: number;
    name: string;
    type: string;
    currency: string;
    color: string | null;
    last4: string | null;
  };
  currentDbBalanceMinor: number;
  dbBalanceAtPeriodEndMinor: number;
  hasRecordsAfterPeriod: boolean;
  latestDbRecord: { date: string | null; label: string | null; amount: number } | null;
  extracts: RawStatementExtract[];
  existingAccountRecords: ExistingAccountRecordLite[];
  payees: ExistingPayeeLite[];
  payeeDefaultCategory: Map<number, number>;
  historicalNoteToPayee: Map<string, number>;
  categories: ExistingCategoryLite[];
  openUnmatchedTransfers: OpenUnmatchedTransferLite[];
  locale?: "es" | "en";
}): {
  rows: ReconciledRow[];
  summary: ReconciliationSummary;
  transferMatches: TransferMatchCardItem[];
} {
  const merged = mergeAndDedupStatements(input.extracts);
  const categoriesById = new Map<number, ExistingCategoryLite>();
  for (const c of input.categories) categoriesById.set(c.id, c);

  const defaultPaymentType: ReconciledRow["paymentType"] =
    input.account.type === "CREDIT_CARD"
      ? "CREDIT_CARD"
      : input.account.type === "CASH"
        ? "CASH"
        : "WEB_PAYMENT";

  // 1-to-1 tracking sets so duplicates & transfer matches never double-consume a DB record
  const consumedExistingIds = new Set<number>();
  const consumedUnmatchedTransferIds = new Set<number>();

  let latestMatchedAnchor: {
    date: string;
    label: string;
    amount: number;
  } | null = null;

  const transferMatches: TransferMatchCardItem[] = [];

  const rows: ReconciledRow[] = merged.mergedRows.map(
    ({ tx, sourceStatementIndex }) => {
      const amountMinor = rawTxToSignedMinor(tx);
      const uid = randomUUID().slice(0, 12);

      // A) Duplicate detection against existing DB records on the SAME account
      let bestDup: {
        rec: ExistingAccountRecordLite;
        score: number;
        daysDiff: number;
      } | null = null;
      const normTx = normalizeMerchant(tx.payeeName || tx.description);

      for (const rec of input.existingAccountRecords) {
        if (consumedExistingIds.has(rec.id)) continue;
        if (rec.amount !== amountMinor) continue;
        if (!rec.date) continue;
        const dd = daysBetweenIso(rec.date, tx.date);
        if (dd > 2) continue;

        let score = 10 - dd * 3;
        const normRec = normalizeMerchant(rec.payeeName || rec.note || "");
        if (normTx && normRec) {
          score += diceSimilarity(normTx, normRec) * 8;
        }
        if (!bestDup || score > bestDup.score) {
          bestDup = { rec, score, daysDiff: dd };
        }
      }

      const isDuplicate = bestDup !== null;
      if (bestDup) {
        consumedExistingIds.add(bestDup.rec.id);
        const recDate = bestDup.rec.date ?? tx.date;
        if (!latestMatchedAnchor || recDate > latestMatchedAnchor.date) {
          latestMatchedAnchor = {
            date: recDate,
            label: bestDup.rec.payeeName || bestDup.rec.note || tx.description,
            amount: bestDup.rec.amount,
          };
        }
      }

      // B) Cross-account unmatched transfer detection (±5 days, exact opposite amount)
      const looksLikeTransfer =
        tx.type === "TRANSFER" || TRANSFER_KEYWORD_RE.test(tx.description);
      let matchedTransferInfo: MatchedTransferInfo | null = null;
      let resolvedType: ReconciledRow["type"] = tx.type;

      if (!isDuplicate) {
        let bestTransfer: {
          candidate: OpenUnmatchedTransferLite;
          daysDiff: number;
        } | null = null;

        for (const cand of input.openUnmatchedTransfers) {
          if (consumedUnmatchedTransferIds.has(cand.id)) continue;
          if (cand.accountId === input.account.id) continue;
          if (cand.currency !== input.account.currency) continue;
          if (cand.amount !== -amountMinor) continue;
          if (!cand.date) continue;
          const dd = daysBetweenIso(cand.date, tx.date);
          if (dd > TRANSFER_MATCH_MAX_DAYS) continue;

          // Match if row is already TRANSFER or looks like a transfer OR exact amount match within ±5d
          if (!looksLikeTransfer && dd > 3) continue;

          if (!bestTransfer || dd < bestTransfer.daysDiff) {
            bestTransfer = { candidate: cand, daysDiff: dd };
          }
        }

        if (bestTransfer) {
          const c = bestTransfer.candidate;
          consumedUnmatchedTransferIds.add(c.id);
          resolvedType = "TRANSFER";
          matchedTransferInfo = {
            recordId: c.id,
            accountId: c.accountId,
            accountName: c.accountName,
            accountColor: c.accountColor,
            accountType: c.accountType,
            currency: c.currency,
            date: c.date!,
            amountMinor: c.amount,
            note: c.note,
            daysDiff: bestTransfer.daysDiff,
          };
          transferMatches.push({
            rowUid: uid,
            rowDate: tx.date,
            rowDescription: tx.description,
            rowAmountMinor: amountMinor,
            existingRecordId: c.id,
            existingAccountId: c.accountId,
            existingAccountName: c.accountName,
            existingAccountColor: c.accountColor,
            existingDate: c.date!,
            existingAmountMinor: c.amount,
            existingNote: c.note,
            daysDiff: bestTransfer.daysDiff,
            currency: c.currency,
          });
        } else if (looksLikeTransfer && tx.type === "TRANSFER") {
          resolvedType = "TRANSFER";
        }
      }

      // C) Payee + Category matching (for non-transfers)
      const payeeMatch =
        resolvedType === "TRANSFER"
          ? { payeeId: null, payeeName: null, matchKind: "NONE" as const }
          : matchPayeeDeterministic(
              tx.payeeName,
              tx.description,
              input.payees,
              input.historicalNoteToPayee,
              tx.payeeId,
            );

      let categoryId: number | null = null;
      let categoryName: string | null = null;
      let categorySource: ReconciledRow["categorySource"] = "NONE";
      let spendingNature: ReconciledRow["spendingNature"] = null;

      if (resolvedType !== "TRANSFER") {
        // Prefer historical category for matched payee if compatible with record type
        if (payeeMatch.payeeId) {
          const histCatId = input.payeeDefaultCategory.get(payeeMatch.payeeId);
          const histCat = histCatId ? categoriesById.get(histCatId) : null;
          if (histCat && histCat.type === resolvedType) {
            categoryId = histCat.id;
            categoryName =
              input.locale === "es"
                ? histCat.nameEs || histCat.name
                : histCat.nameEn || histCat.name;
            categorySource = "PAYEE_HISTORY";
            spendingNature =
              resolvedType === "EXPENSE" ? histCat.spendingNature : null;
          }
        }

        // Fall back to AI-suggested categoryId (validated against org categories)
        if (!categoryId && tx.categoryId) {
          const aiCat = categoriesById.get(tx.categoryId);
          if (aiCat && aiCat.type === resolvedType) {
            categoryId = aiCat.id;
            categoryName =
              input.locale === "es"
                ? aiCat.nameEs || aiCat.name
                : aiCat.nameEn || aiCat.name;
            categorySource = "AI";
            spendingNature =
              resolvedType === "EXPENSE"
                ? (tx.spendingNature ?? aiCat.spendingNature)
                : null;
          }
        } else if (resolvedType === "EXPENSE" && !spendingNature) {
          spendingNature = tx.spendingNature ?? null;
        }
      }

      const sourceExtract = merged.orderedExtracts[sourceStatementIndex];
      const statementRunningBalanceMinor =
        tx.runningBalance != null
          ? toFirecentSignedBalanceMinor(
              tx.runningBalance,
              input.account.type,
              sourceExtract?.balanceConvention ?? "SIGNED",
            )
          : null;

      return {
        uid,
        selected: !isDuplicate,
        sourceStatementIndex,
        date: tx.date,
        time: tx.time ?? null,
        type: resolvedType,
        amountMinor,
        description: tx.description,
        note: tx.note?.trim() || tx.description,
        payeeId: payeeMatch.payeeId,
        payeeName: payeeMatch.payeeName,
        payeeMatchKind: payeeMatch.matchKind,
        categoryId,
        categoryName,
        categorySource,
        spendingNature,
        paymentType: defaultPaymentType,
        isDuplicate,
        duplicateRecordId: bestDup?.rec.id ?? null,
        duplicateReason: bestDup
          ? bestDup.daysDiff === 0
            ? "exact_date_amount"
            : `near_date_${bestDup.daysDiff}d`
          : null,
        transferMode: matchedTransferInfo ? "LINK_EXISTING" : "UNMATCHED",
        matchedTransferRecordId: matchedTransferInfo?.recordId ?? null,
        matchedTransferInfo,
        transferAccountId: null,
        statementRunningBalanceMinor,
      };
    },
  );

  const statementOpeningBalanceMinor =
    merged.openingBalance != null
      ? toFirecentSignedBalanceMinor(
          merged.openingBalance,
          input.account.type,
          merged.openingConvention,
        )
      : null;

  const statementClosingBalanceMinor =
    merged.closingBalance != null
      ? toFirecentSignedBalanceMinor(
          merged.closingBalance,
          input.account.type,
          merged.closingConvention,
        )
      : null;

  const anchor = latestMatchedAnchor as {
    date: string;
    label: string;
    amount: number;
  } | null;

  const anchorDescription = anchor
    ? `${anchor.date} · ${anchor.label}`
    : input.latestDbRecord?.date
      ? `${input.latestDbRecord.date} · ${input.latestDbRecord.label ?? ""}`.trim()
      : null;

  const latestExtract = merged.orderedExtracts[merged.orderedExtracts.length - 1];
  const internalAudit = latestExtract
    ? auditStatementInternalMath(latestExtract, input.account.type)
    : null;

  const baseSummary: ReconciliationSummary = {
    accountId: input.account.id,
    accountName: input.account.name,
    accountType: input.account.type,
    accountCurrency: input.account.currency,
    accountColor: input.account.color,
    accountLast4: input.account.last4,
    currentDbBalanceMinor: input.currentDbBalanceMinor,
    dbBalanceAtPeriodEndMinor: input.dbBalanceAtPeriodEndMinor,
    hasRecordsAfterPeriod: input.hasRecordsAfterPeriod,
    lastTrackedDate: anchor?.date ?? input.latestDbRecord?.date ?? null,
    anchorDescription,
    statementPeriodFrom: merged.periodFrom,
    statementPeriodTo: merged.periodTo,
    statementOpeningBalanceMinor,
    statementClosingBalanceMinor,
    totalExtractedCount: rows.length,
    newCount: 0,
    selectedCount: 0,
    duplicateCount: 0,
    unmatchedTransferCount: 0,
    transferMatchCount: 0,
    selectedDeltaMinor: 0,
    projectedBalanceMinor: input.dbBalanceAtPeriodEndMinor,
    projectedCurrentBalanceMinor: input.currentDbBalanceMinor,
    discrepancyMinor: null,
    status: "NO_CLOSING_BALANCE",
    statementsCount: merged.orderedExtracts.length,
    sourceFiles: merged.sourceFiles,
    internalAudit,
  };

  const summary = recomputeReconciliationSummary(baseSummary, rows);

  return { rows, summary, transferMatches };
}

/**
 * Loads all needed DB state in ONE single parallel batch (~6 indexed queries total)
 * and runs deterministic reconciliation for the given account + statements.
 */
export async function reconcileStatementsWithDb(opts: {
  orgId: string;
  accountId: number;
  extracts: RawStatementExtract[];
  locale?: "es" | "en";
}): Promise<{
  rows: ReconciledRow[];
  summary: ReconciliationSummary;
  transferMatches: TransferMatchCardItem[];
}> {
  const mergedPreview = mergeAndDedupStatements(opts.extracts);
  const periodFrom = mergedPreview.periodFrom;
  const periodTo = mergedPreview.periodTo;

  const rangeStart = periodFrom
    ? new Date(`${addDaysIso(periodFrom, -10)}T00:00:00.000Z`)
    : undefined;
  const rangeEnd = periodTo
    ? new Date(`${addDaysIso(periodTo, 5)}T00:00:00.000Z`)
    : undefined;
  const periodToDate = periodTo ? new Date(`${periodTo}T00:00:00.000Z`) : null;

  const [
    account,
    totalBalanceAgg,
    balanceAtPeriodEndAgg,
    afterPeriodCount,
    rangeRecords,
    latestRecord,
    payeesRaw,
    recentPayeeRecords,
    categoriesRaw,
    unmatchedTransfersRaw,
  ] = await Promise.all([
    db.bankAccount.findFirst({
      where: { id: opts.accountId, organizationId: opts.orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        color: true,
        accountNumber: true,
      },
    }),
    db.record.aggregate({
      where: {
        organizationId: opts.orgId,
        accountId: opts.accountId,
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    periodToDate
      ? db.record.aggregate({
          where: {
            organizationId: opts.orgId,
            accountId: opts.accountId,
            deletedAt: null,
            OR: [{ recordDate: { lte: periodToDate } }, { recordDate: null }],
          },
          _sum: { amount: true },
        })
      : Promise.resolve(null),
    periodToDate
      ? db.record.count({
          where: {
            organizationId: opts.orgId,
            accountId: opts.accountId,
            deletedAt: null,
            recordDate: { gt: periodToDate },
          },
        })
      : Promise.resolve(0),
    db.record.findMany({
      where: {
        organizationId: opts.orgId,
        accountId: opts.accountId,
        deletedAt: null,
        ...(rangeStart && rangeEnd
          ? { recordDate: { gte: rangeStart, lte: rangeEnd } }
          : {}),
      },
      orderBy: [{ recordDate: "desc" }, { id: "desc" }],
      take: 800,
      select: {
        id: true,
        amount: true,
        recordDate: true,
        note: true,
        transfer: true,
        payee: { select: { name: true } },
      },
    }),
    db.record.findFirst({
      where: {
        organizationId: opts.orgId,
        accountId: opts.accountId,
        deletedAt: null,
      },
      orderBy: [{ recordDate: "desc" }, { id: "desc" }],
      select: {
        amount: true,
        recordDate: true,
        note: true,
        payee: { select: { name: true } },
      },
    }),
    db.payee.findMany({
      where: { organizationId: opts.orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
    db.record.findMany({
      where: {
        organizationId: opts.orgId,
        deletedAt: null,
        transfer: false,
        payeeId: { not: null },
      },
      orderBy: { recordDate: "desc" },
      take: 600,
      select: { payeeId: true, categoryId: true, note: true },
    }),
    db.category.findMany({
      where: { organizationId: opts.orgId, deletedAt: null, hidden: false },
      select: {
        id: true,
        name: true,
        nameEn: true,
        nameEs: true,
        type: true,
        spendingNature: true,
      },
    }),
    db.record.findMany({
      where: {
        organizationId: opts.orgId,
        deletedAt: null,
        transfer: true,
        transferGroupId: null,
        transferAccountId: null,
        accountId: { not: opts.accountId },
      },
      orderBy: { recordDate: "desc" },
      take: 200,
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

  if (!account) {
    throw new Error("Account not found in active organization");
  }

  // Build payee -> most frequent category map & historical note -> payee map
  const payeeCatCounts = new Map<number, Map<number, number>>();
  const historicalNoteToPayee = new Map<string, number>();

  for (const r of recentPayeeRecords) {
    if (r.payeeId && r.categoryId) {
      let inner = payeeCatCounts.get(r.payeeId);
      if (!inner) {
        inner = new Map();
        payeeCatCounts.set(r.payeeId, inner);
      }
      inner.set(r.categoryId, (inner.get(r.categoryId) ?? 0) + 1);
    }
    if (r.payeeId && r.note) {
      const norm = normalizeMerchant(r.note);
      if (norm.length >= 4 && !historicalNoteToPayee.has(norm)) {
        historicalNoteToPayee.set(norm, r.payeeId);
      }
    }
  }

  const payeeDefaultCategory = new Map<number, number>();
  for (const [pId, freq] of payeeCatCounts.entries()) {
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) payeeDefaultCategory.set(pId, top[0]);
  }

  const payees: ExistingPayeeLite[] = payeesRaw.map((p) => ({
    id: p.id,
    name: p.name,
    normalized: normalizeMerchant(p.name),
  }));

  const existingAccountRecords: ExistingAccountRecordLite[] = rangeRecords.map(
    (r) => ({
      id: r.id,
      amount: r.amount,
      date: r.recordDate ? r.recordDate.toISOString().slice(0, 10) : null,
      note: r.note,
      payeeName: r.payee?.name ?? null,
      transfer: r.transfer,
    }),
  );

  const openUnmatchedTransfers: OpenUnmatchedTransferLite[] =
    unmatchedTransfersRaw.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      accountName: t.account.name,
      accountColor: t.account.color,
      accountType: t.account.type,
      currency: t.account.currency,
      amount: t.amount,
      date: t.recordDate ? t.recordDate.toISOString().slice(0, 10) : null,
      note: t.note,
    }));

  const currentDbBalanceMinor = totalBalanceAgg._sum.amount ?? 0;
  const dbBalanceAtPeriodEndMinor =
    balanceAtPeriodEndAgg != null
      ? (balanceAtPeriodEndAgg._sum.amount ?? 0)
      : currentDbBalanceMinor;

  return runDeterministicReconciliation({
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      color: account.color,
      last4: account.accountNumber,
    },
    currentDbBalanceMinor,
    dbBalanceAtPeriodEndMinor,
    hasRecordsAfterPeriod: afterPeriodCount > 0,
    latestDbRecord: latestRecord
      ? {
          date: latestRecord.recordDate
            ? latestRecord.recordDate.toISOString().slice(0, 10)
            : null,
          label: latestRecord.payee?.name || latestRecord.note || null,
          amount: latestRecord.amount,
        }
      : null,
    extracts: opts.extracts,
    existingAccountRecords,
    payees,
    payeeDefaultCategory,
    historicalNoteToPayee,
    categories: categoriesRaw,
    openUnmatchedTransfers,
    locale: opts.locale,
  });
}

/**
 * Batch-commits an approved statement proposal inside ONE database transaction
 * with ~5–6 SQL queries total regardless of row count (100+ rows supported cleanly).
 */
export async function applyStatementProposalBatch(opts: {
  orgId: string;
  userId: string;
  proposalId: string;
  rows: ReconciledRow[];
  includeBalanceAdjustment?: boolean;
}): Promise<{
  appliedCount: number;
  linkedTransfersCount: number;
  adjustmentCreated: boolean;
  createdRecordIds: number[];
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
  if (proposal.status === "APPLIED") {
    throw new Error("Proposal was already applied");
  }
  if (!proposal.accountId) {
    throw new Error("Account must be selected before applying proposal");
  }

  const accountId = proposal.accountId;
  const payload = proposal.payload as unknown as ProposalPayload;
  const selectedRows = opts.rows.filter((r) => r.selected);

  if (selectedRows.length === 0 && !opts.includeBalanceAdjustment) {
    throw new Error("No transactions selected");
  }

  // 1. Validate references in ONE parallel batch
  const requestedCategoryIds = [
    ...new Set(
      selectedRows
        .map((r) => r.categoryId)
        .filter((id): id is number => id != null),
    ),
  ];
  const requestedTransferAccountIds = [
    ...new Set(
      selectedRows
        .filter((r) => r.type === "TRANSFER" && r.transferMode === "CREATE_PAIR")
        .map((r) => r.transferAccountId)
        .filter((id): id is number => id != null && id !== accountId),
    ),
  ];
  const requestedLinkRecordIds = [
    ...new Set(
      selectedRows
        .filter(
          (r) =>
            r.type === "TRANSFER" &&
            r.transferMode === "LINK_EXISTING" &&
            r.matchedTransferRecordId != null,
        )
        .map((r) => r.matchedTransferRecordId!),
    ),
  ];

  const [
    validAccounts,
    validCategories,
    existingPayees,
    existingOrphanTransfers,
  ] = await Promise.all([
    db.bankAccount.findMany({
      where: {
        organizationId: opts.orgId,
        deletedAt: null,
        id: { in: [accountId, ...requestedTransferAccountIds] },
      },
      select: { id: true },
    }),
    requestedCategoryIds.length > 0
      ? db.category.findMany({
          where: {
            organizationId: opts.orgId,
            deletedAt: null,
            id: { in: requestedCategoryIds },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    db.payee.findMany({
      where: { organizationId: opts.orgId, deletedAt: null },
      select: { id: true, name: true },
    }),
    requestedLinkRecordIds.length > 0
      ? db.record.findMany({
          where: {
            organizationId: opts.orgId,
            deletedAt: null,
            transfer: true,
            transferGroupId: null,
            id: { in: requestedLinkRecordIds },
          },
          select: { id: true, accountId: true, amount: true },
        })
      : Promise.resolve([]),
  ]);

  const validAccountSet = new Set(validAccounts.map((a) => a.id));
  if (!validAccountSet.has(accountId)) {
    throw new Error("Target account no longer exists");
  }
  const validCategorySet = new Set(validCategories.map((c) => c.id));
  const orphanById = new Map(existingOrphanTransfers.map((t) => [t.id, t]));

  // 2. Batch-resolve & batch-create missing Payees
  const payeeByLower = new Map<string, number>();
  const payeeById = new Set<number>();
  for (const p of existingPayees) {
    payeeByLower.set(p.name.trim().toLowerCase(), p.id);
    payeeById.add(p.id);
  }

  const missingPayeeNames = new Map<string, string>();
  for (const r of selectedRows) {
    if (r.type === "TRANSFER") continue;
    if (r.payeeId && payeeById.has(r.payeeId)) continue;
    const trimmed = r.payeeName?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!payeeByLower.has(key) && !missingPayeeNames.has(key)) {
      missingPayeeNames.set(key, trimmed);
    }
  }

  if (missingPayeeNames.size > 0) {
    await db.payee.createMany({
      data: [...missingPayeeNames.values()].map((name) => ({
        organizationId: opts.orgId,
        name,
        createdBy: opts.userId,
      })),
      skipDuplicates: true,
    });
    const refreshed = await db.payee.findMany({
      where: {
        organizationId: opts.orgId,
        deletedAt: null,
        name: { in: [...missingPayeeNames.values()], mode: "insensitive" },
      },
      select: { id: true, name: true },
    });
    for (const p of refreshed) {
      payeeByLower.set(p.name.trim().toLowerCase(), p.id);
      payeeById.add(p.id);
    }
  }

  const resolveRowPayeeId = (r: ReconciledRow): number | null => {
    if (r.type === "TRANSFER") return null;
    if (r.payeeId && payeeById.has(r.payeeId)) return r.payeeId;
    const trimmed = r.payeeName?.trim();
    if (!trimmed) return null;
    return payeeByLower.get(trimmed.toLowerCase()) ?? null;
  };

  // Partition rows by write strategy
  const simpleInsertData: Prisma.RecordCreateManyInput[] = [];
  const linkRows: Array<{
    row: ReconciledRow;
    orphan: { id: number; accountId: number; amount: number };
  }> = [];
  const pairRows: Array<{ row: ReconciledRow; toAccountId: number }> = [];
  const claimedOrphans = new Set<number>();

  for (const r of selectedRows) {
    const recordDate = new Date(`${r.date}T00:00:00.000Z`);
    const recordTime = r.time
      ? new Date(`1970-01-01T${r.time}:00.000Z`)
      : null;

    if (
      r.type === "TRANSFER" &&
      r.transferMode === "LINK_EXISTING" &&
      r.matchedTransferRecordId
    ) {
      const orphan = orphanById.get(r.matchedTransferRecordId);
      if (
        orphan &&
        orphan.accountId !== accountId &&
        !claimedOrphans.has(orphan.id)
      ) {
        claimedOrphans.add(orphan.id);
        linkRows.push({ row: r, orphan });
        continue;
      }
    }

    if (
      r.type === "TRANSFER" &&
      r.transferMode === "CREATE_PAIR" &&
      r.transferAccountId &&
      r.transferAccountId !== accountId &&
      validAccountSet.has(r.transferAccountId)
    ) {
      pairRows.push({ row: r, toAccountId: r.transferAccountId });
      continue;
    }

    const isTransfer = r.type === "TRANSFER";
    const categoryId =
      !isTransfer && r.categoryId && validCategorySet.has(r.categoryId)
        ? r.categoryId
        : null;

    simpleInsertData.push({
      organizationId: opts.orgId,
      accountId,
      type: r.type,
      transfer: isTransfer,
      transferAccountId: null,
      transferGroupId: null,
      categoryId,
      payeeId: resolveRowPayeeId(r),
      spendingNature: r.type === "EXPENSE" ? (r.spendingNature ?? null) : null,
      paymentType: r.paymentType,
      amount: r.amountMinor,
      note: (r.note?.trim() || r.description || "").slice(0, 500) || null,
      recordDate,
      recordTime,
      createdBy: opts.userId,
    });
  }

  // Recompute summary to know exact discrepancy if balance adjustment is requested
  const updatedSummary = payload.summary
    ? recomputeReconciliationSummary(payload.summary, opts.rows)
    : null;
  const adjustmentMinor =
    opts.includeBalanceAdjustment &&
    updatedSummary?.discrepancyMinor != null &&
    updatedSummary.discrepancyMinor !== 0
      ? updatedSummary.discrepancyMinor
      : 0;

  // 3. Execute ALL writes in ONE atomic database transaction
  const txResult = await db.$transaction(async (tx) => {
    const createdRecordIds: number[] = [];
    const linkedExistingTransfers: Array<{
      existingRecordId: number;
      createdCounterpartId: number;
    }> = [];

    // Batch insert all simple rows & unmatched transfers in ONE query!
    if (simpleInsertData.length > 0) {
      const inserted = await tx.record.createManyAndReturn({
        data: simpleInsertData,
        select: { id: true },
      });
      for (const row of inserted) createdRecordIds.push(row.id);
    }

    // Link transfers to existing orphan transfers across accounts
    for (const { row, orphan } of linkRows) {
      const recordDate = new Date(`${row.date}T00:00:00.000Z`);
      const recordTime = row.time
        ? new Date(`1970-01-01T${row.time}:00.000Z`)
        : null;

      const created = await tx.record.create({
        data: {
          organizationId: opts.orgId,
          accountId,
          transferAccountId: orphan.accountId,
          type: "TRANSFER",
          transfer: true,
          paymentType: row.paymentType,
          amount: row.amountMinor,
          note: (row.note?.trim() || row.description || "").slice(0, 500) || null,
          recordDate,
          recordTime,
          createdBy: opts.userId,
        },
        select: { id: true },
      });
      createdRecordIds.push(created.id);

      // Firecent convention: transferGroupId is the negative (exit) leg's id
      const groupId = row.amountMinor < 0 ? created.id : orphan.id;

      await Promise.all([
        tx.record.update({
          where: { id: created.id },
          data: { transferGroupId: groupId },
        }),
        tx.record.update({
          where: { id: orphan.id },
          data: {
            transferAccountId: accountId,
            transferGroupId: groupId,
            updatedBy: opts.userId,
          },
        }),
      ]);

      linkedExistingTransfers.push({
        existingRecordId: orphan.id,
        createdCounterpartId: created.id,
      });
    }

    // Create full pairs when user explicitly picked a destination/source account
    for (const { row, toAccountId } of pairRows) {
      const recordDate = new Date(`${row.date}T00:00:00.000Z`);
      const recordTime = row.time
        ? new Date(`1970-01-01T${row.time}:00.000Z`)
        : null;
      const note =
        (row.note?.trim() || row.description || "").slice(0, 500) || null;

      const leg1 = await tx.record.create({
        data: {
          organizationId: opts.orgId,
          accountId,
          transferAccountId: toAccountId,
          type: "TRANSFER",
          transfer: true,
          paymentType: row.paymentType,
          amount: row.amountMinor,
          note,
          recordDate,
          recordTime,
          createdBy: opts.userId,
        },
        select: { id: true },
      });
      const leg2 = await tx.record.create({
        data: {
          organizationId: opts.orgId,
          accountId: toAccountId,
          transferAccountId: accountId,
          type: "TRANSFER",
          transfer: true,
          paymentType: row.paymentType,
          amount: -row.amountMinor,
          note,
          recordDate,
          recordTime,
          createdBy: opts.userId,
        },
        select: { id: true },
      });

      const groupId = row.amountMinor < 0 ? leg1.id : leg2.id;
      await tx.record.updateMany({
        where: { id: { in: [leg1.id, leg2.id] } },
        data: { transferGroupId: groupId },
      });

      createdRecordIds.push(leg1.id, leg2.id);
    }

    // Optional balance adjustment record for missing earlier gap
    let adjustmentRecordId: number | null = null;
    if (adjustmentMinor !== 0) {
      const adjDate =
        updatedSummary?.statementPeriodFrom ??
        selectedRows
          .map((r) => r.date)
          .sort()[0] ??
        new Date().toISOString().slice(0, 10);

      const adj = await tx.record.create({
        data: {
          organizationId: opts.orgId,
          accountId,
          type: adjustmentMinor > 0 ? "INCOME" : "EXPENSE",
          transfer: false,
          amount: adjustmentMinor,
          note: "Balance adjustment (statement reconciliation)",
          recordDate: new Date(`${adjDate}T00:00:00.000Z`),
          recordTime: new Date("1970-01-01T00:00:00.000Z"),
          createdBy: opts.userId,
        },
        select: { id: true },
      });
      adjustmentRecordId = adj.id;
      createdRecordIds.push(adj.id);
    }

    const nextPayload: ProposalPayload = {
      ...payload,
      rows: opts.rows,
      summary: updatedSummary,
      appliedMeta: {
        createdRecordIds,
        linkedExistingTransfers,
        adjustmentRecordId,
        appliedCount: selectedRows.length,
      },
    };

    await tx.assistantProposal.update({
      where: { id: proposal.id },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        appliedRecordIds: createdRecordIds,
        payload: nextPayload as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      createdRecordIds,
      linkedTransfersCount: linkedExistingTransfers.length,
      adjustmentCreated: adjustmentRecordId != null,
    };
  });

  return {
    appliedCount: selectedRows.length,
    linkedTransfersCount: txResult.linkedTransfersCount,
    adjustmentCreated: txResult.adjustmentCreated,
    createdRecordIds: txResult.createdRecordIds,
  };
}

/**
 * Reverts a previously applied statement proposal in ONE transaction:
 * soft-deletes created records and unlinks any previously orphan transfers.
 */
export async function undoStatementProposalBatch(opts: {
  orgId: string;
  userId: string;
  proposalId: string;
}): Promise<{ revertedCount: number }> {
  const proposal = await db.assistantProposal.findFirst({
    where: {
      id: opts.proposalId,
      organizationId: opts.orgId,
      userId: opts.userId,
    },
  });

  if (!proposal || proposal.status !== "APPLIED") {
    throw new Error("Applied proposal not found");
  }

  const payload = proposal.payload as unknown as ProposalPayload;
  const recordIds =
    payload.appliedMeta?.createdRecordIds ?? proposal.appliedRecordIds ?? [];
  const linkedOrphans = payload.appliedMeta?.linkedExistingTransfers ?? [];
  const now = new Date();

  await db.$transaction(async (tx) => {
    if (recordIds.length > 0) {
      await tx.record.updateMany({
        where: {
          organizationId: opts.orgId,
          id: { in: recordIds },
          deletedAt: null,
        },
        data: { deletedAt: now, deletedBy: opts.userId },
      });
    }

    if (linkedOrphans.length > 0) {
      await tx.record.updateMany({
        where: {
          organizationId: opts.orgId,
          id: { in: linkedOrphans.map((l) => l.existingRecordId) },
          deletedAt: null,
        },
        data: {
          transferAccountId: null,
          transferGroupId: null,
          updatedBy: opts.userId,
        },
      });
    }

    const nextPayload: ProposalPayload = {
      ...payload,
      appliedMeta: undefined,
    };

    await tx.assistantProposal.update({
      where: { id: proposal.id },
      data: {
        status: "PENDING",
        appliedAt: null,
        appliedRecordIds: [],
        payload: nextPayload as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return { revertedCount: recordIds.length };
}
