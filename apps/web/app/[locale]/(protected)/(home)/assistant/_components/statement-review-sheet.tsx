"use client";

import { useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Drawer as DrawerPrimitive } from "vaul";

import { trpc } from "@app/api/client";
import { AI_ASSISTANT_NAME } from "@app/lib";
import {
  computeProposalRunningBalances,
  recomputeReconciliationSummary,
  type ReconciledRow,
} from "@app/api/assistant-types";
import {
  AccountSwatch,
  CategoryIcon,
  Money,
  NATURES,
  NatureSwatch,
  formatMoneyText,
  localizeCategoryName,
} from "@/components/finance";
import type { AccountType, Nature } from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { TransactionDetailSheet } from "../../transactions/_components/transaction-detail-sheet";

const MINOR_UNIT = 100;

type FilterTab = "all" | "new" | "duplicates" | "transfers" | "uncategorized";

export type StatementReviewSheetProps = {
  proposalId: string | null;
  onClose: () => void;
  onApplied: (info: {
    proposalId: string;
    appliedCount: number;
    linkedTransfersCount: number;
  }) => void;
  onRequestUploadPrevious: () => void;
};

export function StatementReviewSheet({
  proposalId,
  onClose,
  onApplied,
  onRequestUploadPrevious,
}: StatementReviewSheetProps) {
  const t = useTranslations("Assistant");
  const tNature = useTranslations("Finance.nature");
  const locale = useLocale();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const utils = trpc.useUtils();

  const open = Boolean(proposalId);

  const query = trpc.assistant.getProposal.useQuery(
    { proposalId: proposalId ?? "", locale: locale === "en" ? "en" : "es" },
    { enabled: Boolean(proposalId), staleTime: 0 },
  );

  const reconcileMutation = trpc.assistant.reconcileProposal.useMutation({
    onSuccess: async () => {
      setDraft(null);
      await Promise.all([
        utils.assistant.getProposal.invalidate({
          proposalId: proposalId ?? "",
        }),
        utils.assistant.getThread.invalidate(),
      ]);
      toast.success(t("blocks.refreshedToast"));
    },
    onError: (err) => toast.error(err.message),
  });

  const [draft, setDraft] = useState<{
    proposalId: string;
    rows: ReconciledRow[];
  } | null>(null);
  const [filterState, setFilterState] = useState<{
    proposalId: string | null;
    search: string;
    tab: FilterTab;
    includeAdjustment: boolean;
  }>({
    proposalId: null,
    search: "",
    tab: "all",
    includeAdjustment: false,
  });

  const rows = useMemo<ReconciledRow[]>(() => {
    if (draft && draft.proposalId === proposalId) return draft.rows;
    return query.data?.rows ?? [];
  }, [draft, proposalId, query.data?.rows]);

  const setRows = (updater: (prev: ReconciledRow[]) => ReconciledRow[]) => {
    if (!proposalId) return;
    setDraft((prev) => {
      const base =
        prev && prev.proposalId === proposalId
          ? prev.rows
          : (query.data?.rows ?? []);
      return { proposalId, rows: updater(base) };
    });
  };

  const search = filterState.proposalId === proposalId ? filterState.search : "";
  const tab: FilterTab =
    filterState.proposalId === proposalId ? filterState.tab : "all";
  const includeAdjustment =
    filterState.proposalId === proposalId
      ? filterState.includeAdjustment
      : false;

  const setSearch = (next: string) =>
    setFilterState((prev) => ({
      proposalId,
      search: next,
      tab: prev.proposalId === proposalId ? prev.tab : "all",
      includeAdjustment:
        prev.proposalId === proposalId ? prev.includeAdjustment : false,
    }));

  const setTab = (next: FilterTab) =>
    setFilterState((prev) => ({
      proposalId,
      search: prev.proposalId === proposalId ? prev.search : "",
      tab: next,
      includeAdjustment:
        prev.proposalId === proposalId ? prev.includeAdjustment : false,
    }));

  const setIncludeAdjustment = (next: boolean) =>
    setFilterState((prev) => ({
      proposalId,
      search: prev.proposalId === proposalId ? prev.search : "",
      tab: prev.proposalId === proposalId ? prev.tab : "all",
      includeAdjustment: next,
    }));

  const [expandedDbProposalId, setExpandedDbProposalId] = useState<
    string | null
  >(null);
  const showUnmatchedDb = expandedDbProposalId === proposalId;

  const [inspectRecordId, setInspectRecordId] = useState<number | null>(null);
  const [expandedExtraRowUid, setExpandedExtraRowUid] = useState<string | null>(
    null,
  );
  const activeInspectRecordId = open ? inspectRecordId : null;

  const baseSummary = query.data?.summary ?? null;
  const liveSummary = useMemo(() => {
    if (!baseSummary) return null;
    return recomputeReconciliationSummary(baseSummary, rows);
  }, [baseSummary, rows]);

  const runningBalances = useMemo(
    () =>
      computeProposalRunningBalances(
        rows,
        query.data?.runningBalanceLedger,
        liveSummary,
      ),
    [rows, query.data?.runningBalanceLedger, liveSummary],
  );

  const applyMutation = trpc.assistant.applyProposal.useMutation({
    onSuccess: async (res) => {
      await Promise.all([
        utils.assistant.listThreads.invalidate(),
        utils.assistant.getThread.invalidate(),
        utils.accounts.list.invalidate(),
        utils.accounts.get.invalidate(),
        utils.records.list.invalidate(),
        utils.records.monthSummary.invalidate(),
        utils.dashboard.invalidate(),
        utils.analytics.overview.invalidate(),
        utils.budgets.invalidate(),
      ]);
      toast.success(
        t("review.appliedToast", {
          count: String(res.appliedCount),
        }),
      );
      if (proposalId) {
        onApplied({
          proposalId,
          appliedCount: res.appliedCount,
          linkedTransfersCount: res.linkedTransfersCount,
        });
      }
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || t("review.applyError"));
    },
  });

  const saveDraftMutation = trpc.assistant.saveProposalDraft.useMutation({
    onSuccess: async () => {
      await utils.assistant.getThread.invalidate();
      toast.success(t("review.draftSaved"));
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const categoriesByType = useMemo(() => {
    const cats = query.data?.options.categories ?? [];
    return {
      EXPENSE: cats.filter((c) => c.type === "EXPENSE"),
      INCOME: cats.filter((c) => c.type === "INCOME"),
    };
  }, [query.data?.options.categories]);

  const payeesList = query.data?.options.payees ?? [];
  const otherAccounts = useMemo(
    () =>
      (query.data?.options.accounts ?? []).filter(
        (a) => a.id !== query.data?.accountId,
      ),
    [query.data?.options.accounts, query.data?.accountId],
  );
  const openTransfers = query.data?.options.openTransfers ?? [];

  const counts = useMemo(() => {
    let dup = 0;
    let tr = 0;
    let uncat = 0;
    for (const r of rows) {
      if (r.isDuplicate) dup += 1;
      if (r.type === "TRANSFER") tr += 1;
      if (r.type !== "TRANSFER" && !r.categoryId && r.selected) uncat += 1;
    }
    return {
      all: rows.length,
      new: rows.length - dup,
      duplicates: dup,
      transfers: tr,
      uncategorized: uncat,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "new" && r.isDuplicate) return false;
      if (tab === "duplicates" && !r.isDuplicate) return false;
      if (tab === "transfers" && r.type !== "TRANSFER") return false;
      if (tab === "uncategorized" && (r.type === "TRANSFER" || r.categoryId != null)) {
        return false;
      }
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        (r.payeeName ?? "").toLowerCase().includes(q) ||
        (r.categoryName ?? "").toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q) ||
        r.date.includes(q)
      );
    });
  }, [rows, search, tab]);

  const updateRow = (uid: string, patch: Partial<ReconciledRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)),
    );
  };

  const handleTypeChange = (row: ReconciledRow, nextType: ReconciledRow["type"]) => {
    const abs = Math.abs(row.amountMinor);
    const nextAmount =
      nextType === "EXPENSE"
        ? -abs
        : nextType === "INCOME"
          ? abs
          : row.amountMinor;
    updateRow(row.uid, {
      type: nextType,
      amountMinor: nextAmount,
      ...(nextType === "TRANSFER"
        ? { categoryId: null, categoryName: null, spendingNature: null }
        : {
            transferMode: "UNMATCHED",
            matchedTransferRecordId: null,
            transferAccountId: null,
          }),
    });
  };

  const handleFlipTransferDirection = (row: ReconciledRow) => {
    if (isReadOnly) return;
    updateRow(row.uid, {
      amountMinor: -row.amountMinor,
      // Reset any existing link bound to the opposite sign
      ...(row.transferMode === "LINK_EXISTING"
        ? {
            transferMode: "UNMATCHED",
            matchedTransferRecordId: null,
            matchedTransferInfo: null,
          }
        : {}),
    });
  };

  const handleCategoryChange = (row: ReconciledRow, catIdStr: string) => {
    if (!catIdStr) {
      updateRow(row.uid, {
        categoryId: null,
        categoryName: null,
        categorySource: "NONE",
      });
      return;
    }
    const id = Number(catIdStr);
    const cat = (query.data?.options.categories ?? []).find((c) => c.id === id);
    updateRow(row.uid, {
      categoryId: id,
      categoryName: cat ? localizeCategoryName(cat, locale) : null,
      categorySource: "AI",
      spendingNature:
        row.type === "EXPENSE"
          ? (cat?.spendingNature ?? row.spendingNature)
          : null,
    });
  };

  const handlePayeeTextChange = (row: ReconciledRow, value: string) => {
    const trimmed = value.trim();
    const existing = payeesList.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    updateRow(row.uid, {
      payeeId: existing?.id ?? null,
      payeeName: value || null,
      payeeMatchKind: existing ? "EXACT" : trimmed ? "NEW" : "NONE",
    });
  };

  const handleTransferBindingChange = (row: ReconciledRow, encoded: string) => {
    if (encoded === "UNMATCHED") {
      updateRow(row.uid, {
        transferMode: "UNMATCHED",
        matchedTransferRecordId: null,
        transferAccountId: null,
      });
      return;
    }
    if (encoded.startsWith("LINK:")) {
      const recId = Number(encoded.slice(5));
      const match = openTransfers.find((t) => t.recordId === recId);
      updateRow(row.uid, {
        transferMode: "LINK_EXISTING",
        matchedTransferRecordId: recId,
        matchedTransferInfo: match
          ? {
              ...match,
              daysDiff: row.matchedTransferInfo?.daysDiff ?? 0,
            }
          : row.matchedTransferInfo,
        transferAccountId: null,
      });
      return;
    }
    if (encoded.startsWith("PAIR:")) {
      const accId = Number(encoded.slice(5));
      updateRow(row.uid, {
        transferMode: "CREATE_PAIR",
        matchedTransferRecordId: null,
        transferAccountId: accId,
      });
    }
  };

  const selectAllNew = () =>
    setRows((prev) => prev.map((r) => ({ ...r, selected: !r.isDuplicate })));
  const deselectAll = () =>
    setRows((prev) => prev.map((r) => ({ ...r, selected: false })));

  const isReadOnly = query.data?.status === "APPLIED";
  const currency = liveSummary?.accountCurrency ?? "USD";
  const isGap = liveSummary?.status === "GAP_DETECTED";
  const isMatched = liveSummary?.status === "MATCHED";
  const selectedCount = liveSummary?.selectedCount ?? 0;

  const content = (
    <div className="flex min-h-0 flex-1 flex-col">
      {query.isLoading || !liveSummary ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Slim sticky live-balance bar (~44px tall so mobile has full scroll area) */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <AccountSwatch
                type={liveSummary.accountType as AccountType}
                color={liveSummary.accountColor}
                size="sm"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="truncate font-semibold text-foreground">
                    {liveSummary.accountName}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <Money
                    value={liveSummary.projectedBalanceMinor / MINOR_UNIT}
                    currency={currency}
                    weight="semibold"
                    className={cn(
                      "text-[13px]",
                      isMatched && "text-positive",
                      isGap && "text-warning",
                    )}
                  />
                  {liveSummary.statementClosingBalanceMinor != null && (
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                      ({t("blocks.statementClosing")}:{" "}
                      <Money
                        value={
                          liveSummary.statementClosingBalanceMinor / MINOR_UNIT
                        }
                        currency={currency}
                      />
                      )
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {isMatched && (
                <span className="inline-flex items-center gap-1 rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-semibold text-positive">
                  <CheckCircle2 className="size-3" />
                  {t("blocks.balanceMatchedBadge")}
                </span>
              )}
              {isGap && liveSummary.discrepancyMinor != null && (
                <span className="num inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                  <AlertTriangle className="size-3" />
                  {liveSummary.discrepancyMinor > 0 ? "+" : ""}
                  {(liveSummary.discrepancyMinor / MINOR_UNIT).toFixed(2)}
                </span>
              )}
              {!isReadOnly && proposalId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={reconcileMutation.isPending}
                  onClick={() =>
                    reconcileMutation.mutate({
                      proposalId,
                      locale: locale === "en" ? "en" : "es",
                    })
                  }
                  aria-label={t("blocks.refreshBalance")}
                  title={t("blocks.refreshBalance")}
                  className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      reconcileMutation.isPending && "animate-spin",
                    )}
                  />
                </Button>
              )}
            </div>
          </div>

          {/* Unified smooth scroll area (details + filters + transaction rows scroll together on mobile!) */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-6">
            {/* Compact balance breakdown */}
            <div className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border bg-muted/25 text-center">
              <div className="px-2 py-2">
                <span className="block text-[11px] text-muted-foreground">
                  {t("blocks.dbBalance")}
                </span>
                <Money
                  value={liveSummary.dbBalanceAtPeriodEndMinor / MINOR_UNIT}
                  currency={currency}
                  weight="semibold"
                  className="text-[13px]"
                />
              </div>
              <div className="px-2 py-2">
                <span className="block text-[11px] text-muted-foreground">
                  {t("review.selectedDelta")}
                </span>
                <Money
                  value={liveSummary.selectedDeltaMinor / MINOR_UNIT}
                  currency={currency}
                  tone="movement"
                  kind={
                    liveSummary.selectedDeltaMinor >= 0 ? "INCOME" : "EXPENSE"
                  }
                  weight="semibold"
                  className="text-[13px]"
                />
              </div>
              <div className="px-2 py-2">
                <span className="block text-[11px] text-muted-foreground">
                  {liveSummary.statementClosingBalanceMinor != null
                    ? t("blocks.statementClosing")
                    : t("blocks.projectedBalance")}
                </span>
                <Money
                  value={
                    (liveSummary.statementClosingBalanceMinor ??
                      liveSummary.projectedBalanceMinor) / MINOR_UNIT
                  }
                  currency={currency}
                  weight="semibold"
                  className="text-[13px]"
                />
              </div>
            </div>

            {/* Balance status banner */}
            {isMatched && (
              <div className="flex items-center gap-2 rounded-xl bg-positive/10 px-3 py-2 text-[12px] font-medium text-positive">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{t("review.balanceExactMatch")}</span>
              </div>
            )}

            {isGap && liveSummary.discrepancyMinor != null && (
              <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-[12px]">
                <div className="flex items-start gap-2 text-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {t("review.balanceGapTitle", {
                        diff: `${liveSummary.discrepancyMinor > 0 ? "+" : ""}${(liveSummary.discrepancyMinor / MINOR_UNIT).toFixed(2)} ${currency}`,
                      })}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      {t("review.balanceGapHint")}
                    </p>
                  </div>
                </div>
                {!isReadOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-card px-2.5 py-1.5 text-[12px] font-medium text-foreground ring-1 ring-border">
                      <Checkbox
                        checked={includeAdjustment}
                        onCheckedChange={(v) => setIncludeAdjustment(Boolean(v))}
                      />
                      <span>{t("review.addBalanceAdjustment")}</span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onRequestUploadPrevious();
                      }}
                      className="h-8 rounded-lg bg-card text-[12px]"
                    >
                      <Upload className="mr-1.5 size-3.5" />
                      {t("blocks.uploadPrevious")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Search & single-row horizontal filter chips */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("review.searchPlaceholder")}
                  className="h-9 rounded-xl bg-card pl-9 text-[13px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-nowrap gap-1.5 overflow-x-auto pb-0.5">
                  {(
                    [
                      ["all", t("review.tabs.all", { count: String(counts.all) })],
                      ["new", t("review.tabs.new", { count: String(counts.new) })],
                      ...(counts.duplicates > 0
                        ? [
                            [
                              "duplicates",
                              t("review.tabs.duplicates", {
                                count: String(counts.duplicates),
                              }),
                            ] as const,
                          ]
                        : []),
                      ...(counts.transfers > 0
                        ? [
                            [
                              "transfers",
                              t("review.tabs.transfers", {
                                count: String(counts.transfers),
                              }),
                            ] as const,
                          ]
                        : []),
                      ...(counts.uncategorized > 0
                        ? [
                            [
                              "uncategorized",
                              t("review.tabs.uncategorized", {
                                count: String(counts.uncategorized),
                              }),
                            ] as const,
                          ]
                        : []),
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={cn(
                        "h-8 shrink-0 rounded-full border px-3 text-[12px] font-medium whitespace-nowrap transition-colors",
                        tab === key
                          ? "border-transparent bg-foreground text-background"
                          : "bg-card text-foreground hover:bg-accent",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {!isReadOnly && (
                  <div className="hidden shrink-0 items-center gap-2 text-[12px] sm:flex">
                    <button
                      type="button"
                      onClick={selectAllNew}
                      className="font-medium text-primary-text hover:underline"
                    >
                      {t("review.selectNew")}
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="font-medium text-muted-foreground hover:text-foreground"
                    >
                      {t("review.deselectAll")}
                    </button>
                  </div>
                )}
              </div>
              {!isReadOnly && (
                <div className="flex items-center justify-end gap-2 text-[12px] sm:hidden">
                  <button
                    type="button"
                    onClick={selectAllNew}
                    className="font-medium text-primary-text"
                  >
                    {t("review.selectNew")}
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="font-medium text-muted-foreground"
                  >
                    {t("review.deselectAll")}
                  </button>
                </div>
              )}
            </div>

            <datalist id="assistant-existing-payees">
              {payeesList.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>

            {/* Unmatched DB records in this period (helps instantly pinpoint discrepancies!) */}
            {runningBalances.unmatchedDbRecords.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-warning/30 bg-warning/5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDbProposalId(
                      showUnmatchedDb ? null : proposalId,
                    )
                  }
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-warning/10"
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <Database className="size-3.5 shrink-0 text-warning" />
                    <span className="truncate">
                      {t("review.unmatchedDbBanner", {
                        count: String(
                          runningBalances.unmatchedDbRecords.length,
                        ),
                      })}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="num rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                      {runningBalances.unmatchedDbNetMinor > 0 ? "+" : ""}
                      {formatMoneyText(
                        locale,
                        runningBalances.unmatchedDbNetMinor / MINOR_UNIT,
                        currency,
                        { tone: "plain" },
                      )}
                    </span>
                    {showUnmatchedDb ? (
                      <ChevronUp className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    )}
                  </span>
                </button>
                {showUnmatchedDb && (
                  <div className="border-t border-warning/20 bg-card/60 px-3 py-2">
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      {t("review.unmatchedDbHint")}
                    </p>
                    <div className="max-h-44 divide-y overflow-y-auto rounded-lg border bg-card">
                      {[...runningBalances.unmatchedDbRecords]
                        .reverse()
                        .map((rec) => (
                          <button
                            key={rec.id}
                            type="button"
                            onClick={() => setInspectRecordId(rec.id)}
                            className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-accent/60"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="num shrink-0 text-[11px] text-muted-foreground">
                                {rec.date}
                              </span>
                              <span className="truncate font-medium text-foreground">
                                {rec.label}
                              </span>
                            </div>
                            <span className="flex shrink-0 items-center gap-1">
                              <span
                                className={cn(
                                  "num font-semibold",
                                  rec.amountMinor > 0
                                    ? "text-positive"
                                    : rec.amountMinor < 0
                                      ? "text-destructive"
                                      : "text-muted-foreground",
                                )}
                              >
                                {rec.amountMinor > 0 ? "+" : ""}
                                {formatMoneyText(
                                  locale,
                                  rec.amountMinor / MINOR_UNIT,
                                  currency,
                                  { tone: "plain" },
                                )}
                              </span>
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {filteredRows.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted-foreground">
                {t("review.noMatchingRows")}
              </p>
            ) : (
              <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                {runningBalances.trailingDbCount > 0 && (
                  <div className="flex items-center justify-between gap-2 bg-warning/5 px-3.5 py-2 text-[11.5px]">
                    <button
                      type="button"
                      onClick={() => {
                        if (runningBalances.trailingDbRecords.length === 1) {
                          setInspectRecordId(
                            runningBalances.trailingDbRecords[0]!.id,
                          );
                        } else {
                          setExpandedDbProposalId(proposalId);
                        }
                      }}
                      className="flex items-center gap-1.5 text-left font-medium text-warning hover:underline"
                    >
                      <Database className="size-3 shrink-0" />
                      <span>
                        {t("review.trailingDbNotice", {
                          count: String(runningBalances.trailingDbCount),
                          delta: `${runningBalances.trailingDbDeltaMinor > 0 ? "+" : ""}${formatMoneyText(locale, runningBalances.trailingDbDeltaMinor / MINOR_UNIT, currency, { tone: "plain" })}`,
                        })}
                      </span>
                      <ChevronRight className="size-3 shrink-0" />
                    </button>
                    <span className="num shrink-0 font-semibold text-foreground">
                      {formatMoneyText(
                        locale,
                        runningBalances.finalBalanceMinor / MINOR_UNIT,
                        currency,
                        { tone: "plain" },
                      )}
                    </span>
                  </div>
                )}

                {filteredRows.map((row) => {
                  const typeCats =
                    row.type === "INCOME"
                      ? categoriesByType.INCOME
                      : categoriesByType.EXPENSE;
                  const activeCat = typeCats.find(
                    (c) => c.id === row.categoryId,
                  );

                  const transferBindingValue =
                    row.transferMode === "LINK_EXISTING" &&
                    row.matchedTransferRecordId
                      ? `LINK:${row.matchedTransferRecordId}`
                      : row.transferMode === "CREATE_PAIR" &&
                          row.transferAccountId
                        ? `PAIR:${row.transferAccountId}`
                        : "UNMATCHED";

                  const compatibleOpenTransfers = openTransfers.filter(
                    (ot) =>
                      ot.currency === currency &&
                      Math.sign(ot.amountMinor) === -Math.sign(row.amountMinor),
                  );

                  const rowBalance = runningBalances.byUid[row.uid] ?? null;
                  const stmtBalDiffMinor =
                    rowBalance && rowBalance.statementBalanceAfterMinor != null
                      ? rowBalance.projectedBalanceAfterMinor -
                        rowBalance.statementBalanceAfterMinor
                      : null;
                  const hasStmtMismatch =
                    stmtBalDiffMinor != null && stmtBalDiffMinor !== 0;

                  const runningBalanceTitle = rowBalance
                    ? [
                        t("review.runningBalanceLabel"),
                        rowBalance.statementBalanceAfterMinor != null
                          ? t("review.statementBalanceLabel", {
                              balance: formatMoneyText(
                                locale,
                                rowBalance.statementBalanceAfterMinor /
                                  MINOR_UNIT,
                                currency,
                                { tone: "plain" },
                              ),
                            })
                          : null,
                        hasStmtMismatch
                          ? t("review.statementBalanceDiff", {
                              diff: `${stmtBalDiffMinor > 0 ? "+" : ""}${formatMoneyText(locale, stmtBalDiffMinor / MINOR_UNIT, currency, { tone: "plain" })}`,
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : undefined;

                  const renderSignedAmount = () =>
                    row.type === "TRANSFER" ? (
                      <span className="num text-[15px] font-semibold whitespace-nowrap text-foreground/85">
                        {row.amountMinor > 0 ? "+" : ""}
                        {formatMoneyText(
                          locale,
                          row.amountMinor / MINOR_UNIT,
                          currency,
                          { tone: "plain" },
                        )}
                      </span>
                    ) : (
                      <Money
                        value={row.amountMinor / MINOR_UNIT}
                        currency={currency}
                        kind={row.type}
                        tone="movement"
                        size="row"
                        weight="semibold"
                      />
                    );

                  const renderRunningBalanceLine = () =>
                    rowBalance ? (
                      <div className="mt-0.5 flex flex-col items-end">
                        <span
                          title={runningBalanceTitle}
                          className={cn(
                            "num text-[11.5px] leading-tight whitespace-nowrap",
                            hasStmtMismatch
                              ? "font-medium text-warning"
                              : "text-muted-foreground/80",
                          )}
                        >
                          {formatMoneyText(
                            locale,
                            rowBalance.projectedBalanceAfterMinor / MINOR_UNIT,
                            currency,
                            { tone: "plain" },
                          )}
                        </span>
                        {hasStmtMismatch &&
                          rowBalance.statementBalanceAfterMinor != null && (
                            <span className="num text-[10.5px] leading-tight whitespace-nowrap text-warning/90">
                              vs{" "}
                              {formatMoneyText(
                                locale,
                                rowBalance.statementBalanceAfterMinor /
                                  MINOR_UNIT,
                                currency,
                                { tone: "plain" },
                              )}
                            </span>
                          )}
                      </div>
                    ) : null;

                  return (
                    <div
                      key={row.uid}
                      className={cn(
                        "flex flex-col gap-2.5 p-3.5 transition-colors sm:flex-row sm:items-start sm:gap-3",
                        !row.selected && "bg-muted/25 opacity-60",
                      )}
                    >
                      {/* Checkbox + Date/Time + Mobile Amount/Balance */}
                      <div className="flex items-start justify-between gap-2 sm:pt-1">
                        <div className="flex items-start gap-2.5">
                          <Checkbox
                            disabled={isReadOnly}
                            checked={row.selected}
                            onCheckedChange={(v) =>
                              updateRow(row.uid, { selected: Boolean(v) })
                            }
                            aria-label={row.description}
                            className="mt-0.5"
                          />
                          <div className="sm:w-20">
                            <span className="num block text-[12px] font-medium text-muted-foreground">
                              {row.date}
                            </span>
                            {row.time && (
                              <span className="num block text-[11px] text-muted-foreground/75">
                                {row.time}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Mobile amount + live running balance */}
                        <div className="text-right sm:hidden">
                          {renderSignedAmount()}
                          {renderRunningBalanceLine()}
                        </div>
                      </div>

                      {/* Main editable fields */}
                      <div className="min-w-0 flex-1 space-y-2">
                        {/* Row 1: Description + Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-foreground">
                            {row.description}
                          </span>
                          {row.isDuplicate &&
                            (row.duplicateRecordId != null ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setInspectRecordId(row.duplicateRecordId)
                                }
                                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              >
                                <Check className="size-3" />
                                {t("review.alreadyRecorded")}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                <Check className="size-3" />
                                {t("review.alreadyRecorded")}
                              </span>
                            ))}
                          {row.type !== "TRANSFER" &&
                            (row.payeeMatchKind === "EXACT" ||
                              row.payeeMatchKind === "FUZZY" ||
                              row.payeeMatchKind === "HISTORY") && (
                              <span className="inline-flex items-center rounded-full bg-positive/12 px-2 py-0.5 text-[11px] font-medium text-positive">
                                {t("review.payeeExisting")}
                              </span>
                            )}
                          {row.type !== "TRANSFER" &&
                            row.payeeMatchKind === "NEW" && (
                              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-text">
                                {t("review.payeeNew")}
                              </span>
                            )}
                          {row.type === "TRANSFER" && !isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleFlipTransferDirection(row)}
                              title={t("review.flipTransferDirection")}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-accent",
                                row.amountMinor > 0
                                  ? "border-positive/30 bg-positive/10 text-positive"
                                  : "border-border bg-background text-muted-foreground",
                              )}
                            >
                              <ArrowLeftRight className="size-2.5" />
                              {row.amountMinor > 0
                                ? t("review.transferInShort")
                                : t("review.transferOutShort")}
                            </button>
                          )}
                          {row.type === "TRANSFER" &&
                            row.transferMode === "LINK_EXISTING" &&
                            row.matchedTransferInfo && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary-text">
                                <Link2 className="size-3" />
                                {t("review.linkedTransferBadge", {
                                  account: row.matchedTransferInfo.accountName,
                                  days: String(row.matchedTransferInfo.daysDiff),
                                })}
                              </span>
                            )}
                          {row.type === "TRANSFER" &&
                            row.transferMode === "UNMATCHED" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                <ArrowLeftRight className="size-3" />
                                {t("review.unmatchedTransferBadge")}
                              </span>
                            )}
                          {rowBalance && rowBalance.extraDbCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (rowBalance.extraDbRecords.length === 1) {
                                  setInspectRecordId(
                                    rowBalance.extraDbRecords[0]!.id,
                                  );
                                } else {
                                  setExpandedExtraRowUid((cur) =>
                                    cur === row.uid ? null : row.uid,
                                  );
                                }
                              }}
                              className="num inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning transition-colors hover:bg-warning/25"
                            >
                              <Database className="size-2.5" />
                              {t("review.extraDbBeforeRow", {
                                count: String(rowBalance.extraDbCount),
                                delta: `${rowBalance.extraDbDeltaMinor > 0 ? "+" : ""}${formatMoneyText(locale, rowBalance.extraDbDeltaMinor / MINOR_UNIT, currency, { tone: "plain" })}`,
                              })}
                              {rowBalance.extraDbRecords.length > 1 ? (
                                expandedExtraRowUid === row.uid ? (
                                  <ChevronUp className="size-3" />
                                ) : (
                                  <ChevronDown className="size-3" />
                                )
                              ) : (
                                <ChevronRight className="size-3" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Inline picker when multiple unmatched Firecent DB records landed before this row */}
                        {rowBalance &&
                          rowBalance.extraDbRecords.length > 1 &&
                          expandedExtraRowUid === row.uid && (
                            <div className="divide-y overflow-hidden rounded-xl border border-warning/30 bg-warning/5">
                              {[...rowBalance.extraDbRecords]
                                .reverse()
                                .map((rec) => (
                                  <button
                                    key={rec.id}
                                    type="button"
                                    onClick={() => setInspectRecordId(rec.id)}
                                    className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-warning/15"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="num shrink-0 text-[11px] text-muted-foreground">
                                        {rec.date}
                                      </span>
                                      <span className="truncate font-medium text-foreground">
                                        {rec.label}
                                      </span>
                                    </div>
                                    <span className="flex shrink-0 items-center gap-1">
                                      <span
                                        className={cn(
                                          "num font-semibold",
                                          rec.amountMinor > 0
                                            ? "text-positive"
                                            : rec.amountMinor < 0
                                              ? "text-destructive"
                                              : "text-muted-foreground",
                                        )}
                                      >
                                        {rec.amountMinor > 0 ? "+" : ""}
                                        {formatMoneyText(
                                          locale,
                                          rec.amountMinor / MINOR_UNIT,
                                          currency,
                                          { tone: "plain" },
                                        )}
                                      </span>
                                      <ChevronRight className="size-3.5 text-muted-foreground" />
                                    </span>
                                  </button>
                                ))}
                            </div>
                          )}

                        {/* Row 2: Inline controls grid */}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                          {/* Type select */}
                          <select
                            disabled={isReadOnly}
                            value={row.type}
                            onChange={(e) =>
                              handleTypeChange(
                                row,
                                e.target.value as ReconciledRow["type"],
                              )
                            }
                            aria-label={t("review.typeLabel")}
                            className="h-8 rounded-lg border bg-background px-2 text-[12px] font-medium outline-none focus:border-primary sm:col-span-3"
                          >
                            <option value="EXPENSE">{t("review.types.EXPENSE")}</option>
                            <option value="INCOME">{t("review.types.INCOME")}</option>
                            <option value="TRANSFER">{t("review.types.TRANSFER")}</option>
                          </select>

                          {row.type !== "TRANSFER" ? (
                            <>
                              {/* Payee input with existing DB datalist */}
                              <input
                                disabled={isReadOnly}
                                list="assistant-existing-payees"
                                value={row.payeeName ?? ""}
                                onChange={(e) =>
                                  handlePayeeTextChange(row, e.target.value)
                                }
                                placeholder={t("review.payeePlaceholder")}
                                aria-label={t("review.payeeLabel")}
                                className="h-8 rounded-lg border bg-background px-2.5 text-[12px] outline-none focus:border-primary sm:col-span-4"
                              />

                              {/* Category select */}
                              <div className="relative flex items-center sm:col-span-5">
                                {activeCat && (
                                  <span className="pointer-events-none absolute left-2">
                                    <CategoryIcon
                                      icon={activeCat.icon}
                                      color={activeCat.color}
                                      size="sm"
                                      className="size-5 rounded-md"
                                    />
                                  </span>
                                )}
                                <select
                                  disabled={isReadOnly}
                                  value={row.categoryId ?? ""}
                                  onChange={(e) =>
                                    handleCategoryChange(row, e.target.value)
                                  }
                                  aria-label={t("review.categoryLabel")}
                                  className={cn(
                                    "h-8 w-full rounded-lg border bg-background pr-2 text-[12px] outline-none focus:border-primary",
                                    activeCat ? "pl-8" : "pl-2.5",
                                  )}
                                >
                                  <option value="">
                                    {t("review.uncategorized")}
                                  </option>
                                  {typeCats.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {localizeCategoryName(cat, locale)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </>
                          ) : (
                            /* Transfer linking selector */
                            <select
                              disabled={isReadOnly}
                              value={transferBindingValue}
                              onChange={(e) =>
                                handleTransferBindingChange(row, e.target.value)
                              }
                              aria-label={t("review.transferLinkLabel")}
                              className="h-8 rounded-lg border bg-background px-2.5 text-[12px] outline-none focus:border-primary sm:col-span-9"
                            >
                              <option value="UNMATCHED">
                                {t("review.transferOptionUnmatched")}
                              </option>
                              {compatibleOpenTransfers.length > 0 && (
                                <optgroup
                                  label={t("review.transferGroupLinkPending")}
                                >
                                  {compatibleOpenTransfers.map((ot) => (
                                    <option
                                      key={ot.recordId}
                                      value={`LINK:${ot.recordId}`}
                                    >
                                      {ot.accountName} · {ot.date} ·{" "}
                                      {(Math.abs(ot.amountMinor) / MINOR_UNIT).toFixed(2)}{" "}
                                      {ot.currency}
                                      {ot.note ? ` (${ot.note.slice(0, 24)})` : ""}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {otherAccounts.length > 0 && (
                                <optgroup
                                  label={t("review.transferGroupCreatePair")}
                                >
                                  {otherAccounts.map((acc) => (
                                    <option key={acc.id} value={`PAIR:${acc.id}`}>
                                      {t("review.transferPairWith", {
                                        account: acc.name,
                                      })}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          )}
                        </div>

                        {/* Row 3: Spending nature selector for expenses + source badge */}
                        {row.type === "EXPENSE" && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {NATURES.map((nat: Nature) => {
                              const active = row.spendingNature === nat;
                              return (
                                <button
                                  key={nat}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() =>
                                    updateRow(row.uid, {
                                      spendingNature: active ? null : nat,
                                    })
                                  }
                                  className={cn(
                                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors",
                                    active
                                      ? "border-foreground/30 bg-accent text-foreground"
                                      : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  <NatureSwatch nature={nat} />
                                  {tNature(
                                    nat === "DEBO"
                                      ? "owe"
                                      : nat === "NECESITO"
                                        ? "need"
                                        : "want",
                                  )}
                                </button>
                              );
                            })}
                            {row.categorySource === "PAYEE_HISTORY" && (
                              <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Tag className="size-3" />
                                {t("review.fromHistory")}
                              </span>
                            )}
                            {row.categorySource === "AI" && (
                              <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Sparkles className="size-3" />
                                {t("review.fromAi", { aiName: AI_ASSISTANT_NAME })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Desktop amount + live running balance */}
                      <div className="hidden shrink-0 pt-0.5 text-right sm:block sm:w-28">
                        {renderSignedAmount()}
                        {renderRunningBalanceLine()}
                      </div>
                    </div>
                  );
                })}

                {/* Opening balance anchor row at bottom of timeline */}
                {rows.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/35 px-3.5 py-2.5 text-[12px]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground">
                      <span className="font-medium">
                        {t("review.openingBalanceRow", {
                          date:
                            query.data?.runningBalanceLedger?.periodStartDate ??
                            rows[rows.length - 1]!.date,
                        })}
                      </span>
                      {liveSummary.statementOpeningBalanceMinor != null && (
                        <span
                          className={cn(
                            "num text-[11px]",
                            liveSummary.statementOpeningBalanceMinor !==
                              runningBalances.openingDbBalanceMinor
                              ? "font-medium text-warning"
                              : "text-positive",
                          )}
                        >
                          ·{" "}
                          {t("review.statementOpeningCompare", {
                            balance: formatMoneyText(
                              locale,
                              liveSummary.statementOpeningBalanceMinor /
                                MINOR_UNIT,
                              currency,
                              { tone: "plain" },
                            ),
                          })}
                        </span>
                      )}
                    </div>
                    <span className="num font-semibold text-foreground">
                      {formatMoneyText(
                        locale,
                        runningBalances.openingDbBalanceMinor / MINOR_UNIT,
                        currency,
                        { tone: "plain" },
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky footer with mobile safe-area inset */}
          <div className="flex shrink-0 flex-col gap-2 border-t bg-card px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-3">
            <div className="text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t("review.footerSelected", {
                  selected: String(selectedCount),
                  total: String(rows.length),
                })}
              </span>
              {liveSummary.transferMatchCount > 0 && (
                <span>
                  {" "}
                  ·{" "}
                  {t("review.footerLinks", {
                    count: String(liveSummary.transferMatchCount),
                  })}
                </span>
              )}
              {includeAdjustment &&
                isGap &&
                liveSummary.discrepancyMinor != null && (
                  <span className="text-warning">
                    {" "}
                    · {t("review.footerPlusAdjustment")}
                  </span>
                )}
            </div>

            {isReadOnly ? (
              <Button type="button" variant="outline" onClick={onClose}>
                {t("review.close")}
              </Button>
            ) : (
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    saveDraftMutation.isPending || applyMutation.isPending
                  }
                  onClick={() => {
                    if (!proposalId) return;
                    saveDraftMutation.mutate({ proposalId, rows });
                  }}
                  className="h-10 rounded-xl px-3.5 text-[13px]"
                >
                  {t("review.saveDraft")}
                </Button>
                <Button
                  type="button"
                  disabled={
                    applyMutation.isPending ||
                    (selectedCount === 0 && !includeAdjustment)
                  }
                  onClick={() => {
                    if (!proposalId) return;
                    applyMutation.mutate({
                      proposalId,
                      rows,
                      includeBalanceAdjustment: includeAdjustment,
                    });
                  }}
                  className="h-10 flex-1 rounded-xl px-4 text-[13px] font-semibold sm:flex-none"
                >
                  {applyMutation.isPending && (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  )}
                  {applyMutation.isPending
                    ? t("review.importing")
                    : t("review.importCta", { count: String(selectedCount) })}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const detailSheet = (
    <TransactionDetailSheet
      recordId={activeInspectRecordId}
      onClose={() => setInspectRecordId(null)}
    />
  );

  if (isDesktop) {
    return (
      <>
        <DialogPrimitive.Root
          open={open}
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-[38] bg-[#0b1220]/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-[39] flex h-[88dvh] w-[min(980px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-xl outline-none transition duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-6">
                <DialogPrimitive.Title className="truncate text-[17px] font-semibold">
                  {t("review.title")}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  render={
                    <Button
                      variant="ghost"
                      size="icon-touch"
                      aria-label={t("review.close")}
                    />
                  }
                >
                  <X aria-hidden />
                </DialogPrimitive.Close>
              </div>
              {content}
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
        {detailSheet}
      </>
    );
  }

  return (
    <>
      <DrawerPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-[38] bg-[#0b1220]/50" />
          <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-[39] mx-auto flex h-[94dvh] max-w-[560px] flex-col overflow-hidden rounded-t-3xl bg-card text-card-foreground shadow-xl outline-none">
            <div
              aria-hidden
              className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30"
            />
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
              <DrawerPrimitive.Title className="truncate text-[16px] font-semibold">
                {t("review.title")}
              </DrawerPrimitive.Title>
              <DrawerPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon-touch"
                  aria-label={t("review.close")}
                >
                  <X aria-hidden />
                </Button>
              </DrawerPrimitive.Close>
            </div>
            {content}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
      {detailSheet}
    </>
  );
}
