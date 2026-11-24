"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";

import {
  CategoryIcon,
  DayHeader,
  Money,
  TransactionRow,
  formatMoneyText,
  localizeCategoryName,
} from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { todayIsoStr } from "./date-period-bar";

export type TransactionItem = {
  id: number;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  transfer: boolean;
  amount: number;
  currency: string;
  note: string | null;
  date: string | null;
  time: string | null;
  payee: string | null;
  category: {
    id: number;
    name: string;
    nameEn: string | null;
    nameEs: string | null;
    color: string | null;
    icon: string | null;
  } | null;
  account: {
    id: number;
    name: string;
    color: string | null;
    currency: string;
  };
  transferAccount: {
    id: number;
    name: string;
    color: string | null;
    currency: string;
  } | null;
  balance: number | null;
};

type VirtualizedTransactionsProps = {
  rows: TransactionItem[];
  total: number | null;
  byDay?: Record<string, number>;
  summaryCurrency?: string;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onSelectAll: (checked: boolean) => void;
  onRowClick: (id: number) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** Re-measures scrollMargin when elements above the list change height. */
  layoutKey?: string | number;
};

const PREFETCH_ROWS = 20;
const DESKTOP_ROW_ESTIMATE = 60;
const MOBILE_DAY_ESTIMATE = 44;
const MOBILE_TX_ESTIMATE = 68;

const DESKTOP_COLS =
  "grid grid-cols-[2.5rem_6.5rem_minmax(0,1.45fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_9.5rem] items-center gap-3 px-4";

type MobileEntry =
  | { kind: "day"; key: string; date: string; first: boolean }
  | {
      kind: "tx";
      key: string;
      tx: TransactionItem;
      firstInGroup: boolean;
      lastInGroup: boolean;
    };

function buildMobileEntries(rows: TransactionItem[]): MobileEntry[] {
  const entries: MobileEntry[] = [];
  let currentDay: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const tx = rows[i]!;
    const dayKey = tx.date ?? "undated";
    const isNewDay = dayKey !== currentDay;

    if (isNewDay) {
      const prev = entries[entries.length - 1];
      if (prev && prev.kind === "tx") {
        prev.lastInGroup = true;
      }
      entries.push({
        kind: "day",
        key: `day-${dayKey}`,
        date: dayKey,
        first: entries.length === 0,
      });
      currentDay = dayKey;
    }

    entries.push({
      kind: "tx",
      key: `tx-${tx.id}`,
      tx,
      firstInGroup: isNewDay,
      lastInGroup: false,
    });
  }

  const tail = entries[entries.length - 1];
  if (tail && tail.kind === "tx") {
    tail.lastInGroup = true;
  }

  return entries;
}

export function VirtualizedTransactions(props: VirtualizedTransactionsProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? (
    <DesktopVirtualizedTable {...props} />
  ) : (
    <MobileVirtualizedList {...props} />
  );
}

