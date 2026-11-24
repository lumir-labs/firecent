import { useLocale } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { moneyParts } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { Surface, TransactionKind } from "./types";
import { HERO_SKELETON } from "./utils";

/**
 * Money — the ONLY place that decides sign, color and format of an amount
 * (SPEC §4.2). Values are major units (D8) and signed (D1): expenses and
 * outgoing transfers are negative.
 *
 * Tones:
 * - `plain`    the value as is: `$1,234.56`, `−$1,846.32`. Ink.
 * - `movement` lists of things that happened: `−$41.24` ink, `+$2,975.00`
 *              positive, transfers `$1,800.00` muted and unsigned.
 * - `upcoming` lists of things to pay: expense unsigned ink, income `+` positive.
 */

export type MoneySize =
  | "hero"
  | "sheet"
  | "card"
  | "row-strong"
  | "row"
  | "inline";

export type MoneyTone = "movement" | "upcoming" | "plain";

export type MoneyProps = {
  /** Major units (D8), signed (D1). */
  value: number;
  currency: string;
  size?: MoneySize;
  tone?: MoneyTone;
  /** Only TRANSFER changes the result (muted, unsigned); otherwise the sign of `value` decides. */
  kind?: TransactionKind;
  /** Estimated amount: prefixes `~`. */
  approx?: boolean;
  /** Dims `$` and cents. Default true for `hero`, false otherwise. */
  dimCents?: boolean;
  /** Drops `.00` (plan figures: `of $3,300`). */
  trimZeroCents?: boolean;
  /** Whole amount in muted ink (empty states: `$0.00`). */
  muted?: boolean;
  /** Overrides the size's weight (rows use semibold in lists, medium elsewhere). */
  weight?: "normal" | "medium" | "semibold";
  /** Second line `≈ −$56.85` in the base currency, 12 px muted. */
  converted?: { value: number; currency: string };
  /** Alignment of the stacked `converted` line. Default "end". */
  align?: "start" | "end";
  surface?: Surface;
  className?: string;
};

const SIZE: Record<MoneySize, string> = {
  hero: "text-[44px] leading-[48px] font-semibold tracking-[-0.035em]",
  sheet: "text-[34px] leading-[40px] font-semibold tracking-[-0.03em]",
  card: "text-[20px] font-semibold tracking-[-0.02em]",
  "row-strong": "text-[16px] font-semibold",
  row: "text-[15px] font-medium",
  inline: "",
};

// Dimmed `$` / cents per size (hero: SPEC 3.2; sheet scales the same ratio).
const DIM_SIZE: Partial<Record<MoneySize, string>> = {
  hero: "text-[26px] font-medium",
  sheet: "text-[22px] font-medium",
};

const WEIGHT = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
} as const;

const MINUS = "−";

type Resolved = {
  sign: "" | "+" | typeof MINUS;
  color: "inherit" | "positive" | "muted";
};

/** Sign and color for a value, tone and kind. Exported for tests and tables. */
export function resolveMoney(
  value: number,
  tone: MoneyTone,
  kind?: TransactionKind,
): Resolved {
  const neg = value < 0;
  const pos = value > 0;
  if (tone === "plain") return { sign: neg ? MINUS : "", color: "inherit" };
  if (kind === "TRANSFER") {
    return { sign: "", color: tone === "movement" ? "muted" : "inherit" };
  }
  if (tone === "upcoming") {
    if (kind === "INCOME" || (!kind && pos)) {
      return { sign: "+", color: "positive" };
    }
    return { sign: "", color: "inherit" };
  }
  // movement
  if (pos) return { sign: "+", color: "positive" };
  if (neg) return { sign: MINUS, color: "inherit" };
  return { sign: "", color: "inherit" };
}

/**
 * `narrowSymbol` (lib/money) prints every dollar as `$`. Keep that for USD,
 * but disambiguate other dollars: MX$, CA$, A$ (SPEC §4.2 `−MX$1,050.00`).
 */
function currencySymbol(currency: string, narrow: string): string {
  if (narrow !== "$" || currency.toUpperCase() === "USD") return narrow;
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "symbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? narrow
    );
  } catch {
    return narrow;
  }
}

type Split = { symbolBefore: string; whole: string; cents: string; after: string };

