"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { subMonths } from "date-fns";
import { enUS, es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Money } from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export type DatePeriod =
  | { kind: "month"; month: string }
  | { kind: "3m" }
  | { kind: "6m" }
  | { kind: "12m" }
  | { kind: "all" }
  | { kind: "custom"; from: string; to: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayIsoStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function parseLocalDate(iso: string): Date | undefined {
  if (!ISO_DATE_RE.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function rollingRange(months: 3 | 6 | 12): { from: string; to: string } {
  const now = new Date();
  const from = subMonths(now, months);
  return { from: toLocalIso(from), to: toLocalIso(now) };
}

export function parsePeriodFromParams(params: URLSearchParams): DatePeriod {
  const period = params.get("period");
  if (period === "3m" || period === "6m" || period === "12m" || period === "all") {
    return { kind: period };
  }
  if (period === "custom") {
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if (ISO_DATE_RE.test(from) && ISO_DATE_RE.test(to) && from <= to) {
      return { kind: "custom", from, to };
    }
  }
  const month = params.get("month");
  return {
    kind: "month",
    month: month && YM_RE.test(month) ? month : currentMonthStr(),
  };
}

export function resolvePeriodQuery(period: DatePeriod): {
  month?: string;
  fromDate?: string;
  toDate?: string;
} {
  if (period.kind === "month") return { month: period.month };
  if (period.kind === "3m") {
    const { from, to } = rollingRange(3);
    return { fromDate: from, toDate: to };
  }
  if (period.kind === "6m") {
    const { from, to } = rollingRange(6);
    return { fromDate: from, toDate: to };
  }
  if (period.kind === "12m") {
    const { from, to } = rollingRange(12);
    return { fromDate: from, toDate: to };
  }
  if (period.kind === "custom") {
    return { fromDate: period.from, toDate: period.to };
  }
  return {};
}

export function periodExportSlug(period: DatePeriod): string {
  switch (period.kind) {
    case "month":
      return period.month;
    case "3m":
    case "6m":
    case "12m":
      return `last-${period.kind}`;
    case "all":
      return "all";
    case "custom":
      return `${period.from}_${period.to}`;
  }
}

function formatMonthLabel(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function formatRangeLabel(from: string, to: string, locale: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromDate = new Date(Date.UTC(fy, fm - 1, fd));
  const toDate = new Date(Date.UTC(ty, tm - 1, td));
  const sameYear = fy === ty;
  const fromFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(fromDate);
  const toFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(toDate);
  return `${fromFmt} – ${toFmt}`;
}

type DatePeriodBarProps = {
  period: DatePeriod;
  onChange: (next: DatePeriod) => void;
  summary?: {
    in: number;
    out: number;
    currency: string;
    count: number;
  };
};

export function DatePeriodBar({
  period,
  onChange,
  summary,
}: DatePeriodBarProps) {
  const locale = useLocale();
  const t = useTranslations("TransactionsV2");
  const tShell = useTranslations("Shell");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const lastMonthRef = useRef(
    period.kind === "month" ? period.month : currentMonthStr(),
  );
  const [customOpen, setCustomOpen] = useState(false);

  const initialBounds =
    period.kind === "custom"
      ? { from: period.from, to: period.to }
      : rollingRange(3);

  const [draftFrom, setDraftFrom] = useState(initialBounds.from);
  const [draftTo, setDraftTo] = useState(initialBounds.to);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => parseLocalDate(initialBounds.to) ?? new Date(),
  );

  useEffect(() => {
    if (period.kind === "month") {
      lastMonthRef.current = period.month;
    }
  }, [period]);

  function openCustomPicker() {
    let from: string;
    let to: string;
    if (period.kind === "custom") {
      from = period.from;
      to = period.to;
    } else if (period.kind === "3m" || period.kind === "6m" || period.kind === "12m") {
      const r = rollingRange(period.kind === "3m" ? 3 : period.kind === "6m" ? 6 : 12);
      from = r.from;
      to = r.to;
    } else if (period.kind === "month") {
      const [y, m] = period.month.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      from = `${period.month}-01`;
      to = `${period.month}-${String(lastDay).padStart(2, "0")}`;
    } else {
      const r = rollingRange(3);
      from = r.from;
      to = r.to;
    }
    setDraftFrom(from);
    setDraftTo(to);
    setCalendarMonth(parseLocalDate(to) ?? new Date());
    setCustomOpen(true);
  }

  const isInvalidDraft =
    !ISO_DATE_RE.test(draftFrom) ||
    !ISO_DATE_RE.test(draftTo) ||
    draftFrom > draftTo;

  function applyCustomRange() {
    if (isInvalidDraft) return;
    onChange({ kind: "custom", from: draftFrom, to: draftTo });
    setCustomOpen(false);
  }

  const calendarSelected: DateRange | undefined =
    parseLocalDate(draftFrom) || parseLocalDate(draftTo)
      ? {
          from: parseLocalDate(draftFrom),
          to: parseLocalDate(draftTo),
        }
      : undefined;

  function handleCalendarSelect(range: DateRange | undefined) {
    if (!range) return;
    if (range.from) {
      setDraftFrom(toLocalIso(range.from));
    }
    if (range.to) {
      setDraftTo(toLocalIso(range.to));
    } else if (range.from) {
      setDraftTo(toLocalIso(range.from));
    }
  }

  const presetButtonCls = (active: boolean) =>
    cn(
      "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    );

  const customPickerBody = (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t("period.from")}
          </span>
          <Input
            type="date"
            value={draftFrom}
            onChange={(e) => {
              const v = e.target.value;
              setDraftFrom(v);
              const parsed = parseLocalDate(v);
              if (parsed) setCalendarMonth(parsed);
            }}
            className="num h-10 text-[13px]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t("period.to")}
          </span>
          <Input
            type="date"
            value={draftTo}
            onChange={(e) => {
              const v = e.target.value;
              setDraftTo(v);
              const parsed = parseLocalDate(v);
              if (parsed) setCalendarMonth(parsed);
            }}
            className="num h-10 text-[13px]"
          />
        </label>
      </div>

      {isInvalidDraft && (
        <p className="text-[12px] text-destructive">
          {t("period.invalidRange")}
        </p>
      )}

      <div className="flex justify-center rounded-xl border bg-background/60 p-1">
        <Calendar
          mode="range"
          locale={locale.startsWith("es") ? es : enUS}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          selected={calendarSelected}
          onSelect={handleCalendarSelect}
          numberOfMonths={isDesktop ? 2 : 1}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCustomOpen(false)}
        >
          {tShell("close")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isInvalidDraft}
          onClick={applyCustomRange}
        >
          {t("period.apply")}
        </Button>
      </div>
    </div>
  );

  const rollingSub =
    period.kind === "3m"
      ? rollingRange(3)
      : period.kind === "6m"
        ? rollingRange(6)
        : period.kind === "12m"
          ? rollingRange(12)
          : null;

  const isCurrentMonth =
    period.kind === "month" && period.month === currentMonthStr();

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {/* Upper bar: active period navigation + cashflow summary */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2">
        <div className="flex min-h-10 items-center gap-1.5">
          {period.kind === "month" ? (
            <>
              <Button
                variant="ghost"
                size="icon-touch"
                aria-label={t("prevMonth")}
                onClick={() =>
                  onChange({
                    kind: "month",
                    month: shiftMonth(period.month, -1),
                  })
                }
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span className="min-w-[138px] text-center text-[15px] font-semibold first-letter:uppercase">
                {formatMonthLabel(period.month, locale)}
              </span>
              <Button
                variant="ghost"
                size="icon-touch"
                aria-label={t("nextMonth")}
                onClick={() =>
                  onChange({
                    kind: "month",
                    month: shiftMonth(period.month, 1),
                  })
                }
              >
                <ChevronRight aria-hidden />
              </Button>
              {!isCurrentMonth && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({ kind: "month", month: currentMonthStr() })
                  }
                  className="ml-1 h-7 rounded-full px-2.5 text-[12px] text-muted-foreground"
                >
                  {t("period.thisMonth")}
                </Button>
              )}
            </>
          ) : period.kind === "custom" ? (
            <button
              type="button"
              onClick={openCustomPicker}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-2.5 text-[14px] font-semibold transition-colors hover:bg-accent"
            >
              <CalendarIcon className="size-4 text-muted-foreground" aria-hidden />
              <span className="num">
                {formatRangeLabel(period.from, period.to, locale)}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          ) : period.kind === "all" ? (
            <div className="flex items-center gap-2 px-2">
              <CalendarIcon className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-[15px] font-semibold">
                {t("period.allTime")}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2">
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-[15px] font-semibold">
                {t(`period.last${period.kind}`)}
              </span>
              {rollingSub && (
                <span className="num text-[12.5px] text-muted-foreground">
                  {formatRangeLabel(rollingSub.from, rollingSub.to, locale)}
                </span>
              )}
            </div>
          )}
        </div>

        {summary && (
          <div className="flex items-center gap-3 px-2 text-[13px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Money
                value={summary.in}
                currency={summary.currency}
                size="inline"
                tone="movement"
                kind="INCOME"
              />
              <span>{t("in")}</span>
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Money
                value={-summary.out}
                currency={summary.currency}
                size="inline"
                tone="movement"
                kind="EXPENSE"
              />
              <span>{t("out")}</span>
            </span>
          </div>
        )}
      </div>

      {/* Lower strip: quick period presets + custom range picker */}
      <div className="flex items-center justify-between gap-3 border-t bg-muted/25 px-3 py-2">
        <div
          role="group"
          aria-label={t("period.label")}
          className="no-scrollbar flex items-center gap-1 overflow-x-auto"
        >
          <button
            type="button"
            aria-pressed={period.kind === "month"}
            onClick={() =>
              onChange({ kind: "month", month: lastMonthRef.current })
            }
            className={presetButtonCls(period.kind === "month")}
          >
            {t("period.month")}
          </button>
          <button
            type="button"
            aria-pressed={period.kind === "3m"}
            onClick={() => onChange({ kind: "3m" })}
            className={presetButtonCls(period.kind === "3m")}
          >
            <span className="sm:hidden">{t("period.short3m")}</span>
            <span className="hidden sm:inline">{t("period.3m")}</span>
          </button>
          <button
            type="button"
            aria-pressed={period.kind === "6m"}
            onClick={() => onChange({ kind: "6m" })}
            className={presetButtonCls(period.kind === "6m")}
          >
            <span className="sm:hidden">{t("period.short6m")}</span>
            <span className="hidden sm:inline">{t("period.6m")}</span>
          </button>
          <button
            type="button"
            aria-pressed={period.kind === "12m"}
            onClick={() => onChange({ kind: "12m" })}
            className={presetButtonCls(period.kind === "12m")}
          >
            <span className="sm:hidden">{t("period.short12m")}</span>
            <span className="hidden sm:inline">{t("period.12m")}</span>
          </button>
          <button
            type="button"
            aria-pressed={period.kind === "all"}
            onClick={() => onChange({ kind: "all" })}
            className={presetButtonCls(period.kind === "all")}
          >
            {t("period.all")}
          </button>

          {isDesktop ? (
            <Popover
              open={customOpen}
              onOpenChange={(next) => {
                if (next) openCustomPicker();
                else setCustomOpen(false);
              }}
            >
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={period.kind === "custom"}
                    className={presetButtonCls(period.kind === "custom")}
                  />
                }
              >
                <CalendarIcon className="size-3.5" aria-hidden />
                <span>{t("period.custom")}</span>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-4">
                {customPickerBody}
              </PopoverContent>
            </Popover>
          ) : (
            <button
              type="button"
              aria-pressed={period.kind === "custom"}
              onClick={openCustomPicker}
              className={presetButtonCls(period.kind === "custom")}
            >
              <CalendarIcon className="size-3.5" aria-hidden />
              <span>{t("period.custom")}</span>
            </button>
          )}
        </div>

        {summary && (
          <span className="num hidden shrink-0 pr-1 text-[12px] text-muted-foreground sm:inline">
            {t("count", { count: summary.count })}
          </span>
        )}
      </div>

      {/* Mobile custom date range sheet */}
      {!isDesktop && (
        <ResponsiveSheet
          open={customOpen}
          onOpenChange={setCustomOpen}
          title={t("period.pickRange")}
          closeLabel={tShell("close")}
          desktop="dialog"
        >
          <div className="px-5">{customPickerBody}</div>
        </ResponsiveSheet>
      )}
    </div>
  );
}
