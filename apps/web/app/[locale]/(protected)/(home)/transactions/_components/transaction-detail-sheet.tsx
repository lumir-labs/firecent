"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight, ArrowRight, Copy, Pencil, Trash2 } from "lucide-react";
import { trpc } from "@app/api/client";

import {
  AccountDot,
  CategoryIcon,
  FieldRow,
  Money,
  StateBlock,
  TransferTypePill,
  localizeCategoryName,
  resolveTransferFlow,
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
  const isTransfer = Boolean(r && (r.transfer || r.type === "TRANSFER"));
  const flow =
    r && isTransfer
      ? r.transferPair
        ? {
            from: r.transferPair.fromAccount,
            to: r.transferPair.toAccount,
            direction: (r.amount < 0 ? "out" : "in") as "out" | "in",
          }
        : resolveTransferFlow(r.amount, r.account, r.transferAccount)
      : null;
  const localizedCat = r?.category
    ? localizeCategoryName(r.category, locale)
    : null;

  function handleDuplicate() {
    if (!r) return;
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toISOString().slice(11, 16);
    const fromId = isTransfer
      ? (r.transferPair?.fromAccount.id ?? flow?.from?.id ?? r.account.id)
      : r.account.id;
    const toId = isTransfer
      ? (r.transferPair?.toAccount.id ?? flow?.to?.id ?? r.transferAccount?.id ?? null)
      : null;
    const fromAmount = isTransfer && r.transferPair
      ? r.transferPair.fromAmount
      : Math.abs(r.amount);
    const toAmount =
      isTransfer &&
      r.transferPair &&
      r.transferPair.fromAccount.currency !== r.transferPair.toAccount.currency
        ? r.transferPair.toAmount
        : null;
    duplicateMutation.mutate({
      type: isTransfer ? "TRANSFER" : r.type,
      amount: Math.round(fromAmount * 100),
      receiveAmount: toAmount != null ? Math.round(toAmount * 100) : null,
      accountId: fromId,
      transferAccountId: toId,
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
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            {isTransfer ? (
              <CategoryIcon icon={ArrowLeftRight} variant="transfer" size="lg" />
            ) : (
              <CategoryIcon
                icon={r.category?.icon}
                color={r.category?.color}
                size="lg"
              />
            )}
            <Money
              value={r.amount}
              currency={r.currency}
              size="sheet"
              tone="movement"
              kind={isTransfer ? "TRANSFER" : r.type}
            />
            {isTransfer && flow ? (
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[14px] font-medium text-foreground">
                {flow.from && (
                  <span className="inline-flex items-center gap-1.5 text-foreground/80">
                    <AccountDot color={flow.from.color} size="sm" />
                    <span>{flow.from.name}</span>
                  </span>
                )}
                {flow.from && flow.to && (
                  <ArrowRight
                    className="size-3.5 text-sky-600 dark:text-sky-400"
                    aria-hidden="true"
                  />
                )}
                {flow.to && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                    <AccountDot color={flow.to.color} size="sm" />
                    <span>{flow.to.name}</span>
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[15px] font-medium text-foreground">
                {r.payee?.name || localizedCat || r.note || r.account.name}
              </p>
            )}
            {isTransfer && <TransferTypePill />}
            {r.date && (
              <p className="text-[13px] text-muted-foreground">
                {r.date}
                {r.time ? ` · ${r.time}` : ""}
              </p>
            )}
          </div>

          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {isTransfer && flow ? (
              <>
                {flow.from && (
                  <FieldRow
                    label={t("detail.fromAccount")}
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <AccountDot color={flow.from.color} size="sm" />
                        <span>{flow.from.name}</span>
                      </span>
                    }
                  />
                )}
                {flow.to && (
                  <FieldRow
                    label={t("detail.toAccount")}
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <AccountDot color={flow.to.color} size="sm" />
                        <span>{flow.to.name}</span>
                      </span>
                    }
                  />
                )}
              </>
            ) : (
              <>
                <FieldRow
                  label={t("detail.account")}
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <AccountDot color={r.account.color} size="sm" />
                      <span>{r.account.name}</span>
                    </span>
                  }
                />
                <FieldRow
                  label={t("detail.category")}
                  value={localizedCat ?? t("detail.uncategorized")}
                />
              </>
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
