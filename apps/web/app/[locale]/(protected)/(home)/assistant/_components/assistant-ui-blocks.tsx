"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type {
  AssistantUiBlock,
  ReconciliationSummary,
} from "@app/api/assistant-types";
import { AccountSwatch, BlazeIcon, Money } from "@/components/finance";
import type { AccountType } from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const MINOR_UNIT = 100;

export type ProposalStateMap = Record<
  string,
  {
    id: string;
    status: string;
    accountId: number | null;
    appliedAt: string | null;
    appliedCount: number;
    summary: ReconciliationSummary | null;
  }
>;

export type AssistantUiBlocksProps = {
  blocks: AssistantUiBlock[];
  proposalStates: ProposalStateMap;
  selectingProposalId?: string | null;
  undoingProposalId?: string | null;
  refreshingProposalId?: string | null;
  onSelectAccount: (proposalId: string, accountId: number) => void;
  onOpenProposal: (proposalId: string) => void;
  onRefreshProposal: (proposalId: string) => void;
  onDismissProposal: (proposalId: string) => void;
  onUndoProposal: (proposalId: string) => void;
  onTriggerUpload: () => void;
  onSendPrompt: (prompt: string) => void;
};

export function AssistantUiBlocks({
  blocks,
  proposalStates,
  selectingProposalId,
  undoingProposalId,
  refreshingProposalId,
  onSelectAccount,
  onOpenProposal,
  onRefreshProposal,
  onDismissProposal,
  onUndoProposal,
  onTriggerUpload,
  onSendPrompt,
}: AssistantUiBlocksProps) {
  const t = useTranslations("Assistant");
  const tFin = useTranslations("Finance");

  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block, idx) => {
        if (block.type === "account_picker") {
          const state = proposalStates[block.proposalId];
          const resolved =
            state && state.status !== "AWAITING_ACCOUNT" && state.accountId != null;
          const dismissed = state?.status === "DISMISSED";
          const busy = selectingProposalId === block.proposalId;

          return (
            <div
              key={`picker-${block.proposalId}-${idx}`}
              className="rounded-2xl border border-assistant-border bg-assistant p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-assistant-accent">
                    <BlazeIcon className="size-4" />
                    {t("blocks.accountPickerEyebrow")}
                  </p>
                  <h3 className="mt-1 text-[15px] font-semibold text-foreground">
                    {t("blocks.accountPickerTitle")}
                  </h3>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {t("blocks.accountPickerMeta", {
                      count: String(block.transactionCount),
                      file: block.sourceFileName || t("blocks.statement"),
                    })}
                    {block.detectedHint ? ` · ${block.detectedHint}` : ""}
                    {block.detectedLast4 ? ` ·· ${block.detectedLast4}` : ""}
                    {block.detectedCurrency ? ` · ${block.detectedCurrency}` : ""}
                  </p>
                </div>
                {resolved && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-positive/12 px-2.5 py-1 text-[12px] font-medium text-positive">
                    <Check className="size-3.5" aria-hidden />
                    {t("blocks.selected")}
                  </span>
                )}
              </div>

              {dismissed ? (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  {t("blocks.dismissed")}
                </p>
              ) : (
                <div className="mt-3 divide-y overflow-hidden rounded-xl border border-assistant-border bg-card">
                  {block.candidates.map((acc) => {
                    const isPicked = resolved && state?.accountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        disabled={Boolean(resolved) || busy}
                        onClick={() => onSelectAccount(block.proposalId, acc.id)}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                          isPicked
                            ? "bg-positive/8"
                            : resolved
                              ? "opacity-50"
                              : "hover:bg-accent/70",
                        )}
                      >
                        <AccountSwatch
                          type={acc.type as AccountType}
                          color={acc.color}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[14px] font-medium">
                              {acc.name}
                            </span>
                            {isPicked && (
                              <CheckCircle2 className="size-4 shrink-0 text-positive" />
                            )}
                          </div>
                          <p className="num truncate text-[12px] text-muted-foreground">
                            {tFin(`accountType.${acc.type as AccountType}`)}
                            {acc.last4 ? ` ·· ${acc.last4}` : ""} · {acc.currency}
                          </p>
                        </div>
                        <Money
                          value={acc.balance}
                          currency={acc.currency}
                          size="row"
                          weight="semibold"
                          className="shrink-0 text-[14px]"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {!resolved && !dismissed && (
                <div className="mt-2.5 flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>{t("blocks.accountPickerZeroTokensHint")}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDismissProposal(block.proposalId)}
                    className="font-medium text-muted-foreground hover:text-foreground"
                  >
                    {t("blocks.dismiss")}
                  </button>
                </div>
              )}
            </div>
          );
        }

        if (block.type === "statement_proposal") {
          const state = proposalStates[block.proposalId];
          const status = state?.status ?? "PENDING";
          const summary = state?.summary ?? block.summary;
          const currency = summary.accountCurrency;
          const isApplied = status === "APPLIED";
          const isDismissed = status === "DISMISSED";
          const isSuperseded = status === "SUPERSEDED";
          const isGap = summary.status === "GAP_DETECTED";
          const isMatched = summary.status === "MATCHED";

          if (isDismissed) {
            return (
              <div
                key={`prop-${block.proposalId}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-dashed bg-muted/40 px-3.5 py-2.5 text-[13px] text-muted-foreground"
              >
                <span>
                  {summary.accountName} · {t("blocks.dismissed")}
                </span>
              </div>
            );
          }

          return (
            <div
              key={`prop-${block.proposalId}-${idx}`}
              className={cn(
                "rounded-2xl border p-4 transition-opacity",
                isApplied
                  ? "border-positive/30 bg-positive/6"
                  : isSuperseded
                    ? "border-border bg-muted/35 opacity-70"
                    : "border-assistant-border bg-assistant",
              )}
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <AccountSwatch
                    type={summary.accountType as AccountType}
                    color={summary.accountColor}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold">
                      {summary.accountName}
                      {summary.accountLast4 ? ` ·· ${summary.accountLast4}` : ""}
                    </h3>
                    <p className="num text-[12px] text-muted-foreground">
                      {summary.statementPeriodFrom && summary.statementPeriodTo
                        ? `${summary.statementPeriodFrom} → ${summary.statementPeriodTo}`
                        : summary.sourceFiles.join(", ")}
                      {summary.statementsCount > 1
                        ? ` · ${t("blocks.mergedStatements", { count: String(summary.statementsCount) })}`
                        : ""}
                    </p>
                  </div>
                </div>

                {/* Status pill */}
                {isApplied ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-positive/15 px-2.5 py-1 text-[12px] font-semibold text-positive">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {t("blocks.appliedBadge", {
                      count: String(state?.appliedCount ?? summary.selectedCount),
                    })}
                  </span>
                ) : isSuperseded ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
                    {t("blocks.supersededBadge")}
                  </span>
                ) : isMatched ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-positive/15 px-2.5 py-1 text-[12px] font-semibold text-positive">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {t("blocks.balanceMatchedBadge")}
                  </span>
                ) : isGap ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-[12px] font-semibold text-warning">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    {t("blocks.balanceGapBadge")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-medium text-primary-text">
                    <Sparkles className="size-3.5" aria-hidden />
                    {t("blocks.readyBadge")}
                  </span>
                )}
              </div>

              {/* Cutoff / anchor indicator */}
              {summary.duplicateCount > 0 && summary.anchorDescription && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-card/80 px-3 py-2 text-[12px] text-muted-foreground ring-1 ring-border/70">
                  <Check className="size-3.5 shrink-0 text-positive" aria-hidden />
                  <span className="truncate">
                    {t("blocks.anchorFound", {
                      anchor: summary.anchorDescription,
                      skipped: String(summary.duplicateCount),
                    })}
                  </span>
                </div>
              )}

              {/* Balance equation grid */}
              <div className="mt-3 grid grid-cols-3 divide-x overflow-hidden rounded-xl border border-assistant-border/80 bg-card text-center">
                <div className="px-2.5 py-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t("blocks.dbBalance")}
                  </p>
                  <p className="mt-0.5">
                    <Money
                      value={summary.dbBalanceAtPeriodEndMinor / MINOR_UNIT}
                      currency={currency}
                      size="row"
                      weight="semibold"
                      className="text-[13px] sm:text-[14px]"
                    />
                  </p>
                </div>
                <div className="px-2.5 py-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t("blocks.netToAdd", { count: String(summary.selectedCount) })}
                  </p>
                  <p className="mt-0.5">
                    <Money
                      value={summary.selectedDeltaMinor / MINOR_UNIT}
                      currency={currency}
                      tone="movement"
                      kind={summary.selectedDeltaMinor >= 0 ? "INCOME" : "EXPENSE"}
                      size="row"
                      weight="semibold"
                      className="text-[13px] sm:text-[14px]"
                    />
                  </p>
                </div>
                <div className="px-2.5 py-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t("blocks.projectedBalance")}
                  </p>
                  <p className="mt-0.5">
                    <Money
                      value={summary.projectedBalanceMinor / MINOR_UNIT}
                      currency={currency}
                      size="row"
                      weight="semibold"
                      className={cn(
                        "text-[13px] sm:text-[14px]",
                        isMatched && "text-positive",
                        isGap && "text-warning",
                      )}
                    />
                  </p>
                </div>
              </div>

              {/* Statement closing comparison */}
              {summary.statementClosingBalanceMinor != null && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px]">
                  <span className="text-muted-foreground">
                    {t("blocks.statementClosing")}:{" "}
                    <strong className="num text-foreground">
                      <Money
                        value={summary.statementClosingBalanceMinor / MINOR_UNIT}
                        currency={currency}
                      />
                    </strong>
                  </span>
                  {summary.discrepancyMinor != null &&
                    summary.discrepancyMinor !== 0 && (
                      <span className="num font-semibold text-warning">
                        {t("blocks.difference")}:{" "}
                        <Money
                          value={summary.discrepancyMinor / MINOR_UNIT}
                          currency={currency}
                          tone="movement"
                          kind={summary.discrepancyMinor >= 0 ? "INCOME" : "EXPENSE"}
                        />
                      </span>
                    )}
                </div>
              )}

              {/* Internal PDF math audit badge */}
              {summary.internalAudit &&
                (summary.internalAudit.statementTotalChargesMinor != null ||
                  summary.internalAudit.statementTotalCreditsMinor != null) && (
                  <div
                    className={cn(
                      "mt-2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium",
                      summary.internalAudit.ok
                        ? "bg-positive/10 text-positive"
                        : "bg-warning/12 text-warning",
                    )}
                  >
                    {summary.internalAudit.ok ? (
                      <>
                        <Check className="size-3.5 shrink-0" />
                        <span>{t("blocks.internalAuditOk")}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span>{t("blocks.internalAuditWarn")}</span>
                      </>
                    )}
                  </div>
                )}

              {/* Compact stat pills */}
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-foreground ring-1 ring-border">
                  <FileSpreadsheet className="size-3 text-muted-foreground" />
                  {t("blocks.newCount", { count: String(summary.newCount) })}
                </span>
                {summary.duplicateCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    {t("blocks.dupCount", { count: String(summary.duplicateCount) })}
                  </span>
                )}
                {summary.transferMatchCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary-text">
                    <Link2 className="size-3" />
                    {t("blocks.transferMatchesCount", {
                      count: String(summary.transferMatchCount),
                    })}
                  </span>
                )}
                {summary.unmatchedTransferCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    <ArrowLeftRight className="size-3" />
                    {t("blocks.unmatchedTransfersCount", {
                      count: String(summary.unmatchedTransferCount),
                    })}
                  </span>
                )}
              </div>

              {/* Actions */}
              {!isSuperseded && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {isApplied ? (
                    <>
                      <Link
                        href={`/accounts/${summary.accountId}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-[13px] font-semibold text-foreground hover:bg-accent"
                      >
                        <ArrowUpRight className="size-3.5" />
                        {t("blocks.viewAccount")}
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={undoingProposalId === block.proposalId}
                        onClick={() => onUndoProposal(block.proposalId)}
                        className="h-9 rounded-xl text-[13px] text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="mr-1.5 size-3.5" />
                        {undoingProposalId === block.proposalId
                          ? t("blocks.undoing")
                          : t("blocks.undoBatch")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="default"
                        onClick={() => onOpenProposal(block.proposalId)}
                        className="h-10 rounded-xl px-4 text-[13px] font-semibold"
                      >
                        <ListChecks className="mr-1.5 size-4" />
                        {t("blocks.reviewTransactions", {
                          count: String(summary.selectedCount),
                        })}
                      </Button>
                      {isGap && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onTriggerUpload}
                          className="h-10 rounded-xl border-assistant-border bg-card px-3.5 text-[13px] font-semibold"
                        >
                          <Upload className="mr-1.5 size-3.5" />
                          {t("blocks.uploadPrevious")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={refreshingProposalId === block.proposalId}
                        onClick={() => onRefreshProposal(block.proposalId)}
                        aria-label={t("blocks.refreshBalance")}
                        title={t("blocks.refreshBalance")}
                        className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw
                          className={cn(
                            "size-4",
                            refreshingProposalId === block.proposalId &&
                              "animate-spin",
                          )}
                        />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDismissProposal(block.proposalId)}
                        aria-label={t("blocks.dismiss")}
                        className="ml-auto size-9 rounded-xl text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        }

        if (block.type === "transfer_matches") {
          const state = proposalStates[block.proposalId];
          const isSuperseded =
            state?.status === "SUPERSEDED" || state?.status === "DISMISSED";
          if (isSuperseded || block.matches.length === 0) return null;

          return (
            <div
              key={`tmatch-${block.proposalId}-${idx}`}
              className="rounded-2xl border border-primary/25 bg-primary/5 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-primary-text">
                  <Link2 className="size-3.5" aria-hidden />
                  {t("blocks.transferMatchesTitle", {
                    count: String(block.matches.length),
                  })}
                </p>
                {state?.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => onOpenProposal(block.proposalId)}
                    className="text-[12px] font-semibold text-primary-text hover:underline"
                  >
                    {t("blocks.inspectInDrawer")}
                  </button>
                )}
              </div>

              <div className="mt-2.5 divide-y overflow-hidden rounded-xl border bg-card">
                {block.matches.map((m) => (
                  <div
                    key={`${m.rowUid}-${m.existingRecordId}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {block.accountName} ↔ {m.existingAccountName}
                      </p>
                      <p className="num truncate text-[12px] text-muted-foreground">
                        {m.rowDate} ↔ {m.existingDate} ·{" "}
                        {m.daysDiff === 0
                          ? t("blocks.sameDay")
                          : t("blocks.daysDiff", { days: String(m.daysDiff) })}
                        {m.existingNote ? ` · ${m.existingNote}` : ""}
                      </p>
                    </div>
                    <Money
                      value={Math.abs(m.rowAmountMinor) / MINOR_UNIT}
                      currency={m.currency}
                      kind="TRANSFER"
                      size="row"
                      weight="semibold"
                      className="shrink-0 text-[13px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (block.type === "data_table") {
          return (
            <div
              key={`tbl-${idx}`}
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
                <div>
                  <p className="text-[13px] font-semibold">{block.title}</p>
                  {block.subtitle && (
                    <p className="text-[12px] text-muted-foreground">
                      {block.subtitle}
                    </p>
                  )}
                </div>
                {block.link && (
                  <Link
                    href={block.link.href}
                    className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold text-primary-text hover:bg-accent"
                  >
                    {block.link.label}
                    <ArrowUpRight className="size-3" />
                  </Link>
                )}
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-[12px] sm:text-[13px]">
                  <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                    <tr className="border-b text-left text-[11px] font-medium text-muted-foreground">
                      {block.columns.map((col, cIdx) => (
                        <th
                          key={cIdx}
                          className={cn(
                            "px-3 py-2",
                            cIdx === block.columns.length - 1 && "text-right",
                          )}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {block.rows.map((r, rIdx) => (
                      <tr key={rIdx} className="hover:bg-accent/40">
                        {r.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={cn(
                              "px-3 py-2",
                              cIdx === r.length - 1 &&
                                "num whitespace-nowrap text-right font-semibold",
                            )}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {block.footer && (
                <p className="border-t px-3.5 py-2 text-[12px] text-muted-foreground">
                  {block.footer}
                </p>
              )}
            </div>
          );
        }

        if (block.type === "quick_actions") {
          return (
            <div key={`qa-${idx}`} className="flex flex-wrap gap-2">
              {block.actions.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    if (act.kind === "upload_previous_statement") {
                      onTriggerUpload();
                    } else if (act.kind === "open_proposal" && act.proposalId) {
                      onOpenProposal(act.proposalId);
                    } else if (act.kind === "prompt" && act.prompt) {
                      onSendPrompt(act.prompt);
                    }
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {act.kind === "upload_previous_statement" && (
                    <Upload className="size-3.5 text-primary-text" />
                  )}
                  {act.kind === "open_proposal" && (
                    <ListChecks className="size-3.5 text-primary-text" />
                  )}
                  {act.label}
                </button>
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
