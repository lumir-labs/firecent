"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { keepPreviousData } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
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
  CategoryIcon,
  DayHeader,
  Money,
  NatureSwatch,
  PageHeader,
  StateBlock,
  TransactionRow,
  TransactionRowSkeleton,
} from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { useShell } from "../../_components/shell/shell-context";
import { TransactionDetailSheet } from "./transaction-detail-sheet";

type ChipKey = "all" | "DEBO" | "NECESITO" | "QUIERO" | "INCOME" | "TRANSFER";

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function TransactionsView() {
  const t = useTranslations("TransactionsV2");
  const tShell = useTranslations("Shell");
  const searchParams = useSearchParams();
  const { openAddTransaction } = useShell();
  const utils = trpc.useUtils();

  // Client-side filter state initialized from URL; synced silently with
  // history.replaceState so changing month/chips/search NEVER triggers a full
  // Next.js RSC round-trip.
  const [month, setMonth] = useState(
    () => searchParams.get("month") || currentMonthStr(),
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (month && month !== currentMonthStr()) params.set("month", month);
    if (chip !== "all") params.set("chip", chip);
    if (accountId) params.set("account", String(accountId));
    if (categoryId) params.set("category", String(categoryId));
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [month, chip, accountId, categoryId, debouncedSearch]);

  const queryFilter = useMemo(() => {
    const min = Number.parseFloat(minAmount);
    const max = Number.parseFloat(maxAmount);
    return {
      month,
      search: debouncedSearch.trim() || undefined,
      type:
        chip === "INCOME" || chip === "TRANSFER"
          ? chip
          : undefined,
      natures:
        chip === "DEBO" || chip === "NECESITO" || chip === "QUIERO"
          ? ([chip] as ("DEBO" | "NECESITO" | "QUIERO")[])
          : undefined,
      accountId,
      categoryId,
      minAmount: Number.isFinite(min) && min >= 0 ? min : undefined,
      maxAmount: Number.isFinite(max) && max >= 0 ? max : undefined,
    };
  }, [month, debouncedSearch, chip, accountId, categoryId, minAmount, maxAmount]);

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
    { ...queryFilter, limit: 60 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      placeholderData: keepPreviousData,
    },
  );

  const bulkDelete = trpc.records.bulkDelete.useMutation({
    onSuccess: async (res) => {
      setSelectedIds([]);
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

  const groupedByDay = useMemo(() => {
    const groups: { date: string; items: typeof rows }[] = [];
    for (const r of rows) {
      const key = r.date ?? "undated";
      const last = groups[groups.length - 1];
      if (last && last.date === key) {
        last.items.push(r);
      } else {
        groups.push({ date: key, items: [r] });
      }
    }
    return groups;
  }, [rows]);

  async function handleExportCsv() {
    const res = await utils.records.exportCsv.fetch(queryFilter);
    const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firecent-transactions-${month}.csv`;
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

  function toggleRowSelection(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

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

        {/* Nature & Type chips */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
          {(
            [
              "all",
              "DEBO",
              "NECESITO",
              "QUIERO",
              "INCOME",
              "TRANSFER",
            ] as ChipKey[]
          ).map((k) => (
            <Toggle
              key={k}
              variant="chip"
              pressed={chip === k}
              onPressedChange={() => setChip(k)}
              className="shrink-0 gap-1.5"
            >
              {(k === "DEBO" || k === "NECESITO" || k === "QUIERO") && (
                <NatureSwatch nature={k} />
              )}
              <span>{t(`chips.${k}`)}</span>
            </Toggle>
          ))}
        </div>

        {/* Month bar with In / Out */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label={t("prevMonth")}
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-[130px] text-center text-[15px] font-semibold capitalize">
              {formatMonthLabel(month)}
            </span>
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label={t("nextMonth")}
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>

          {summary.data && (
            <div className="flex items-center gap-3 pr-2 text-[13px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Money
                  value={summary.data.in}
                  currency={summary.data.currency}
                  size="inline"
                  tone="movement"
                  kind="INCOME"
                />
                <span>{t("in")}</span>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Money
                  value={-summary.data.out}
                  currency={summary.data.currency}
                  size="inline"
                  tone="movement"
                  kind="EXPENSE"
                />
                <span>{t("out")}</span>
              </span>
            </div>
          )}
        </div>

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
                onClick={() => setSelectedIds([])}
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

        {/* Loading / Error / Empty / Data */}
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
          <>
            {/* Mobile day-grouped list */}
            <div className="flex flex-col gap-5 lg:hidden">
              {groupedByDay.map((group) => (
                <section key={group.date} className="flex flex-col gap-2">
                  <DayHeader
                    date={group.date === "undated" ? t("undated") : group.date}
                    net={summary.data?.byDay?.[group.date] ?? 0}
                    currency={summary.data?.currency ?? "USD"}
                  />
                  <Card variant="plain" className="divide-y overflow-hidden">
                    {group.items.map((r) => {
                      const title =
                        r.transfer && r.transferAccount
                          ? `${r.account.name} → ${r.transferAccount.name}`
                          : r.payee ||
                            r.category?.name ||
                            r.note ||
                            r.account.name;
                      return (
                        <TransactionRow
                          key={r.id}
                          title={title}
                          category={
                            r.category
                              ? { icon: r.category.icon, name: r.category.name }
                              : { icon: null, name: r.account.name }
                          }
                          account={r.account.name}
                          amount={r.amount}
                          currency={r.currency}
                          kind={r.transfer ? "TRANSFER" : r.type}
                          onClick={() => setDetailId(r.id)}
                        />
                      );
                    })}
                  </Card>
                </section>
              ))}
            </div>

            {/* Desktop table */}
            <Card variant="plain" className="hidden overflow-hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label={t("selectAll")}
                        checked={
                          rows.length > 0 && selectedIds.length === rows.length
                        }
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked ? rows.map((r) => r.id) : [])
                        }
                      />
                    </TableHead>
                    <TableHead>{t("columns.date")}</TableHead>
                    <TableHead>{t("columns.description")}</TableHead>
                    <TableHead>{t("columns.category")}</TableHead>
                    <TableHead>{t("columns.account")}</TableHead>
                    <TableHead className="text-right">
                      {t("columns.amount")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const title =
                      r.transfer && r.transferAccount
                        ? `${r.account.name} → ${r.transferAccount.name}`
                        : r.payee ||
                          r.category?.name ||
                          r.note ||
                          r.account.name;
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => setDetailId(r.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label={title}
                            checked={selectedIds.includes(r.id)}
                            onCheckedChange={() => toggleRowSelection(r.id)}
                          />
                        </TableCell>
                        <TableCell className="num whitespace-nowrap text-[13px] text-muted-foreground">
                          {r.date ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="flex items-center gap-2.5">
                            <CategoryIcon
                              icon={r.category?.icon}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{title}</p>
                              {r.note && r.payee && (
                                <p className="truncate text-[12px] text-muted-foreground">
                                  {r.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {r.nature && <NatureSwatch nature={r.nature} />}
                            <span>{r.category?.name ?? "—"}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {r.account.name}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money
                            value={r.amount}
                            currency={r.currency}
                            size="row"
                            tone="movement"
                            kind={r.transfer ? "TRANSFER" : r.type}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {list.hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="touch"
                  disabled={list.isFetchingNextPage}
                  onClick={() => list.fetchNextPage()}
                >
                  {list.isFetchingNextPage ? t("loadingMore") : t("loadMore")}
                </Button>
              </div>
            )}
          </>
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
                  {c.name}
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
