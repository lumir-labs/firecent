import { Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { CategoryIcon } from "./category-icon";
import { Money } from "./money";
import type { ColorName, TransactionKind } from "./types";

export type TransactionRowProps = {
  /** Payee or note. */
  title: string;
  category: { icon: string | LucideIcon | null; name: string; color?: ColorName | null };
  /** Account name, or "From a private account" for another member's private transfer. */
  account: string;
  /** Major units, signed (D1). */
  amount: number;
  currency: string;
  kind: TransactionKind;
  /** The account is private: `lock` before its name (SPEC §4.3). */
  private?: boolean;
  /** Captured by another member: 16 px avatar at the end of the meta. */
  addedBy?: { initial: string; color?: ColorName; name: string };
  /** Leading meta item, e.g. "Today" on Home (Transactions groups by DayHeader instead). */
  date?: string;
  /** Pills next to the title (labels, "Sofía owes $71.30"). */
  tags?: ReactNode;
  /** Amount in the base currency, second line `≈ −$56.85`. */
  converted?: { value: number; currency: string };
  /** Second line under the amount when not converted (time, "Pending"). */
  secondary?: string;
  /** Excluded from totals: struck title, muted. */
  excluded?: boolean;
  href?: string;
  /** Client parents only (functions do not cross the server boundary). */
  onClick?: () => void;
  className?: string;
};

/**
 * N2 — transaction row. Category tile, title, meta (date · category ·
 * [lock] account [avatar]) and the amount, whose sign and color come from
 * `Money tone="movement"`.
 */
export function TransactionRow({
  title,
  category,
  account,
  amount,
  currency,
  kind,
  private: isPrivate,
  addedBy,
  date,
  tags,
  converted,
  secondary,
  excluded,
  href,
  onClick,
  className,
}: TransactionRowProps) {
  const t = useTranslations("Finance.row");

  const body = (
    <>
      <CategoryIcon icon={category.icon} color={category.color} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span
            className={cn(
              "truncate font-medium",
              excluded && "text-muted-foreground line-through",
            )}
          >
            {title}
          </span>
          {tags}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
          {date && (
            <>
              <span className="shrink-0">{date}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="min-w-0 shrink truncate">{category.name}</span>
          <span aria-hidden="true">·</span>
          {isPrivate && (
            <Lock aria-label={t("privateAccount")} role="img" className="size-3 shrink-0" />
          )}
          <span className="min-w-0 truncate">{account}</span>
          {addedBy && (
            <Avatar
              size="xs"
              color={addedBy.color ?? "DEFAULT"}
              role="img"
              aria-label={t("addedBy", { name: addedBy.name })}
              title={addedBy.name}
              className="ml-0.5 after:hidden"
            >
              <AvatarFallback aria-hidden>{addedBy.initial}</AvatarFallback>
            </Avatar>
          )}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <Money
          value={amount}
          currency={currency}
          kind={kind}
          tone="movement"
          size="row"
          weight={kind === "TRANSFER" ? "medium" : "semibold"}
          converted={converted}
          className={cn(excluded && "text-muted-foreground line-through")}
        />
        {!converted && secondary && (
          <span className="block text-[12px] text-muted-foreground">{secondary}</span>
        )}
      </span>
    </>
  );

  const cls = cn(
    "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left",
    (href || onClick) && "transition-colors hover:bg-accent/60",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function TransactionRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-16 items-center gap-3 px-4 py-3", className)}>
      <Skeleton className="size-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
