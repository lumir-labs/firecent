import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  auditStatementInternalMath,
  daysBetweenIso,
  matchPayeeDeterministic,
  mergeAndDedupStatements,
  normalizeMerchant,
  rankAccountCandidates,
  runDeterministicReconciliation,
  toFirecentSignedBalanceMinor,
} from "./reconciliation.ts";
import { recomputeReconciliationSummary } from "./types.ts";

describe("Assistant reconciliation engine", () => {
  test("normalizes bank merchant strings and fuzzy-matches existing payees", () => {
    assert.equal(
      normalizeMerchant("COMPRA POS SUPER SELECTOS #14 SAN SALVADOR SV"),
      "super selectos",
    );

    const payees = [
      { id: 10, name: "Super Selectos", normalized: normalizeMerchant("Super Selectos") },
      { id: 11, name: "Uber Eats", normalized: normalizeMerchant("Uber Eats") },
    ];

    const exact = matchPayeeDeterministic(
      "Super Selectos",
      "COMPRA POS SUPER SELECTOS #14 SV",
      payees,
      new Map(),
    );
    assert.equal(exact.payeeId, 10);
    assert.equal(exact.matchKind, "EXACT");

    const fuzzy = matchPayeeDeterministic(
      null,
      "POS UBER EATS *TRIP 9921",
      payees,
      new Map(),
    );
    assert.equal(fuzzy.payeeId, 11);
    assert.equal(fuzzy.matchKind, "FUZZY");

    const fresh = matchPayeeDeterministic(
      "Café Fulanos",
      "CAFE FULANOS ZONA ROSA",
      payees,
      new Map(),
    );
    assert.equal(fresh.payeeId, null);
    assert.equal(fresh.payeeName, "Café Fulanos");
    assert.equal(fresh.matchKind, "NEW");
  });

  test("ranks accounts confidently on unique last4 and flags ambiguity otherwise", () => {
    const accounts = [
      { id: 1, name: "BAC Visa Gold", type: "CREDIT_CARD", currency: "USD", color: null, last4: "4821", balance: -400 },
      { id: 2, name: "BAC Visa Platinum", type: "CREDIT_CARD", currency: "USD", color: null, last4: "9012", balance: -120 },
      { id: 3, name: "Agrícola Débito", type: "CHECKING_ACCOUNT", currency: "USD", color: null, last4: "3311", balance: 1500 },
    ];

    const clear = rankAccountCandidates(
      {
        institution: "BAC",
        last4: "4821",
        currency: "USD",
        accountTypeHint: "CREDIT_CARD",
        balanceConvention: "CREDIT_DEBT_POSITIVE",
        transactions: [],
      },
      accounts,
    );
    assert.equal(clear.confident, true);
    assert.equal(clear.bestAccountId, 1);

    const ambiguous = rankAccountCandidates(
      {
        institution: "BAC",
        last4: null,
        currency: "USD",
        accountTypeHint: "CREDIT_CARD",
        balanceConvention: "CREDIT_DEBT_POSITIVE",
        transactions: [],
      },
      accounts,
    );
    assert.equal(ambiguous.confident, false);
    assert.equal(ambiguous.bestAccountId, null);
  });

  test("handles credit card balance sign convention cleanly", () => {
    assert.equal(
      toFirecentSignedBalanceMinor(450.25, "CREDIT_CARD", "CREDIT_DEBT_POSITIVE"),
      -45025,
    );
    assert.equal(
      toFirecentSignedBalanceMinor(-20, "CREDIT_CARD", "CREDIT_DEBT_POSITIVE"),
      2000,
    );
    assert.equal(
      toFirecentSignedBalanceMinor(1250.5, "CHECKING_ACCOUNT", "SIGNED"),
      125050,
    );
  });

  test("detects balance gap, then reconciles to exact match when earlier statement is merged", () => {
    const novStatement = {
      sourceFileName: "nov-2026.pdf",
      periodFrom: "2026-11-01",
      periodTo: "2026-11-30",
      openingBalance: 750,
      closingBalance: 550,
      balanceConvention: "SIGNED",
      transactions: [
        { date: "2026-11-05", description: "SUPER SELECTOS #1", payeeName: "Super Selectos", amount: 120, direction: "OUT", type: "EXPENSE", categoryId: 1 },
        { date: "2026-11-12", description: "SHELL GAS", payeeName: "Shell", amount: 80, direction: "OUT", type: "EXPENSE", categoryId: 2 },
      ],
    };

    const baseInputs = {
      account: { id: 3, name: "Checking", type: "CHECKING_ACCOUNT", currency: "USD", color: null, last4: "3311" },
      currentDbBalanceMinor: 100_000,
      dbBalanceAtPeriodEndMinor: 100_000,
      hasRecordsAfterPeriod: false,
      latestDbRecord: { date: "2026-09-30", label: "Super Selectos", amount: -4210 },
      existingAccountRecords: [
        { id: 901, amount: -4210, date: "2026-09-30", note: "SUPER SELECTOS", payeeName: "Super Selectos", transfer: false },
      ],
      payees: [{ id: 10, name: "Super Selectos", normalized: "super selectos" }],
      payeeDefaultCategory: new Map([[10, 1]]),
      historicalNoteToPayee: new Map(),
      categories: [
        { id: 1, name: "Groceries", nameEn: "Groceries", nameEs: "Supermercado", type: "EXPENSE", spendingNature: "NECESITO" },
        { id: 2, name: "Transport", nameEn: "Transport", nameEs: "Transporte", type: "EXPENSE", spendingNature: "NECESITO" },
      ],
      openUnmatchedTransfers: [],
      locale: "es",
    };

    const pass1 = runDeterministicReconciliation({
      ...baseInputs,
      extracts: [novStatement],
    });
    assert.equal(pass1.summary.status, "GAP_DETECTED");
    assert.equal(pass1.summary.discrepancyMinor, -25_000);
    assert.equal(pass1.summary.projectedBalanceMinor, 80_000);

    const octStatement = {
      sourceFileName: "oct-2026.pdf",
      periodFrom: "2026-09-30",
      periodTo: "2026-10-31",
      openingBalance: 1042.1,
      closingBalance: 750,
      balanceConvention: "SIGNED",
      transactions: [
        { date: "2026-09-30", description: "SUPER SELECTOS", payeeName: "Super Selectos", amount: 42.1, direction: "OUT", type: "EXPENSE", categoryId: 1 },
        { date: "2026-10-15", description: "RENT", payeeName: "Landlord", amount: 250, direction: "OUT", type: "EXPENSE", categoryId: 1 },
      ],
    };

    const pass2 = runDeterministicReconciliation({
      ...baseInputs,
      extracts: [novStatement, octStatement],
    });

    assert.equal(pass2.summary.duplicateCount, 1);
    assert.equal(pass2.summary.newCount, 3);
    assert.equal(pass2.summary.status, "MATCHED");
    assert.equal(pass2.summary.discrepancyMinor, 0);
    assert.equal(pass2.summary.projectedBalanceMinor, 55_000);
    assert.ok(pass2.summary.anchorDescription?.includes("2026-09-30"));

    const toggled = pass2.rows.map((r, i) => (i === 0 ? { ...r, selected: false } : r));
    const recomputed = recomputeReconciliationSummary(pass2.summary, toggled);
    assert.equal(recomputed.status, "GAP_DETECTED");
    assert.notEqual(recomputed.discrepancyMinor, 0);
  });

  test("matches cross-session transfers within ±5 days and rejects >5 days", () => {
    assert.equal(daysBetweenIso("2026-11-10", "2026-11-15"), 5);
    assert.equal(daysBetweenIso("2026-11-10", "2026-11-16"), 6);

    const cardStatement = {
      sourceFileName: "visa-nov.pdf",
      periodFrom: "2026-11-01",
      periodTo: "2026-11-30",
      closingBalance: 100,
      balanceConvention: "CREDIT_DEBT_POSITIVE",
      transactions: [
        { date: "2026-11-14", description: "PAGO RECIBIDO GRACIAS", amount: 350, direction: "IN", type: "TRANSFER" },
        { date: "2026-11-25", description: "PAGO TARJETA", amount: 120, direction: "IN", type: "TRANSFER" },
      ],
    };

    const res = runDeterministicReconciliation({
      account: { id: 1, name: "BAC Visa", type: "CREDIT_CARD", currency: "USD", color: null, last4: "4821" },
      currentDbBalanceMinor: -57_000,
      dbBalanceAtPeriodEndMinor: -57_000,
      hasRecordsAfterPeriod: false,
      latestDbRecord: null,
      extracts: [cardStatement],
      existingAccountRecords: [],
      payees: [],
      payeeDefaultCategory: new Map(),
      historicalNoteToPayee: new Map(),
      categories: [],
      openUnmatchedTransfers: [
        {
          id: 501,
          accountId: 3,
          accountName: "Agrícola Débito",
          accountColor: null,
          accountType: "CHECKING_ACCOUNT",
          currency: "USD",
          amount: -35_000,
          date: "2026-11-10",
          note: "PAGO TARJETA BAC",
        },
        {
          id: 502,
          accountId: 3,
          accountName: "Agrícola Débito",
          accountColor: null,
          accountType: "CHECKING_ACCOUNT",
          currency: "USD",
          amount: -12_000,
          date: "2026-11-18",
          note: "PAGO TARJETA BAC",
        },
      ],
      locale: "es",
    });

    assert.equal(res.transferMatches.length, 1);
    assert.equal(res.transferMatches[0].existingRecordId, 501);
    assert.equal(res.transferMatches[0].daysDiff, 4);

    const matchedRow = res.rows.find((r) => r.amountMinor === 35_000);
    assert.equal(matchedRow.transferMode, "LINK_EXISTING");
    assert.equal(matchedRow.matchedTransferRecordId, 501);

    const unmatchedRow = res.rows.find((r) => r.amountMinor === 12_000);
    assert.equal(unmatchedRow.transferMode, "UNMATCHED");
    assert.equal(unmatchedRow.matchedTransferRecordId, null);

    assert.equal(res.summary.status, "MATCHED");
    assert.equal(res.summary.discrepancyMinor, 0);
  });

  test("preserves legitimate duplicate purchases on same day within a single statement", () => {
    const ext = {
      sourceFileName: "dup-coffee.csv",
      balanceConvention: "SIGNED",
      transactions: [
        { date: "2026-11-10", description: "STARBUCKS", amount: 5, direction: "OUT", type: "EXPENSE" },
        { date: "2026-11-10", description: "STARBUCKS", amount: 5, direction: "OUT", type: "EXPENSE" },
      ],
    };

    const merged = mergeAndDedupStatements([ext]);
    expectLen(merged.mergedRows, 2);
  });

  test("ignores payment gateway suffix N1CO and matches FCIA abbreviation + direct payeeId", () => {
    const payees = [
      { id: 1, name: "N1CO", normalized: normalizeMerchant("N1CO") },
      { id: 2, name: "Farmacia San Nicolás", normalized: normalizeMerchant("Farmacia San Nicolás") },
      { id: 3, name: "Gasolinera UNO", normalized: normalizeMerchant("Gasolinera UNO") },
    ];

    // Must NOT match payment processor N1CO when FASANI is the merchant
    const fasani = matchPayeeDeterministic(
      null,
      "FASANI CHILTIUPAN N1CO SANTA TECLA SV",
      payees,
      new Map(),
    );
    assert.notEqual(fasani.payeeId, 1);

    // Expands FCIA -> farmacia and matches Farmacia San Nicolás
    const fcia = matchPayeeDeterministic(
      null,
      "FCIA SAN NICOLAS SANTA ANTIGUO CUSCA SV",
      payees,
      new Map(),
    );
    assert.equal(fcia.payeeId, 2);

    // Direct validated payeeId from TopPayees wins cleanly
    const uno = matchPayeeDeterministic(
      "UNO SAN MARCOS",
      "UNO SAN MARCOS SAN SALVADOR SV",
      payees,
      new Map(),
      3,
    );
    assert.equal(uno.payeeId, 3);
    assert.equal(uno.payeeName, "Gasolinera UNO");
    assert.equal(uno.matchKind, "EXACT");
  });

  test("internal statement math audit catches missing $17.99 credit in <1ms", () => {
    const missingCredit = auditStatementInternalMath(
      {
        openingBalance: 1653.3,
        closingBalance: 1723.5,
        statementTotalCharges: 546.76,
        statementTotalCredits: 476.56,
        balanceConvention: "CREDIT_DEBT_POSITIVE",
        transactions: [
          { date: "2026-08-18", description: "CARGOS", amount: 546.76, direction: "OUT", type: "EXPENSE" },
          { date: "2026-08-18", description: "PAGOS", amount: 458.57, direction: "IN", type: "TRANSFER" },
        ],
      },
      "CREDIT_CARD",
    );
    assert.equal(missingCredit.ok, false);
    assert.equal(missingCredit.chargesDiffMinor, 0);
    assert.equal(missingCredit.creditsDiffMinor, 1799);

    const exact = auditStatementInternalMath(
      {
        openingBalance: 1653.3,
        closingBalance: 1723.5,
        statementTotalCharges: 546.76,
        statementTotalCredits: 476.56,
        balanceConvention: "CREDIT_DEBT_POSITIVE",
        transactions: [
          { date: "2026-08-18", description: "CARGOS", amount: 546.76, direction: "OUT", type: "EXPENSE" },
          { date: "2026-08-18", description: "PAGOS", amount: 476.56, direction: "IN", type: "TRANSFER" },
        ],
      },
      "CREDIT_CARD",
    );
    assert.equal(exact.ok, true);
    assert.equal(exact.creditsDiffMinor, 0);
    assert.equal(exact.equationDiffMinor, 0);
  });
});

function expectLen(arr, n) {
  assert.equal(arr.length, n);
}
