"use client";

import { useLocale, useTranslations } from "next-intl";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { trpc } from "@app/api/client";

import {
  FieldRow,
  Money,
  StateBlock,
  localizeCategoryName,
} from "@/components/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { useShell } from "../../_components/shell/shell-context";

export function TransactionDetailSheet({
  recordId,
  onClose,
}: {
  recordId: number | null;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("TransactionsV2");
  const tShell = useTranslations("Shell");
  const { openAddTransaction } = useShell();
  const utils = trpc.useUtils();

  const detail = trpc.records.get.useQuery(
    { id: recordId ?? 0 },
    { enabled: recordId !== null },
  );

  const invalidate = async () => {
    await Promise.all([
      utils.records.list.invalidate(),
      utils.records.monthSummary.invalidate(),
      utils.records.get.invalidate(),
      utils.accounts.list.invalidate(),
      utils.accounts.get.invalidate(),
      utils.dashboard.home.invalidate(),
      utils.dashboard.netWorth.invalidate(),
    ]);
  };

  const duplicateMutation = trpc.records.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("detail.duplicated"));
      onClose();
    },
  });

  const restoreMutation = trpc.records.restore.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("detail.restored"));
    },
  });

  const deleteMutation = trpc.records.delete.useMutation({
    onSuccess: async (_, vars) => {
      await invalidate();
      onClose();
      firecentToast(t("detail.deleted"), {
        action: {
          label: t("detail.undo"),
          onClick: () => restoreMutation.mutate({ id: vars.id }),
        },
      });
    },
  });

  const r = detail.data;
  const localizedCat = r?.category
    ? localizeCategoryName(r.category, locale)
    : null;

  function handleDuplicate() {
    if (!r) return;
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toISOString().slice(11, 16);
    duplicateMutation.mutate({
      type: r.transfer ? "TRANSFER" : r.type,
      amount: Math.round(Math.abs(r.amount) * 100),
      accountId: r.account.id,
      transferAccountId: r.transferAccount?.id ?? null,
      categoryId: r.category?.id ?? null,
      payeeId: r.payee?.id ?? null,
      spendingNature: r.spendingNature,
      paymentType: r.paymentType,
      note: r.note,
      recordDate: r.date ?? today,
      recordTime: r.time ?? nowTime,
      labelIds: r.labels.map((l) => l.id),
    });
  }

  return (
    <ResponsiveSheet
      open={recordId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("detail.title")}
      closeLabel={tShell("close")}
      desktop="panel"
    >
      {detail.isPending ? (
        <div className="flex flex-col gap-4 px-5">
          <Skeleton className="mx-auto h-10 w-36" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : detail.isError || !r ? (
        <div className="px-5">
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => detail.refetch() }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-5">
          <div className="flex flex-col items-center gap-1 pt-2 text-center">
            <Money
              value={r.amount}
              currency={r.currency}
              size="sheet"
              tone="movement"
              kind={r.transfer ? "TRANSFER" : r.type}
            />
            <p className="text-[15px] font-medium text-foreground">
              {r.transfer && r.transferAccount
                ? `${r.account.name} → ${r.transferAccount.name}`
                : r.payee?.name || localizedCat || r.note || r.account.name}
            </p>
            {r.date && (
              <p className="text-[13px] text-muted-foreground">
                {r.date}
                {r.time ? ` · ${r.time}` : ""}
              </p>
            )}
          </div>

          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            <FieldRow label={t("detail.account")} value={r.account.name} />
            {r.transfer && r.transferAccount && (
              <FieldRow
                label={t("detail.toAccount")}
                value={r.transferAccount.name}
              />
            )}
            {!r.transfer && (
              <FieldRow
                label={t("detail.category")}
                value={localizedCat ?? t("detail.uncategorized")}
              />
            )}
            {r.payee && (
              <FieldRow label={t("detail.payee")} value={r.payee.name} />
            )}
            {r.note && <FieldRow label={t("detail.note")} value={r.note} />}
            {r.labels.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[13px] text-muted-foreground">
                  {t("detail.labels")}
                </span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {r.labels.map((l) => (
                    <Badge key={l.id} variant="neutral">
                      {l.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              size="touch"
              onClick={() => {
                onClose();
                openAddTransaction({ editId: r.id });
              }}
              className="w-full"
            >
              <Pencil className="size-4" aria-hidden />
              <span>{t("detail.edit")}</span>
            </Button>
            <Button
              variant="outline"
              size="touch"
              disabled={duplicateMutation.isPending}
              onClick={handleDuplicate}
              className="w-full"
            >
              <Copy className="size-4" aria-hidden />
              <span>{t("detail.duplicate")}</span>
            </Button>
            <Button
              variant="ghost"
              size="touch"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: r.id })}
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              <span>{t("detail.delete")}</span>
            </Button>
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
}
