"use client";

import { useTranslations } from "next-intl";
import { Tag, Wallet, X } from "lucide-react";
import { trpc } from "@app/api/client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TxFilters = {
  accountId: number | null;
  categoryId: number | null;
};

export const NO_FILTERS: TxFilters = { accountId: null, categoryId: null };

const ALL = "all";

/** Pill trigger: dashed when idle, filled with the primary tint when active. */
const chip = (active: boolean) =>
  cn(
    "h-8 rounded-full border-dashed px-3 font-medium shadow-none",
    active &&
      "border-solid border-transparent bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/15 [&_svg]:text-primary",
  );

function Swatch({ color }: { color: string | null }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", !color && "bg-muted-foreground/50")}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

export function TransactionFilters({
  value,
  onChange,
}: {
  value: TxFilters;
  onChange: (next: TxFilters) => void;
}) {
  const t = useTranslations("Transactions.filters");
  const options = trpc.records.formOptions.useQuery();
  const accounts = options.data?.accounts ?? [];
  const categories = options.data?.categories ?? [];
  const parents = categories.filter((c) => c.parentId === null);
  const childrenOf = (id: number) => categories.filter((c) => c.parentId === id);

  const accountName = accounts.find((a) => a.id === value.accountId)?.name;
  const categoryName = categories.find((c) => c.id === value.categoryId)?.name;
  const active = value.accountId !== null || value.categoryId !== null;

  const toId = (v: string | null) => (v && v !== ALL ? Number(v) : null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.accountId ? String(value.accountId) : ALL}
        onValueChange={(v) => onChange({ ...value, accountId: toId(v) })}
      >
        <SelectTrigger
          size="sm"
          aria-label={t("account")}
          className={chip(value.accountId !== null)}
          disabled={options.isPending}
        >
          <Wallet />
          <SelectValue>{() => accountName ?? t("account")}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value={ALL}>{t("allAccounts")}</SelectItem>
          <SelectSeparator />
          {accounts.map((a) => (
            <SelectItem key={a.id} value={String(a.id)}>
              <Swatch color={a.color} />
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.categoryId ? String(value.categoryId) : ALL}
        onValueChange={(v) => onChange({ ...value, categoryId: toId(v) })}
      >
        <SelectTrigger
          size="sm"
          aria-label={t("category")}
          className={chip(value.categoryId !== null)}
          disabled={options.isPending}
        >
          <Tag />
          <SelectValue>{() => categoryName ?? t("category")}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
          <SelectSeparator />
          {parents.map((parent) => (
            <SelectGroup key={parent.id}>
              <SelectLabel>{parent.name}</SelectLabel>
              <SelectItem value={String(parent.id)}>
                <Swatch color={parent.color} />
                {t("wholeCategory", { name: parent.name })}
              </SelectItem>
              {childrenOf(parent.id).map((c) => (
                <SelectItem key={c.id} value={String(c.id)} className="pl-6">
                  <Swatch color={c.color} />
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full text-muted-foreground"
          onClick={() => onChange(NO_FILTERS)}
        >
          <X />
          {t("clear")}
        </Button>
      )}
    </div>
  );
}
