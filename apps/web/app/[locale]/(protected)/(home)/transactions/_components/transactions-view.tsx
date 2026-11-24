"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Download,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  PageHeader,
  StateBlock,
  TransactionRowSkeleton,
  localizeCategoryName,
} from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { useShell } from "../../_components/shell/shell-context";
import {
  DatePeriodBar,
  currentMonthStr,
  parsePeriodFromParams,
  periodExportSlug,
  resolvePeriodQuery,
  type DatePeriod,
} from "./date-period-bar";
import { TransactionDetailSheet } from "./transaction-detail-sheet";
import { VirtualizedTransactions } from "./virtualized-transactions";

type ChipKey = "all" | "EXPENSE" | "INCOME" | "TRANSFER";

const PAGE_SIZE = 100;

export function TransactionsView() {
  const locale = useLocale();
  const t = useTranslations("TransactionsV2");
  const tShell = useTranslations("Shell");
  const searchParams = useSearchParams();
  const { openAddTransaction } = useShell();
  const utils = trpc.useUtils();

  // Client-side filter state initialized from URL; synced silently with
  // history.replaceState so changing period/chips/search NEVER triggers a full
  // Next.js RSC round-trip.
  const [period, setPeriod] = useState<DatePeriod>(() =>
    parsePeriodFromParams(new URLSearchParams(searchParams.toString())),
  );
  const [chip, setChip] = useState<ChipKey>(
    () => (searchParams.get("chip") as ChipKey) || "all",
  );
  const [accountId, setAccountId] = useState<number | undefined>(() => {
    const v = searchParams.get("account");
    return v ? Number(v) || undefined : undefined;
  });
  const [categoryId, setCategoryId] = useState<number | undefined>(() => {
    const v = searchParams.get("category");
    return v ? Number(v) || undefined : undefined;
  });
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("q") || "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [selection, setSelection] = useState<{ key: string; ids: number[] }>({
    key: "",
    ids: [],
  });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (period.kind === "month") {
      if (period.month !== currentMonthStr()) {
        params.set("month", period.month);
      }
    } else if (period.kind === "custom") {
      params.set("period", "custom");
      params.set("from", period.from);
      params.set("to", period.to);
    } else {
      params.set("period", period.kind);
    }
    if (chip !== "all") params.set("chip", chip);
    if (accountId) params.set("account", String(accountId));
    if (categoryId) params.set("category", String(categoryId));
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [period, chip, accountId, categoryId, debouncedSearch]);

  const periodQuery = useMemo(() => resolvePeriodQuery(period), [period]);

  const queryFilter = useMemo(() => {
    const min = Number.parseFloat(minAmount);
    const max = Number.parseFloat(maxAmount);
    return {
      ...periodQuery,
      search: debouncedSearch.trim() || undefined,
      type:
        chip === "EXPENSE" || chip === "INCOME" || chip === "TRANSFER"
          ? chip
          : undefined,
      accountId,
      categoryId,
      minAmount: Number.isFinite(min) && min >= 0 ? min : undefined,
      maxAmount: Number.isFinite(max) && max >= 0 ? max : undefined,
    };
  }, [
    periodQuery,
    debouncedSearch,
    chip,
    accountId,
    categoryId,
    minAmount,
    maxAmount,
  ]);

  const filterKey = useMemo(() => JSON.stringify(queryFilter), [queryFilter]);
  const selectedIds = useMemo(
    () => (selection.key === filterKey ? selection.ids : []),
    [selection, filterKey],
  );
  const clearSelection = useCallback(
    () => setSelection({ key: filterKey, ids: [] }),
    [filterKey],
  );

  const activeFilterCount =
    (accountId ? 1 : 0) +
    (categoryId ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0);

  const hasAnyFilter =
    activeFilterCount > 0 || chip !== "all" || Boolean(searchInput.trim());

  const options = trpc.records.formOptions.useQuery();
  const summary = trpc.records.monthSummary.useQuery(queryFilter, {
    placeholderData: keepPreviousData,
  });
  const list = trpc.records.list.useInfiniteQuery(
    { ...queryFilter, limit: PAGE_SIZE },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      placeholderData: keepPreviousData,
    },
  );

  const bulkDelete = trpc.records.bulkDelete.useMutation({
    onSuccess: async (res) => {
      clearSelection();
      await Promise.all([
        utils.records.list.invalidate(),
        utils.records.monthSummary.invalidate(),
        utils.accounts.list.invalidate(),
        utils.dashboard.home.invalidate(),
      ]);
      firecentToast(t("bulkDeleted", { count: String(res.count) }));
    },
  });

  const rows = useMemo(
    () => list.data?.pages.flatMap((p) => p.items) ?? [],
    [list.data],
  );
  const totalCount =
    list.data?.pages[0]?.total ?? summary.data?.count ?? null;

  const activeAccount = useMemo(
    () => (options.data?.accounts ?? []).find((a) => a.id === accountId),
    [options.data?.accounts, accountId],
  );
  const activeCategory = useMemo(
    () => (options.data?.categories ?? []).find((c) => c.id === categoryId),
    [options.data?.categories, categoryId],
  );

  async function handleExportCsv() {
    const res = await utils.records.exportCsv.fetch(queryFilter);
    const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firecent-transactions-${periodExportSlug(period)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    firecentToast(t("exported", { count: String(res.count) }));
  }

  function clearAllFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setMinAmount("");
    setMaxAmount("");
    setChip("all");
    setAccountId(undefined);
    setCategoryId(undefined);
  }

  const toggleRowSelection = useCallback(
    (id: number) => {
      setSelection((prev) => {
        const current = prev.key === filterKey ? prev.ids : [];
        return {
          key: filterKey,
          ids: current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id],
        };
      });
    },
    [filterKey],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelection({
        key: filterKey,
        ids: checked ? rows.map((r) => r.id) : [],
      });
    },
    [filterKey, rows],
  );

  const handleLoadMore = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) {
      void list.fetchNextPage();
    }
  }, [list]);

  const layoutKey = `${selectedIds.length > 0 ? 1 : 0}-${activeFilterCount}-${period.kind}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        desktopActions={
          <>
            <Button
              variant="outline"
              size="touch"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
            >
              <Download className="size-4" aria-hidden />
              <span>{t("exportCsv")}</span>
            </Button>
            <Button size="touch" onClick={() => openAddTransaction()}>
              <Plus className="size-4" aria-hidden />
              <span>{tShell("addTransaction")}</span>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 px-5 lg:px-0">
        {/* Search + Filter trigger */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              size="touch"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-10 pr-9"
            />
            {searchInput && (
              <button
                type="button"
                aria-label={t("clearSearch")}
                onClick={() => {
                  setSearchInput("");
                  setDebouncedSearch("");
                }}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="icon-touch"
            aria-label={t("filters.title")}
            onClick={() => setFiltersOpen(true)}
            className="relative shrink-0"
          >
            <SlidersHorizontal aria-hidden />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Type quick chips (no category clutter) + removable secondary filter pills */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
          {(["all", "EXPENSE", "INCOME", "TRANSFER"] as ChipKey[]).map((k) => (
            <Toggle
              key={k}
              variant="chip"
              pressed={chip === k}
              onPressedChange={() => setChip(k)}
              className="shrink-0"
            >
              <span>{t(`chips.${k}`)}</span>
            </Toggle>
          ))}

          {activeAccount && (
            <button
              type="button"
              onClick={() => setAccountId(undefined)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 text-[13px] font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <span className="truncate">{activeAccount.name}</span>
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          )}

          {activeCategory && (
            <button
              type="button"
              onClick={() => setCategoryId(undefined)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 text-[13px] font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <span className="truncate">
                {localizeCategoryName(activeCategory, locale)}
              </span>
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          )}
        </div>

        {/* Date period selector & cashflow bar */}
        <DatePeriodBar
          period={period}
          onChange={setPeriod}
          summary={summary.data}
        />

        {/* Desktop bulk selection bar */}
        {selectedIds.length > 0 && (
          <div className="hidden items-center justify-between rounded-2xl border bg-foreground px-4 py-2.5 text-background lg:flex">
            <span className="text-[14px] font-medium">
              {t("selectedCount", { count: String(selectedIds.length) })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-background hover:bg-background/15 hover:text-background"
              >
                {t("clearSelection")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={bulkDelete.isPending}
                onClick={() => bulkDelete.mutate({ ids: selectedIds })}
              >
                <Trash2 className="size-4" aria-hidden />
                <span>{t("deleteSelected")}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Loading / Error / Empty / Virtualized Data */}
        {list.isPending ? (
          <div className="flex flex-col gap-5 pt-2">
            {[0, 1].map((g) => (
              <div key={g} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Card variant="plain" className="divide-y overflow-hidden">
                  <TransactionRowSkeleton />
                  <TransactionRowSkeleton />
                  <TransactionRowSkeleton />
                </Card>
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => list.refetch() }}
          />
        ) : rows.length === 0 ? (
          hasAnyFilter ? (
            <StateBlock
              kind="no-results"
              action={{ label: t("clearFilters"), onClick: clearAllFilters }}
            />
          ) : (
            <StateBlock
              kind="empty"
              icon={Receipt}
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={{
                label: tShell("addTransaction"),
                onClick: () => openAddTransaction(),
              }}
            />
          )
        ) : (
          <div
            className={cn(
              "transition-opacity duration-150",
              list.isPlaceholderData && "pointer-events-none opacity-60",
            )}
          >
            <VirtualizedTransactions
              rows={rows}
              total={totalCount}
              byDay={summary.data?.byDay}
              summaryCurrency={summary.data?.currency}
              selectedIds={selectedIds}
              onToggleSelect={toggleRowSelection}
              onSelectAll={handleSelectAll}
              onRowClick={setDetailId}
              hasNextPage={Boolean(list.hasNextPage)}
              isFetchingNextPage={list.isFetchingNextPage}
              onLoadMore={handleLoadMore}
              layoutKey={layoutKey}
            />
          </div>
        )}
      </div>

      {/* Filters sheet */}
      <ResponsiveSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t("filters.title")}
        closeLabel={tShell("close")}
        desktop="dialog"
      >
        <div className="flex flex-col gap-4 px-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("filters.account")}
            </label>
            <select
              value={accountId ?? ""}
              onChange={(e) =>
                setAccountId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="h-12 w-full rounded-xl border bg-card px-3.5 text-[15px] outline-none"
            >
              <option value="">{t("filters.allAccounts")}</option>
              {(options.data?.accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("filters.category")}
            </label>
            <select
              value={categoryId ?? ""}
              onChange={(e) =>
                setCategoryId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="h-12 w-full rounded-xl border bg-card px-3.5 text-[15px] outline-none"
            >
              <option value="">{t("filters.allCategories")}</option>
              {(options.data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? "↳ " : ""}
                  {localizeCategoryName(c, locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                {t("filters.minAmount")}
              </label>
              <Input
                size="touch"
                type="number"
                min="0"
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                {t("filters.maxAmount")}
              </label>
              <Input
                size="touch"
                type="number"
                min="0"
                step="0.01"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="∞"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="touch"
              onClick={clearAllFilters}
              className="flex-1"
            >
              {t("clearFilters")}
            </Button>
            <Button
              size="touch"
              onClick={() => setFiltersOpen(false)}
              className="flex-1"
            >
              {t("filters.showCount", { count: String(summary.data?.count ?? 0) })}
            </Button>
          </div>
        </div>
      </ResponsiveSheet>

      {/* Transaction detail sheet */}
      <TransactionDetailSheet
        recordId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
