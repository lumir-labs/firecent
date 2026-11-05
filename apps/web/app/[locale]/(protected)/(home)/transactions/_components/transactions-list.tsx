"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowLeftRight, ArrowRight, Receipt } from "lucide-react";
import { trpc } from "@app/api/client";

import { LucideIcon } from "@/components/common/lucide-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  NO_FILTERS,
  TransactionFilters,
  type TxFilters,
} from "./transaction-filters";

const PAGE_SIZE = 100;
/** Start fetching the next page when this many rows are left to render. */
const PREFETCH_ROWS = 15;
const DAY_ESTIMATE = 48;
const TX_ESTIMATE = 64;
/** Transfer tile color (kept from the original records list). */
const TRANSFER_COLOR = "#8bc34a";

type Tx = {
  id: number;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  note: string | null;
  date: string | null;
  time: string | null;
  payee: string | null;
  category: { name: string; color: string | null; icon: string | null } | null;
  account: { id: number; name: string; color: string | null; currency: string };
  transferAccount: { id: number; name: string; color: string | null } | null;
  /** Account balance after this record (only when filtering by account). */
  balance: number | null;
};

type DayRow = {
  kind: "day";
  key: string;
  date: string | null;
  /** Income − expenses of the day (transfers don't change your money). */
  net: number;
  count: number;
  currency: string;
};
type Row = DayRow | { kind: "tx"; key: string; tx: Tx; last: boolean };

/**
 * Card on desktop; on phones the list goes edge to edge (no frame, no side
 * gutter) so every pixel goes to the rows. `-mx-4` cancels the layout's
 * `p-4`, and the rows' own `px-4` keeps them aligned with the page title.
 */
const LIST_CARD =
  "gap-0 py-0 max-sm:-mx-4 max-sm:rounded-none max-sm:bg-transparent max-sm:shadow-none max-sm:ring-0";

/** Desktop columns: who/what (+ category) · account · amount. */
const COLS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)_8.5rem] md:gap-6";

const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Flat, date-sorted records → day header + its rows. */
function toRows(items: Tx[]): Row[] {
  const rows: Row[] = [];
  let day: DayRow | null = null;
  for (const tx of items) {
    if (!day || day.date !== tx.date) {
      const prev = rows.at(-1);
      if (prev?.kind === "tx") prev.last = true;
      day = {
        kind: "day",
        key: `day-${tx.date ?? "none"}`,
        date: tx.date,
        net: 0,
        count: 0,
        currency: tx.account.currency,
      };
      rows.push(day);
    }
    if (tx.type !== "TRANSFER") day.net += tx.amount;
    day.count += 1;
    rows.push({ kind: "tx", key: `tx-${tx.id}`, tx, last: false });
  }
  const tail = rows.at(-1);
  if (tail?.kind === "tx") tail.last = true;
  return rows;
}

/** The layout scrolls inside <ScrollArea>; the list virtualizes against it. */
function useScrollParent(ref: React.RefObject<HTMLElement | null>) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    const parent = node?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!node || !parent) return;
    const measure = () =>
      setMargin(
        node.getBoundingClientRect().top -
          parent.getBoundingClientRect().top +
          parent.scrollTop,
      );
    setEl(parent);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [ref]);
  return { el, margin };
}

export function TransactionsList() {
  const [filters, setFilters] = useState<TxFilters>(NO_FILTERS);
  return (
    <div className="flex flex-col gap-4">
      <TransactionFilters value={filters} onChange={setFilters} />
      <ListBody filters={filters} onClear={() => setFilters(NO_FILTERS)} />
    </div>
  );
}

