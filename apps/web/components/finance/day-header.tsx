import { useLocale, useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { Money } from "./money";
import type { DayInput } from "./types";
import { dayDiff, toUtcDay } from "./utils";

export type DayHeaderProps = {
  /** Calendar day ("YYYY-MM-DD"). */
  date: DayInput;
  /** Net of the day (income − expenses, transfers excluded), major units, signed. */
  net: number;
  currency: string;
  /** Today's calendar day. When given, prints "Today" / "Yesterday". */
  today?: DayInput;
  /** Overrides the printed date. */
  label?: string;
  as?: "h2" | "h3";
  className?: string;
};

/** N3 — day group header: date on the left, the day's net on the right. */
export function DayHeader({
  date,
  net,
  currency,
  today,
  label,
  as: Heading = "h3",
  className,
}: DayHeaderProps) {
  const t = useTranslations("Finance.day");
  const locale = useLocale();
  const utcDay = toUtcDay(date);
  const todayUtc = today != null ? toUtcDay(today) : null;
  const diff = today != null ? dayDiff(date, today) : null;
  const includeYear =
    todayUtc != null && utcDay.getUTCFullYear() !== todayUtc.getUTCFullYear();
  const text =
    label ??
    (diff === 0
      ? t("today")
      : diff === 1
        ? t("yesterday")
        : new Intl.DateTimeFormat(locale, {
            weekday: "short",
            month: "short",
            day: "numeric",
            ...(includeYear ? { year: "numeric" } : {}),
            timeZone: "UTC",
          }).format(utcDay));

  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-1 pt-5 pb-2 text-[13px] font-medium text-muted-foreground",
        className,
      )}
    >
      <Heading className="first-letter:uppercase">{text}</Heading>
      {/* Expenses stay muted here; only money in turns green. */}
      <Money
        value={net}
        currency={currency}
        tone="movement"
        className={net < 0 ? "text-muted-foreground" : undefined}
      />
    </div>
  );
}

export function DayHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-between px-1 pt-5 pb-2", className)}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3.5 w-14" />
    </div>
  );
}