/** Splits an unsigned amount into symbol / whole / cents (`.47`) / trailing code. */
function splitAmount(
  locale: string,
  abs: number,
  currency: string,
  trimZeroCents: boolean,
): Split {
  const parts = moneyParts(locale, abs, currency);
  let symbolBefore = "";
  let whole = "";
  let cents = "";
  let after = "";
  let seenNumber = false;
  for (const p of parts) {
    if (p.type === "currency") {
      const sym = currencySymbol(currency, p.value);
      if (seenNumber) after += sym;
      else symbolBefore += sym;
    } else if (p.type === "literal") {
      if (seenNumber) after += p.value;
      else symbolBefore += p.value;
    } else if (p.type === "decimal" || p.type === "fraction") {
      cents += p.value;
    } else if (p.type === "integer" || p.type === "group") {
      seenNumber = true;
      whole += p.value;
    }
  }
  if (trimZeroCents && /^[.,]0+$/.test(cents)) cents = "";
  return { symbolBefore, whole, cents, after };
}

/** Plain string with the same rules (aria-labels, titles, chart tooltips). */
export function formatMoneyText(
  locale: string,
  value: number,
  currency: string,
  opts: {
    tone?: MoneyTone;
    kind?: TransactionKind;
    approx?: boolean;
    trimZeroCents?: boolean;
  } = {},
): string {
  const { sign } = resolveMoney(value, opts.tone ?? "plain", opts.kind);
  const s = splitAmount(
    locale,
    Math.abs(value),
    currency,
    opts.trimZeroCents ?? false,
  );
  return `${opts.approx ? "~" : ""}${sign}${s.symbolBefore}${s.whole}${s.cents}${s.after}`;
}

export function Money({
  value,
  currency,
  size = "inline",
  tone = "plain",
  kind,
  approx = false,
  dimCents,
  trimZeroCents = false,
  muted = false,
  weight,
  converted,
  align = "end",
  surface = "default",
  className,
}: MoneyProps) {
  const locale = useLocale();
  const { sign, color } = resolveMoney(value, tone, kind);
  const s = splitAmount(locale, Math.abs(value), currency, trimZeroCents);
  const hero = surface === "hero";
  const tinted = surface === "tinted";
  const dim = dimCents ?? size === "hero";
  const dimText = tinted
    ? "opacity-65"
    : hero
      ? "text-hero-muted"
      : "text-muted-foreground";

  const colorClass = muted
    ? tinted
      ? "opacity-65"
      : hero
        ? "text-hero-muted"
        : "text-muted-foreground/70"
    : color === "positive"
      ? hero
        ? "text-hero-positive"
        : "text-positive"
      : color === "muted"
        ? dimText
        : undefined;

  const main = (
    <span
      className={cn(
        "num whitespace-nowrap",
        SIZE[size],
        // Transfers read quieter than money that moved in or out.
        kind === "TRANSFER" && tone === "movement" && size === "row" && "font-medium",
        weight && WEIGHT[weight],
        colorClass,
        !converted && className,
      )}
    >
      {approx && "~"}
      {sign}
      {dim ? (
        <>
          <span
            className={cn(
              "mr-0.5 tracking-normal",
              DIM_SIZE[size] ?? "font-medium",
              !muted && dimText,
            )}
          >
            {s.symbolBefore}
          </span>
          {s.whole}
          {s.cents && (
            <span
              className={cn(
                "tracking-[-0.01em]",
                DIM_SIZE[size] ?? "font-medium",
                !muted && dimText,
              )}
            >
              {s.cents}
            </span>
          )}
          {s.after}
        </>
      ) : (
        <>
          {s.symbolBefore}
          {s.whole}
          {s.cents}
          {s.after}
        </>
      )}
    </span>
  );

  if (!converted) return main;

  return (
    <span
      className={cn(
        "inline-flex flex-col",
        align === "end" ? "items-end text-right" : "items-start",
        className,
      )}
    >
      {main}
      <span
        className={cn(
          "num text-[12px] font-normal whitespace-nowrap",
          dimText,
        )}
      >
        ≈ {formatMoneyText(locale, converted.value, converted.currency, { tone, kind })}
      </span>
    </span>
  );
}

const SKELETON_SIZE: Record<MoneySize, string> = {
  hero: "h-11 w-56 rounded-xl",
  sheet: "h-9 w-40 rounded-xl",
  card: "h-6 w-24",
  "row-strong": "h-5 w-20",
  row: "h-4 w-16",
  inline: "inline-block h-[1em] w-14 align-middle",
};

export function MoneySkeleton({
  size = "row",
  surface = "default",
  className,
}: {
  size?: MoneySize;
  surface?: Surface;
  className?: string;
}) {
  return (
    <Skeleton
      className={cn(SKELETON_SIZE[size], surface === "hero" && HERO_SKELETON, className)}
    />
  );
}