function ListBody({
  filters,
  onClear,
}: {
  filters: TxFilters;
  onClear: () => void;
}) {
  const t = useTranslations("Transactions");
  const query = trpc.records.list.useInfiniteQuery(
    { limit: PAGE_SIZE, ...filters },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      // Keep showing the previous list while a new filter loads (no flash).
      placeholderData: keepPreviousData,
    },
  );

  const items = useMemo(
    () => (query.data?.pages.flatMap((p) => p.items) ?? []) as Tx[],
    [query.data],
  );
  const rows = useMemo(() => toRows(items), [items]);
  const total = query.data?.pages[0]?.total ?? null;
  const filtered = filters.accountId !== null || filters.categoryId !== null;

  if (query.isPending) return <ListSkeleton />;

  if (query.isError) {
    return (
      <Card className="items-start gap-3 px-5">
        <p className="text-sm text-muted-foreground">{t("error")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isRefetching}
        >
          {t("retry")}
        </Button>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Receipt />
          </EmptyMedia>
          <EmptyTitle>
            {filtered ? t("filters.emptyTitle") : t("emptyTitle")}
          </EmptyTitle>
          <EmptyDescription>
            {filtered ? t("filters.emptyDescription") : t("emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
        {filtered && (
          <Button variant="outline" size="sm" onClick={onClear}>
            {t("filters.clear")}
          </Button>
        )}
      </Empty>
    );
  }

  return (
    <div
      className={cn(
        "transition-opacity",
        query.isPlaceholderData && "pointer-events-none opacity-60",
      )}
    >
      <VirtualList
        rows={rows}
        total={total}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={() => query.fetchNextPage()}
      />
    </div>
  );
}

function VirtualList({
  rows,
  total,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  rows: Row[];
  total: number | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const t = useTranslations("Transactions");
  const listRef = useRef<HTMLDivElement>(null);
  const scroll = useScrollParent(listRef);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.el,
    estimateSize: (i) => (rows[i]?.kind === "day" ? DAY_ESTIMATE : TX_ESTIMATE),
    getItemKey: (i) => rows[i]?.key ?? i,
    scrollMargin: scroll.margin,
    overscan: 10,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.at(-1)?.index ?? 0;

  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastIndex >= rows.length - PREFETCH_ROWS
    ) {
      fetchNextPage();
    }
  }, [lastIndex, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Card className={LIST_CARD}>
      <div
        ref={listRef}
        role="list"
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((v) => {
          const row = rows[v.index];
          if (!row) return null;
          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              role={row.kind === "tx" ? "listitem" : undefined}
              className="absolute top-0 left-0 w-full"
              style={{
                transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {row.kind === "day" ? (
                <DayHeader row={row} first={v.index === 0} />
              ) : (
                <TxRow tx={row.tx} last={row.last} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex min-h-12 items-center justify-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
        {isFetchingNextPage ? (
          <>
            <Spinner className="size-3.5" />
            {t("loadingMore")}
          </>
        ) : total !== null ? (
          t("count", { count: total })
        ) : null}
      </div>
    </Card>
  );
}

/* ───────────── Day header ───────────── */

function useDayLabel() {
  const t = useTranslations("Transactions");
  const locale = useLocale();
  const [ref] = useState(() => {
    const now = new Date();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { today: localDayKey(now), yesterday: localDayKey(y), year: now.getFullYear() };
  });
  return (date: string | null) => {
    if (!date) return { main: t("noDate"), sub: null };
    const [y, m, d] = date.split("-").map(Number);
    const value = new Date(y, m - 1, d);
    const full = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      ...(y !== ref.year ? { year: "numeric" } : {}),
    }).format(value);
    const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
    if (date === ref.today) return { main: t("today"), sub: full };
    if (date === ref.yesterday) return { main: t("yesterday"), sub: full };
    return { main: cap(full), sub: null };
  };
}

function DayHeader({ row, first }: { row: DayRow; first: boolean }) {
  const t = useTranslations("Transactions");
  const locale = useLocale();
  const label = useDayLabel()(row.date);

  return (
    <div
      className={cn(
        "flex items-end justify-between gap-3 bg-muted/40 px-4 pt-4 pb-2 sm:px-5",
        !first && "border-t",
      )}
    >
      <p className="min-w-0 truncate text-sm">
        <span className="font-semibold">{label.main}</span>
        {label.sub && (
          <span className="text-muted-foreground"> · {label.sub}</span>
        )}
      </p>
      <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
        <span className="hidden sm:inline">
          {t("count", { count: row.count })} ·{" "}
        </span>
        <span
          className={cn(
            "font-medium",
            row.net > 0 && "text-green-600 dark:text-green-500",
          )}
        >
          {formatMoney(locale, row.net, row.currency, true)}
        </span>
      </p>
    </div>
  );
}

/* ───────────── Row ───────────── */

function Dot({ color }: { color: string | null }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", !color && "bg-muted-foreground/50")}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

/** Account(s): for transfers ORIGIN → DESTINATION, read from the sign. */
function AccountLabel({ tx }: { tx: Tx }) {
  if (tx.type !== "TRANSFER") {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Dot color={tx.account.color} />
        <span className="truncate">{tx.account.name}</span>
      </span>
    );
  }
  const exit = tx.amount < 0;
  const from = exit ? tx.account : tx.transferAccount;
  const to = exit ? tx.transferAccount : tx.account;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Dot color={from?.color ?? null} />
      <span className="truncate">{from?.name ?? "—"}</span>
      <ArrowRight className="size-3 shrink-0 opacity-60" />
      <Dot color={to?.color ?? null} />
      <span className="truncate">{to?.name ?? "—"}</span>
    </span>
  );
}

/** Phones: a transfer in two lines (origin over destination) with a small
 *  down arrow on the side showing the direction of the money. */
function TransferLines({ tx }: { tx: Tx }) {
  const exit = tx.amount < 0;
  const from = exit ? tx.account : tx.transferAccount;
  const to = exit ? tx.transferAccount : tx.account;
  return (
    <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 text-[11px] leading-3">
      <ArrowDown className="row-span-2 size-3 text-muted-foreground/70" />
      {[from, to].map((acc, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          <Dot color={acc?.color ?? null} />
          <span className="truncate">{acc?.name ?? "—"}</span>
        </span>
      ))}
    </span>
  );
}

function CategoryTile({ tx, label }: { tx: Tx; label: string | null }) {
  const isTransfer = tx.type === "TRANSFER";
  const color = isTransfer ? TRANSFER_COLOR : tx.category?.color;
  return (
    <span
      title={label ?? undefined}
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs [&_svg]:size-[18px]",
        color ? "text-white" : "bg-muted text-muted-foreground",
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {isTransfer ? (
        <ArrowLeftRight />
      ) : (
        <LucideIcon iconName={tx.category?.icon} strokeWidth={1.75} />
      )}
    </span>
  );
}

function TxRow({ tx, last }: { tx: Tx; last: boolean }) {
  const t = useTranslations("Transactions");
  const locale = useLocale();
  const isTransfer = tx.type === "TRANSFER";
  const category = tx.category?.name ?? (isTransfer ? t("transfer") : null);

  // Who/what you'd recognise first: merchant › note › category.
  const title = tx.payee ?? tx.note ?? category ?? t("uncategorized");
  // Secondary line: category (unless it IS the title) · note (idem).
  const subCategory = category && category !== title ? category : null;
  const subNote = tx.note && tx.note !== title ? tx.note : null;

  const amountTone = isTransfer
    ? "text-muted-foreground"
    : tx.amount > 0
      ? "text-green-600 dark:text-green-500"
      : tx.amount < 0
        ? "text-red-600 dark:text-red-400"
        : "";

  return (
    <div className="group relative px-4 transition-colors hover:bg-muted/50 sm:px-5">
      <div className={cn(COLS, "py-3")}>
        {/* Who / what */}
        <div className="flex min-w-0 items-center gap-3">
          <CategoryTile tx={tx} label={category} />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-sm font-medium",
                // Transfers carry two short lines below: a tighter title keeps
                // the text block at the tile's 40px, like every other row.
                isTransfer && "leading-4 md:leading-5",
              )}
            >
              {title}
            </p>
            {/* Mobile: the note when there is one (the tile already says the
                category); otherwise the account, since that column is hidden. */}
            <div className="flex min-w-0 items-center text-xs text-muted-foreground md:hidden">
              {isTransfer ? (
                <TransferLines tx={tx} />
              ) : subNote ? (
                <span className="truncate">{subNote}</span>
              ) : (
                <AccountLabel tx={tx} />
              )}
            </div>
            {/* Desktop: category · note */}
            {(subCategory || subNote) && (
              <p className="hidden truncate text-xs text-muted-foreground md:block">
                {[isTransfer ? null : subCategory, subNote]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* Account */}
        <div className="hidden min-w-0 text-sm text-muted-foreground md:block">
          <AccountLabel tx={tx} />
        </div>

        {/* Amount */}
        <div className="text-right">
          <p className={cn("text-base font-semibold tabular-nums sm:text-lg sm:leading-6", amountTone)}>
            {formatMoney(locale, tx.amount, tx.account.currency, !isTransfer)}
          </p>
          {tx.balance !== null ? (
            <p
              className={cn(
                "text-xs tabular-nums",
                tx.balance < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
              )}
              title={t("balanceAfter")}
            >
              {formatMoney(locale, tx.balance, tx.account.currency)}
            </p>
          ) : tx.time && (
            <p className="text-xs text-muted-foreground tabular-nums">{tx.time}</p>
          )}
        </div>
      </div>
      {/* Divider starts after the tile, like native lists */}
      {!last && (
        <span className="absolute right-4 bottom-0 left-[4.25rem] h-px bg-border sm:right-5 sm:left-[4.75rem]" />
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <Card className={LIST_CARD}>
      <div className="bg-muted/40 px-5 pt-4 pb-2">
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={cn(COLS, "px-4 py-3 sm:px-5")}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="hidden h-3.5 w-28 md:block" />
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      ))}
    </Card>
  );
}