function DesktopVirtualizedTable({
  rows,
  total,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  layoutKey,
}: VirtualizedTransactionsProps) {
  const locale = useLocale();
  const t = useTranslations("TransactionsV2");

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  useLayoutEffect(() => {
    const node = listRef.current;
    const parent = node?.closest<HTMLElement>("[data-scroll-container]");
    if (!node || !parent) return;

    const measure = () => {
      const margin =
        node.getBoundingClientRect().top -
        parent.getBoundingClientRect().top +
        parent.scrollTop;
      setScrollMargin(margin);
    };

    setScrollEl(parent);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    if (parent.firstElementChild) {
      ro.observe(parent.firstElementChild);
    }
    return () => ro.disconnect();
  }, [layoutKey]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => DESKTOP_ROW_ESTIMATE,
    getItemKey: (i) => rows[i]?.id ?? i,
    scrollMargin,
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.at(-1)?.index ?? 0;

  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastIndex >= rows.length - PREFETCH_ROWS
    ) {
      onLoadMore();
    }
  }, [lastIndex, rows.length, hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <Card variant="plain" className="overflow-visible">
      <div role="table" aria-label={t("title")}>
        {/* Sticky header */}
        <div
          role="rowgroup"
          className="sticky top-0 z-10 rounded-t-2xl border-b bg-card/95 backdrop-blur-xs"
        >
          <div
            role="row"
            className={cn(
              DESKTOP_COLS,
              "h-11 text-[12px] font-medium text-muted-foreground",
            )}
          >
            <div role="columnheader" className="flex items-center">
              <Checkbox
                aria-label={t("selectAll")}
                checked={allSelected}
                onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
              />
            </div>
            <div role="columnheader">{t("columns.date")}</div>
            <div role="columnheader">{t("columns.description")}</div>
            <div role="columnheader">{t("columns.category")}</div>
            <div role="columnheader">{t("columns.account")}</div>
            <div role="columnheader" className="text-right">
              {t("columns.amount")}
            </div>
          </div>
        </div>

        {/* Virtualized body */}
        <div
          ref={listRef}
          role="rowgroup"
          className="relative"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((v) => {
            const r = rows[v.index];
            if (!r) return null;
            const catName = r.category
              ? localizeCategoryName(r.category, locale)
              : null;
            const title =
              r.transfer && r.transferAccount
                ? `${r.account.name} → ${r.transferAccount.name}`
                : r.payee || catName || r.note || r.account.name;
            const isSelected = selectedSet.has(r.id);

            return (
              <div
                key={v.key}
                data-index={v.index}
                ref={virtualizer.measureElement}
                role="row"
                onClick={() => onRowClick(r.id)}
                className={cn(
                  DESKTOP_COLS,
                  "absolute top-0 left-0 w-full cursor-pointer border-b border-border/60 py-2.5 transition-colors hover:bg-accent/50",
                  isSelected && "bg-accent/40",
                )}
                style={{
                  transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <div
                  role="cell"
                  className="flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    aria-label={title}
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(r.id)}
                  />
                </div>

                <div
                  role="cell"
                  className="num whitespace-nowrap text-[13px] text-muted-foreground"
                >
                  {r.date ?? "—"}
                </div>

                <div role="cell" className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon
                      icon={r.category?.icon}
                      color={r.category?.color}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium leading-snug">
                        {title}
                      </p>
                      {r.note && r.payee && (
                        <p className="truncate text-[12px] text-muted-foreground">
                          {r.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  role="cell"
                  className="min-w-0 truncate text-[13px] text-muted-foreground"
                >
                  {catName ?? "—"}
                </div>

                <div
                  role="cell"
                  className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      !r.account.color && "bg-muted-foreground/40",
                    )}
                    style={
                      r.account.color
                        ? { backgroundColor: r.account.color }
                        : undefined
                    }
                  />
                  <span className="truncate">{r.account.name}</span>
                </div>

                <div
                  role="cell"
                  className="flex flex-col items-end justify-center text-right"
                >
                  <Money
                    value={r.amount}
                    currency={r.currency}
                    size="row"
                    tone="movement"
                    kind={r.transfer ? "TRANSFER" : r.type}
                  />
                  {r.balance !== null && (
                    <span
                      title={t("balanceAfter")}
                      className="num mt-0.5 text-[12px] leading-none text-muted-foreground"
                    >
                      {formatMoneyText(locale, r.balance, r.currency, {
                        tone: "plain",
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ListFooter
        shown={rows.length}
        total={total}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
      />
    </Card>
  );
}

function MobileVirtualizedList({
  rows,
  total,
  byDay,
  summaryCurrency = "USD",
  onRowClick,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  layoutKey,
}: VirtualizedTransactionsProps) {
  const locale = useLocale();
  const t = useTranslations("TransactionsV2");

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [todayIso] = useState(() => todayIsoStr());

  const entries = useMemo(() => buildMobileEntries(rows), [rows]);

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const measure = () => {
      setScrollMargin(node.getBoundingClientRect().top + window.scrollY);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [layoutKey]);

  const virtualizer = useWindowVirtualizer({
    count: entries.length,
    estimateSize: (i) =>
      entries[i]?.kind === "day" ? MOBILE_DAY_ESTIMATE : MOBILE_TX_ESTIMATE,
    getItemKey: (i) => entries[i]?.key ?? i,
    scrollMargin,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.at(-1)?.index ?? 0;

  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastIndex >= entries.length - PREFETCH_ROWS
    ) {
      onLoadMore();
    }
  }, [lastIndex, entries.length, hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div className="flex flex-col">
      <div
        ref={listRef}
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((v) => {
          const entry = entries[v.index];
          if (!entry) return null;

          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{
                transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {entry.kind === "day" ? (
                <DayHeader
                  date={entry.date === "undated" ? "1970-01-01" : entry.date}
                  label={entry.date === "undated" ? t("undated") : undefined}
                  today={todayIso}
                  net={byDay?.[entry.date] ?? 0}
                  currency={summaryCurrency}
                  className={cn(entry.first && "pt-1")}
                />
              ) : (
                <div
                  className={cn(
                    "overflow-hidden border-x bg-card",
                    entry.firstInGroup && "rounded-t-2xl border-t",
                    entry.lastInGroup && "rounded-b-2xl border-b",
                    !entry.lastInGroup && "border-b border-border/60",
                  )}
                >
                  {(() => {
                    const r = entry.tx;
                    const catName = r.category
                      ? localizeCategoryName(r.category, locale)
                      : null;
                    const title =
                      r.transfer && r.transferAccount
                        ? `${r.account.name} → ${r.transferAccount.name}`
                        : r.payee || catName || r.note || r.account.name;

                    return (
                      <TransactionRow
                        title={title}
                        category={
                          r.category && catName
                            ? {
                                icon: r.category.icon,
                                name: catName,
                                color: r.category.color,
                              }
                            : { icon: null, name: r.account.name }
                        }
                        account={r.account.name}
                        amount={r.amount}
                        currency={r.currency}
                        kind={r.transfer ? "TRANSFER" : r.type}
                        secondary={
                          r.balance !== null
                            ? formatMoneyText(locale, r.balance, r.currency, {
                                tone: "plain",
                              })
                            : undefined
                        }
                        secondaryTitle={
                          r.balance !== null ? t("balanceAfter") : undefined
                        }
                        onClick={() => onRowClick(r.id)}
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ListFooter
        shown={rows.length}
        total={total}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
        mobile
      />
    </div>
  );
}

function ListFooter({
  shown,
  total,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  mobile = false,
}: {
  shown: number;
  total: number | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  mobile?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("TransactionsV2");

  return (
    <div
      className={cn(
        "flex min-h-12 items-center justify-center gap-3 px-4 py-3 text-[12.5px] text-muted-foreground",
        !mobile && "rounded-b-2xl",
      )}
    >
      {isFetchingNextPage ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="size-3.5" />
          <span>{t("loadingMore")}</span>
        </span>
      ) : hasNextPage ? (
        <div className="flex items-center gap-3">
          {total !== null && (
            <span className="num">
              {t("showingOf", {
                shown: shown.toLocaleString(locale),
                total: total.toLocaleString(locale),
              })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            {t("loadMore")}
          </Button>
        </div>
      ) : total !== null ? (
        <span className="num">{t("count", { count: total })}</span>
      ) : null}
    </div>
  );
}
