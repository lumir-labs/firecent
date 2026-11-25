import { ArrowLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export type TransferAccountRef = {
  id?: number;
  name: string;
  color?: string | null;
  currency?: string;
};

export type TransferFlow = {
  from: TransferAccountRef | null;
  to: TransferAccountRef | null;
  /** Direction relative to `account`: "out" when money left `account`, "in" when it entered. */
  direction: "out" | "in";
};

/**
 * Resolves the true origin and destination of a transfer from the signed leg amount.
 * Exit leg (`amount < 0`): `account` -> `transferAccount`.
 * Entry leg (`amount >= 0`): `transferAccount` -> `account`.
 */
export function resolveTransferFlow(
  amount: number,
  account: TransferAccountRef,
  transferAccount: TransferAccountRef | null | undefined,
): TransferFlow {
  const isOut = amount < 0;
  return {
    from: isOut ? account : (transferAccount ?? null),
    to: isOut ? (transferAccount ?? null) : account,
    direction: isOut ? "out" : "in",
  };
}

/** Small account color indicator dot used consistently across tables and rows. */
export function AccountDot({
  color,
  size = "sm",
  className,
}: {
  color?: string | null;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 rounded-full",
        size === "xs" ? "size-1.5" : "size-2",
        !color && "bg-muted-foreground/40",
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

/** Subtle pill identifying a transfer in table category columns or headers. */
export function TransferTypePill({ className }: { className?: string }) {
  const t = useTranslations("Finance.row");
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-[12px] font-medium text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/15 dark:text-sky-300",
        className,
      )}
    >
      <ArrowLeftRight className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{t("transfer")}</span>
    </span>
  );
}

/**
 * Two-line aligned Origin -> Destination stack (`De ● Origin` / `A ● Destination`).
 * Uses a CSS grid so the account dots align vertically regardless of locale label width.
 */
export function TransferAccountsStack({
  flow,
  size = "row",
  className,
}: {
  flow: TransferFlow;
  /** `row` for mobile cards (primary typography), `compact` for desktop account cells. */
  size?: "row" | "compact";
  className?: string;
}) {
  const t = useTranslations("Finance.row");
  const isCompact = size === "compact";

  return (
    <span
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center",
        isCompact ? "gap-x-1.5 gap-y-0.5" : "gap-x-2 gap-y-0.5",
        className,
      )}
    >
      {flow.from && (
        <>
          <span
            className={cn(
              "font-medium text-muted-foreground/80",
              isCompact ? "text-[11px] leading-4" : "text-[11.5px] leading-5",
            )}
          >
            {t("transferFrom")}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <AccountDot color={flow.from.color} size={isCompact ? "xs" : "sm"} />
            <span
              className={cn(
                "truncate",
                isCompact
                  ? "text-[12.5px] leading-4 text-muted-foreground"
                  : "text-[13.5px] leading-5 font-medium text-foreground/75",
              )}
            >
              {flow.from.name}
            </span>
          </span>
        </>
      )}
      {flow.to && (
        <>
          <span
            className={cn(
              "font-semibold text-sky-600 dark:text-sky-400",
              isCompact ? "text-[11px] leading-4" : "text-[11.5px] leading-5",
            )}
          >
            {t("transferTo")}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <AccountDot color={flow.to.color} size={isCompact ? "xs" : "sm"} />
            <span
              className={cn(
                "truncate",
                isCompact
                  ? "text-[12.5px] leading-4 font-medium text-foreground"
                  : "text-[14px] leading-5 font-semibold text-foreground",
              )}
            >
              {flow.to.name}
            </span>
          </span>
        </>
      )}
    </span>
  );
}
