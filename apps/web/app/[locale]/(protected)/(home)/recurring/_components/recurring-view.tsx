"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Info,
  Pause,
  Play,
  Plus,
  Repeat,
  SkipForward,
  Trash2,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  CategoryIcon,
  FieldRow,
  Money,
  PageHeader,
  SectionHeader,
  StateBlock,
  formatMoneyText,
} from "@/components/finance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ViewTab = "upcoming" | "all";
type RecType = "EXPENSE" | "INCOME" | "TRANSFER";
type Freq = "WEEKLY" | "MONTHLY" | "YEARLY";
type Mode = "AUTO" | "MANUAL";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RecurringView() {
  const locale = useLocale();
  const t = useTranslations("Recurring");
  const tShell = useTranslations("Shell");
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<ViewTab>("upcoming");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const query = trpc.recurring.list.useQuery();
  const data = query.data;
  const selected = data?.items.find((i) => i.id === selectedId) ?? null;

  const invalidate = async () => {
    await Promise.all([
      utils.recurring.list.invalidate(),
      utils.records.list.invalidate(),
      utils.accounts.list.invalidate(),
      utils.dashboard.home.invalidate(),
    ]);
  };

  const confirmMutation = trpc.recurring.confirm.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("confirmedToast"));
    },
  });

  const skipMutation = trpc.recurring.skip.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("skippedToast"));
    },
  });

  const updateMutation = trpc.recurring.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      firecentToast(t("updatedToast"));
    },
  });

  const deleteMutation = trpc.recurring.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      setSelectedId(null);
      firecentToast(t("deletedToast"));
    },
  });

  type RecItem = NonNullable<typeof data>["items"][number];

  const renderRow = (item: RecItem) => (
    <div
      key={item.id}
      onClick={() => setSelectedId(item.id)}
      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon icon={item.category?.icon} size="md" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-foreground">
            {item.name}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">
            {t(`freq.${item.frequency}`)} · {item.accountName}
            {item.nextDate ? ` · ${item.nextDate}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Money
          value={item.type === "EXPENSE" ? -item.amount : item.amount}
          currency={item.currency}
          size="row"
          tone="upcoming"
          kind={item.type}
          approx={item.isEstimate}
        />
        <span className="text-[11px] text-muted-foreground">
          {item.paused
            ? t("paused")
            : item.type === "INCOME"
              ? t("mode.expected")
              : t(`mode.${item.mode}`)}
        </span>
      </div>
    </div>
  );

  const upcomingContent = data && (
    <div className="flex flex-col gap-5">
      {data.needsYou.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeader title={t("needsYou")} />
          {data.needsYou.map((item) => (
            <Card
              key={item.id}
              variant="plain"
              className="flex flex-col gap-3 border-warning/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold">{item.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {item.accountName} ·{" "}
                    {formatMoneyText(locale, item.amount, item.currency, {
                      tone: "plain",
                      approx: item.isEstimate,
                    })}
                  </p>
                </div>
                <Badge variant="warning">{t("dueNow")}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="touch"
                  disabled={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate({ id: item.id })}
                  className="flex-1"
                >
                  <Check className="size-4" aria-hidden />
                  <span>{t("confirm")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="touch"
                  disabled={skipMutation.isPending}
                  onClick={() => skipMutation.mutate({ id: item.id })}
                >
                  <SkipForward className="size-4" aria-hidden />
                  <span>{t("skip")}</span>
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionHeader title={t("next7Days")} />
        <Card variant="plain" className="divide-y overflow-hidden">
          {data.next7Days.length === 0 ? (
            <p className="p-4 text-[14px] text-muted-foreground">
              {t("nothingSoon")}
            </p>
          ) : (
            data.next7Days.map(renderRow)
          )}
        </Card>
      </section>

      {data.later.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeader title={t("later")} />
          <Card variant="plain" className="divide-y overflow-hidden">
            {data.later.map(renderRow)}
          </Card>
        </section>
      )}
    </div>
  );

  const allContent = data && (
    <section className="flex flex-col gap-2">
      <SectionHeader title={t("allTemplates")} />
      <Card variant="plain" className="divide-y overflow-hidden">
        {data.items.map(renderRow)}
      </Card>
    </section>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        back="/more"
        backLabel={tShell("nav.more")}
        actions={
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t("addRecurring")}
            onClick={() => setAddOpen(true)}
          >
            <Plus aria-hidden />
          </Button>
        }
        desktopActions={
          <Button size="touch" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            <span>{t("addRecurring")}</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-5 lg:px-0">
        {query.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        ) : query.isError || !data ? (
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => query.refetch() }}
          />
        ) : data.items.length === 0 ? (
          <StateBlock
            kind="empty"
            icon={Repeat}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={{
              label: t("addRecurring"),
              onClick: () => setAddOpen(true),
            }}
          />
        ) : (
          <>
            <section className="flex flex-col gap-1">
              <span className="text-[13px] text-muted-foreground">
                {t("heroLabel")}
              </span>
              <Money
                value={data.monthlyPaymentsTotal}
                currency={data.currency}
                size="hero"
                tone="plain"
                dimCents
              />
              <p className="text-[14px] text-muted-foreground">
                {t("heroSub", { count: String(data.activeExpenseCount) })}
              </p>
            </section>

            {/* Mobile toggle */}
            <div className="flex flex-col gap-4 lg:hidden">
              <ToggleGroup
                variant="segmented"
                value={[tab]}
                onValueChange={(vals) => {
                  const next = vals[0] as ViewTab | undefined;
                  if (next) setTab(next);
                }}
                className="w-full"
              >
                <ToggleGroupItem value="upcoming" className="flex-1">
                  {t("tabs.upcoming")}
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="flex-1">
                  {t("tabs.all")}
                </ToggleGroupItem>
              </ToggleGroup>
              {tab === "upcoming" ? upcomingContent : allContent}
            </div>

            {/* Desktop 2-col */}
            <div className="hidden gap-6 lg:grid lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">{upcomingContent}</div>
              <div className="lg:col-span-7">{allContent}</div>
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      <ResponsiveSheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selected?.name ?? t("title")}
        closeLabel={tShell("close")}
        desktop="panel"
      >
        {selected && (
          <div className="flex flex-col gap-5 px-5">
            <div className="flex flex-col items-center gap-1 pt-2 text-center">
              <Money
                value={selected.amount}
                currency={selected.currency}
                size="sheet"
                tone="plain"
                approx={selected.isEstimate}
              />
              <p className="text-[13px] text-muted-foreground">
                {t(`freq.${selected.frequency}`)}
                {selected.nextDate ? ` · ${t("nextDate", { date: selected.nextDate })}` : ""}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-muted-foreground">
                {t("howAdded")}
              </span>
              <ToggleGroup
                variant="segmented"
                value={[selected.mode]}
                onValueChange={(vals) => {
                  const next = vals[0] as Mode | undefined;
                  if (next && next !== selected.mode) {
                    updateMutation.mutate({ id: selected.id, mode: next });
                  }
                }}
                className="w-full"
              >
                <ToggleGroupItem
                  value="AUTO"
                  disabled={selected.isEstimate}
                  className="flex-1"
                >
                  {t("mode.AUTO")}
                </ToggleGroupItem>
                <ToggleGroupItem value="MANUAL" className="flex-1">
                  {t("mode.MANUAL")}
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[12px] text-muted-foreground">
                {selected.isEstimate
                  ? t("autoNeedsFixed")
                  : selected.mode === "AUTO"
                    ? t("autoHint")
                    : t("manualHint")}
              </p>
            </div>

            <div className="divide-y overflow-hidden rounded-2xl border bg-card">
              <FieldRow label={t("account")} value={selected.accountName} />
              {selected.category && (
                <FieldRow label={t("category")} value={selected.category.name} />
              )}
              <FieldRow
                label={t("ends")}
                value={selected.endDate ?? t("never")}
              />
            </div>

            <div className="flex flex-col gap-2">
              {!selected.paused && selected.nextDate && (
                <>
                  <Button
                    size="touch"
                    disabled={confirmMutation.isPending}
                    onClick={() => {
                      confirmMutation.mutate({ id: selected.id });
                      setSelectedId(null);
                    }}
                    className="w-full"
                  >
                    <Check className="size-4" aria-hidden />
                    <span>{t("confirmNow")}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="touch"
                    disabled={skipMutation.isPending}
                    onClick={() => skipMutation.mutate({ id: selected.id })}
                    className="w-full"
                  >
                    <SkipForward className="size-4" aria-hidden />
                    <span>{t("skipNext")}</span>
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="touch"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: selected.id,
                    paused: !selected.paused,
                  })
                }
                className="w-full"
              >
                {selected.paused ? (
                  <>
                    <Play className="size-4" aria-hidden />
                    <span>{t("resume")}</span>
                  </>
                ) : (
                  <>
                    <Pause className="size-4" aria-hidden />
                    <span>{t("pause")}</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="touch"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: selected.id })}
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
                <span>{t("delete")}</span>
              </Button>
            </div>
          </div>
        )}
      </ResponsiveSheet>

      {/* Add Recurring Sheet */}
      <AddRecurringSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={invalidate}
      />
    </div>
  );
}

function AddRecurringSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const t = useTranslations("Recurring");
  const tShell = useTranslations("Shell");
  const options = trpc.records.formOptions.useQuery(undefined, { enabled: open });

  const [name, setName] = useState("");
  const [type, setType] = useState<RecType>("EXPENSE");
  const [amountStr, setAmountStr] = useState("");
  const [isEstimate, setIsEstimate] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<Freq>("MONTHLY");
  const [mode, setMode] = useState<Mode>("MANUAL");
  const [startDate, setStartDate] = useState(todayStr);

  const createMutation = trpc.recurring.create.useMutation({
    onSuccess: async () => {
      await onCreated();
      setName("");
      setAmountStr("");
      firecentToast(t("createdToast"));
      onOpenChange(false);
    },
  });

  const parsed = Number.parseFloat(amountStr);
  const effectiveAccountId =
    accountId || String(options.data?.accounts[0]?.id ?? "");
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    Boolean(effectiveAccountId);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("addRecurring")}
      closeLabel={tShell("close")}
      desktop="dialog"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || createMutation.isPending) return;
          createMutation.mutate({
            name: name.trim(),
            type,
            amount: parsed,
            isEstimate,
            accountId: Number(effectiveAccountId),
            categoryId:
              type !== "TRANSFER" && categoryId ? Number(categoryId) : null,
            frequency,
            mode: isEstimate ? "MANUAL" : mode,
            startDate,
          });
        }}
        className="flex flex-col gap-4 px-5"
      >
        <ToggleGroup
          variant="segmented"
          value={[type]}
          onValueChange={(vals) => {
            const next = vals[0] as RecType | undefined;
            if (next) setType(next);
          }}
          className="w-full"
        >
          <ToggleGroupItem value="EXPENSE" className="flex-1">
            {t("types.EXPENSE")}
          </ToggleGroupItem>
          <ToggleGroupItem value="INCOME" className="flex-1">
            {t("types.INCOME")}
          </ToggleGroupItem>
          <ToggleGroupItem value="TRANSFER" className="flex-1">
            {t("types.TRANSFER")}
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("name")}
          </label>
          <Input
            size="touch"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("amount")}
            </label>
            <Input
              size="touch"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("starts")}
            </label>
            <Input
              size="touch"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
          <span className="text-[14px] font-medium">{t("amountVaries")}</span>
          <Switch checked={isEstimate} onCheckedChange={setIsEstimate} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-muted-foreground">
              {t("account")}
            </label>
            <select
              value={effectiveAccountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-12 w-full rounded-xl border bg-card px-3 text-[14px] outline-none"
            >
              {(options.data?.accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          {type !== "TRANSFER" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                {t("category")}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-12 w-full rounded-xl border bg-card px-3 text-[14px] outline-none"
              >
                <option value="">{t("optional")}</option>
                {(options.data?.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("repeats")}
          </label>
          <ToggleGroup
            variant="segmented"
            value={[frequency]}
            onValueChange={(vals) => {
              const next = vals[0] as Freq | undefined;
              if (next) setFrequency(next);
            }}
            className="w-full"
          >
            <ToggleGroupItem value="WEEKLY" className="flex-1">
              {t("freq.WEEKLY")}
            </ToggleGroupItem>
            <ToggleGroupItem value="MONTHLY" className="flex-1">
              {t("freq.MONTHLY")}
            </ToggleGroupItem>
            <ToggleGroupItem value="YEARLY" className="flex-1">
              {t("freq.YEARLY")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Alert variant="notice">
          <Info className="size-4" />
          <AlertDescription>{t("recordsOnlyNotice")}</AlertDescription>
        </Alert>

        <Button
          type="submit"
          size="touch"
          disabled={!valid || createMutation.isPending}
          className="w-full"
        >
          {t("addRecurring")}
        </Button>
      </form>
    </ResponsiveSheet>
  );
}
