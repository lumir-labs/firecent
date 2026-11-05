"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightLeft, BanknoteArrowDown, BanknoteArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@app/api/client";

import { LucideIcon } from "@/components/common/lucide-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type RecordType = "EXPENSE" | "INCOME" | "TRANSFER";
type PaymentType = "CASH" | "CREDIT_CARD" | "WEB_PAYMENT";

const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TYPES: {
  value: RecordType;
  icon: typeof Plus;
  /** Selected state, built from theme tokens. */
  on: string;
}[] = [
  { value: "EXPENSE", icon: BanknoteArrowDown, on: "border-destructive bg-destructive/10 text-destructive" },
  { value: "INCOME", icon: BanknoteArrowUp, on: "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { value: "TRANSFER", icon: ArrowRightLeft, on: "border-primary bg-primary/10 text-primary" },
];

/**
 * Floating "new transaction" button + form.
 * Sits above the mobile bottom nav (`bottom-24`) and in the corner on desktop.
 */
export function AddRecord() {
  const t = useTranslations("Transactions.add");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="icon-lg"
            aria-label={t("open")}
            className="fixed right-5 bottom-24 z-40 size-14 rounded-full shadow-lg shadow-primary/30 sm:right-8 sm:bottom-8 [&_svg]:size-6"
          >
            <Plus />
          </Button>
        }
      />
      <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-lg">
        {/* Remount on every open → the form starts clean with today's date. */}
        {open && <AddRecordForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AddRecordForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("Transactions.add");
  const utils = trpc.useUtils();
  const options = trpc.records.formOptions.useQuery();

  const [type, setType] = useState<RecordType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [transferAccountId, setTransferAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [payeeId, setPayeeId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("CASH");
  const [recordDate, setRecordDate] = useState(today);
  const [recordTime, setRecordTime] = useState(nowTime);
  const [note, setNote] = useState("");

  const create = trpc.records.create.useMutation({
    onSuccess: async () => {
      toast.success(t("created"));
      await Promise.all([
        utils.records.list.invalidate(),
        utils.dashboard.netWorth.invalidate(),
      ]);
      onDone();
    },
    onError: () => toast.error(t("error")),
  });

  const accounts = options.data?.accounts ?? [];
  const categories = options.data?.categories ?? [];
  const payees = options.data?.payees ?? [];
  const parents = categories.filter((c) => c.parentId === null);
  const childrenOf = (id: number) => categories.filter((c) => c.parentId === id);
  const nameOf = <T extends { id: number; name: string }>(list: T[], id: string | null) =>
    list.find((x) => String(x.id) === id)?.name ?? "";

  const cents = Math.round(Number.parseFloat(amount) * 100);
  const isTransfer = type === "TRANSFER";
  const valid =
    Number.isFinite(cents) &&
    cents > 0 &&
    !!accountId &&
    (!isTransfer || (!!transferAccountId && transferAccountId !== accountId));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || create.isPending) return;
    create.mutate({
      type,
      amount: cents,
      accountId: Number(accountId),
      transferAccountId: isTransfer ? Number(transferAccountId) : null,
      categoryId: !isTransfer && categoryId ? Number(categoryId) : null,
      payeeId: !isTransfer && payeeId ? Number(payeeId) : null,
      paymentType,
      note: note.trim() || null,
      recordDate,
      recordTime,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("description")}</DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label={t("type")} className="grid grid-cols-3 gap-2">
        {TYPES.map(({ value, icon: Icon, on }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => setType(value)}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium text-muted-foreground transition-colors hover:bg-muted",
              type === value && on,
            )}
          >
            <Icon className="size-5" />
            {t(`types.${value}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1">
        <Label htmlFor="amount" className="sr-only">
          {t("amount")}
        </Label>
        <input
          id="amount"
          inputMode="decimal"
          type="number"
          step="0.01"
          min="0"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          placeholder="0.00"
          className="w-full bg-transparent text-center text-4xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>

      <div className={cn("grid gap-4", isTransfer && "sm:grid-cols-2")}>
        <Field label={isTransfer ? t("from") : t("account")}>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full" disabled={options.isPending}>
              <SelectValue placeholder={t("pickAccount")}>
                {(v: string | null) => nameOf(accounts, v) || t("pickAccount")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  <Swatch color={a.color} />
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {isTransfer && (
          <Field label={t("to")}>
            <Select value={transferAccountId} onValueChange={setTransferAccountId}>
              <SelectTrigger className="w-full" disabled={options.isPending}>
                <SelectValue placeholder={t("pickAccount")}>
                  {(v: string | null) => nameOf(accounts, v) || t("pickAccount")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => String(a.id) !== accountId)
                  .map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      <Swatch color={a.color} />
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      {!isTransfer && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("category")}>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full" disabled={options.isPending}>
                <SelectValue placeholder={t("optional")}>
                  {(v: string | null) => nameOf(categories, v) || t("optional")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {parents.map((parent) => (
                  <SelectGroup key={parent.id}>
                    <SelectLabel>{parent.name}</SelectLabel>
                    <SelectItem value={String(parent.id)}>
                      <CategoryIcon icon={parent.icon} color={parent.color} />
                      {parent.name}
                    </SelectItem>
                    {childrenOf(parent.id).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)} className="pl-6">
                        <CategoryIcon icon={c.icon} color={c.color} />
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("payee")}>
            <Select value={payeeId} onValueChange={setPayeeId}>
              <SelectTrigger className="w-full" disabled={options.isPending}>
                <SelectValue placeholder={t("optional")}>
                  {(v: string | null) => nameOf(payees, v) || t("optional")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {payees.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("date")}>
          <Input
            type="date"
            value={recordDate}
            onChange={(e) => setRecordDate(e.target.value)}
            required
          />
        </Field>
        <Field label={t("time")}>
          <Input
            type="time"
            value={recordTime}
            onChange={(e) => setRecordTime(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label={t("paymentType")}>
        <Select value={paymentType} onValueChange={(v) => v && setPaymentType(v as PaymentType)}>
          <SelectTrigger className="w-full">
            <SelectValue>{(v: PaymentType) => t(`payment.${v}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(["CASH", "CREDIT_CARD", "WEB_PAYMENT"] as const).map((v) => (
              <SelectItem key={v} value={v}>
                {t(`payment.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t("note")}>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("optional")}
          rows={2}
          maxLength={500}
        />
      </Field>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          {t("cancel")}
        </DialogClose>
        <Button type="submit" disabled={!valid || create.isPending}>
          {create.isPending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Swatch({ color }: { color: string | null }) {
  return (
    <span
      className={cn("size-2.5 shrink-0 rounded-full", !color && "bg-muted-foreground")}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

function CategoryIcon({ icon, color }: { icon: string | null; color: string | null }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded [&_svg]:size-3",
        color ? "text-white" : "bg-primary/10 text-primary",
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      <LucideIcon iconName={icon} strokeWidth={2} />
    </span>
  );
}
