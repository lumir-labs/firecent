import { ArrowDownLeft, Clock, Hand, Repeat } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Money } from "./money";
import type { DayInput, TransactionKind } from "./types";
import { toUtcDay } from "./utils";

export type UpcomingMode = "auto" | "manual" | "expected" | "due";

export type UpcomingRowProps = {
  /** Calendar day ("YYYY-MM-DD"). Printed as weekday + day number. */
  date: DayInput;
  title: string;
  /** Major units, signed (D1). Shown with tone "upcoming": expense unsigned, income `+`. */
  amount: number;
  currency: string;
  kind?: TransactionKind;
  /** Estimated amount (`~$94.00`). */
  approx?: boolean;
  /** Second line, e.g. "On Sapphire Reserve". */
  subtitle?: string;
  mode: UpcomingMode;
  /** For mode "due": days until due (0 = today). Negative = overdue. */
  dueInDays?: number;
  href?: string;
  className?: string;
};

const MODE_ICON = {
  auto: Repeat,
  manual: Hand,
  expected: ArrowDownLeft,
  due: Clock,
} as const;

/** E11 — row with a date chip (Coming up, Recurring). */
export function UpcomingRow({
  date,
  title,
  amount,
  currency,
  kind,
  approx,
  subtitle,
  mode,
  dueInDays,
  href,
  className,
}: UpcomingRowProps) {
  const t = useTranslations("Finance.upcoming");
  const locale = useLocale();
  const day = toUtcDay(date);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
    .format(day)
    .replace(/\.$/, "");
  const dayNum = day.getUTCDate();
  const Icon = MODE_ICON[mode];
  const urgent = mode === "due";
  const modeLabel =
    mode === "due"
      ? (dueInDays ?? 0) < 0
        ? t("overdue", { days: Math.abs(dueInDays ?? 0) })
        : t("due", { days: dueInDays ?? 0 })
      : t(mode);

  const body = (
    <>
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-center leading-none"
      >
        <span>
          <span className="block text-[11px] font-medium text-muted-foreground capitalize">
            {weekday}
          </span>
          <span className="num mt-0.5 block text-[16px] font-semibold">{dayNum}</span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">
            <span className="sr-only">
              {new Intl.DateTimeFormat(locale, {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              }).format(day)}
              {", "}
            </span>
            {title}
          </span>
          <Money
            value={amount}
            currency={currency}
            kind={kind}
            approx={approx}
            tone="upcoming"
            size="row"
            className="shrink-0"
          />
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <span className="truncate">{subtitle}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1",
              urgent && "font-medium text-warning",
            )}
          >
            <Icon aria-hidden className="size-3" />
            {modeLabel}
          </span>
        </span>
      </span>
    </>
  );

  const cls = cn("flex items-center gap-3 p-4", href && "hover:bg-accent/60", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function UpcomingRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 p-4", className)}>
      <Skeleton className="size-11 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}

