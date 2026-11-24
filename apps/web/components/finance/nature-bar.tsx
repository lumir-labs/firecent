import { useLocale, useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { formatMoneyText, Money } from "./money";
import { NatureSwatch } from "./nature-swatch";
import type { Nature } from "./types";
import { clamp01, NATURE_BG, NATURE_KEY } from "./utils";

export type NatureBarProps = {
  nature: Nature;
  /** Spent this period, major units, positive. */
  spent: number;
  /** Planned for the period, major units. */
  planned: number;
  currency: string;
  /** Share of the period elapsed (0–1). Draws the pace marker. Omit to hide it. */
  pace?: number;
  /** Overrides the translated nature name. */
  label?: string;
  href?: string;
  className?: string;
};

/**
 * E10 — Owe / Need / Want bar with the pace marker. Over plan, the fill and
 * the figure turn destructive (the only red in the budget).
 */
export function NatureBar({
  nature,
  spent,
  planned,
  currency,
  pace,
  label,
  href,
  className,
}: NatureBarProps) {
  const t = useTranslations("Finance");
  const locale = useLocale();
  const name = label ?? t(`nature.${NATURE_KEY[nature]}`);
  const ratio = planned > 0 ? Math.abs(spent) / planned : spent > 0 ? 1 : 0;
  const percent = Math.round(ratio * 100);
  const over = ratio > 1;

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <NatureSwatch nature={nature} className="self-center" />
          <span className="truncate">{name}</span>
        </span>
        <span className="shrink-0">
          <Money
            value={Math.abs(spent)}
            currency={currency}
            className={cn("font-medium", over && "text-destructive")}
          />{" "}
          <span className="text-muted-foreground">
            {t("natureBar.of", {
              amount: formatMoneyText(locale, planned, currency, { trimZeroCents: true }),
            })}
          </span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t(over ? "natureBar.over" : "natureBar.progress", { nature: name, percent: String(percent) })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        className="relative mt-2 h-1.5 rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-400 ease-out motion-reduce:transition-none",
            over ? "bg-destructive" : NATURE_BG[nature],
          )}
          style={{ width: `${(clamp01(ratio) * 100).toFixed(1)}%` }}
        />
        {pace != null && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/45"
            style={{ left: `${(clamp01(pace) * 100).toFixed(1)}%` }}
          />
        )}
      </div>
    </>
  );

  return href ? (
    <Link href={href} className={cn("-mx-2 block rounded-xl px-2 py-1.5 hover:bg-accent/60", className)}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function NatureBarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  );
}
