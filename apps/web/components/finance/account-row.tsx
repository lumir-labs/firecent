import {
  Banknote,
  CreditCard,
  Landmark,
  Lock,
  type LucideIcon,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { AccountSwatch } from "./account-finish";
import { CategoryIcon } from "./category-icon";
import { Money } from "./money";
import type { AccountType, ColorName } from "./types";

/** N16 icon per account type. */
export const ACCOUNT_TYPE_ICON: Record<AccountType, LucideIcon> = {
  CHECKING_ACCOUNT: Landmark,
  BANK: Landmark,
  SAVINGS_ACCOUNT: PiggyBank,
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  GENERAL: Wallet,
};

export type AccountRowProps = {
  name: string;
  type: AccountType;
  /** Last four digits; printed `·· 4821`. */
  last4?: string | null;
  /** Major units. Credit cards owe: negative (`−$1,846.32`). */
  balance: number;
  currency: string;
  /** Private account: `lock` before the type (SPEC §4.3). */
  private?: boolean;
  /** Right-hand second line ("+$855.13 this month", "Due Nov 15"). */
  secondary?: ReactNode;
  /** Color for `secondary`: positive / warning / muted (default). */
  secondaryTone?: "muted" | "positive" | "warning";
  /** Balance in the base currency for foreign accounts (`≈ $2,084.46`). */
  converted?: { value: number; currency: string };
  /** Opt-in tinted tile (the SPEC default is neutral). */
  color?: ColorName | null;
  /** Account finish or hex color (`gold`, `silver`, `platinum`, `#0148af`…). */
  finish?: string | null;
  /** Whether a savings account has an associated debit card (renders card swatch). */
  hasCard?: boolean;
  href?: string;
  className?: string;
};

const SECONDARY_TONE = {
  muted: "text-muted-foreground",
  positive: "text-positive",
  warning: "text-warning",
} as const;

/** N16 — account row (Accounts, account pickers). */
export function AccountRow({
  name,
  type,
  last4,
  balance,
  currency,
  private: isPrivate,
  secondary,
  secondaryTone = "muted",
  converted,
  color,
  finish,
  hasCard,
  href,
  className,
}: AccountRowProps) {
  const t = useTranslations("Finance");
  const right2 =
    secondary ??
    (converted ? (
      <>
        ≈ <Money value={converted.value} currency={converted.currency} />
      </>
    ) : null);

  const fallbackIcon =
    type === "SAVINGS_ACCOUNT" && hasCard
      ? CreditCard
      : ACCOUNT_TYPE_ICON[type];

  const body = (
    <>
      {finish !== undefined ? (
        <AccountSwatch type={type} color={finish} hasCard={hasCard} size="md" />
      ) : (
        <CategoryIcon icon={fallbackIcon} color={color} size="lg" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{name}</span>
          <Money
            value={balance}
            currency={currency}
            size="row"
            weight="semibold"
            className="shrink-0"
          />
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2 text-[12px]">
          <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
            {isPrivate && (
              <Lock role="img" aria-label={t("row.privateAccount")} className="size-3 shrink-0" />
            )}
            <span className="num truncate">
              {t(`accountType.${type}`)}
              {last4 ? ` ·· ${last4}` : ""}
            </span>
          </span>
          {right2 != null && (
            <span
              className={cn(
                "num shrink-0 font-medium",
                secondary != null ? SECONDARY_TONE[secondaryTone] : "font-normal text-muted-foreground",
              )}
            >
              {right2}
            </span>
          )}
        </span>
      </span>
    </>
  );

  const cls = cn(
    "flex min-h-16 items-center gap-3 px-4 py-3",
    href && "transition-colors hover:bg-accent/60",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function AccountRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-16 items-center gap-3 px-4 py-3", className)}>
      <Skeleton className="size-11 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
}
