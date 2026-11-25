import * as webpush from "web-push";
import { db } from "@app/db";
import {
  computeLastCycleDate,
  computeNextCycleDate,
  summarizeCardInstallments,
} from "./card-cycle";

const MINOR_UNIT = 100;
const DAY_MS = 86_400_000;
const USER_BATCH_SIZE = 100;
const MAX_BATCHES_PER_TICK = 20;
const PUSH_CONCURRENCY = 20;

let vapidInitialized = false;
let dispatchInProgress = false;

function stripWrappingQuotes(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function normalizeVapidSubject(raw: string | undefined): string {
  const fallback = "mailto:hello@firecent.app";
  let candidate = stripWrappingQuotes(raw);
  if (!candidate) return fallback;

  if (!/^(mailto:|https?:\/\/)/i.test(candidate)) {
    candidate = candidate.includes("@")
      ? `mailto:${candidate}`
      : `https://${candidate}`;
  } else if (/^http:\/\//i.test(candidate)) {
    candidate = candidate.replace(/^http:\/\//i, "https://");
  }

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol === "mailto:" || parsed.protocol === "https:") &&
      parsed.hostname !== "localhost"
    ) {
      return candidate;
    }
  } catch {
    // fall through to safe default
  }
  return fallback;
}

export function getVapidConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} | null {
  const publicKey = stripWrappingQuotes(process.env.VAPID_PUBLIC_KEY);
  const privateKey = stripWrappingQuotes(process.env.VAPID_PRIVATE_KEY);
  const subject = normalizeVapidSubject(process.env.VAPID_SUBJECT);
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return getVapidConfig() !== null;
}

export function getVapidPublicKey(): string | null {
  return getVapidConfig()?.publicKey ?? null;
}

function ensureVapidConfigured(): boolean {
  const cfg = getVapidConfig();
  if (!cfg) return false;
  if (!vapidInitialized) {
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
    vapidInitialized = true;
  }
  return true;
}

// ── Timezone & Schedule Helpers ────────────────────────────────────────────

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseDailyTime(dailyTime: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(dailyTime.trim());
  if (!m) return { hour: 8, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(m[1])));
  const minute = Math.min(59, Math.max(0, Number(m[2])));
  return { hour, minute };
}

export function getLocalDateParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateKey: string;
} {
  const safeTz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const pick = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = pick("hour") % 24;
  const minute = pick("minute");
  const second = pick("second");
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, hour, minute, second, dateKey };
}

/**
 * Resolves a wall-clock time (year, month, day, hour, minute) in `timeZone`
 * into an exact UTC `Date`. Two iterations handle DST transitions cleanly.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const safeTz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const desiredUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = new Date(desiredUtcMs);
  for (let i = 0; i < 2; i++) {
    const local = getLocalDateParts(guess, safeTz);
    const actualAsUtcMs = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
      0,
    );
    const diffMs = desiredUtcMs - actualAsUtcMs;
    if (diffMs === 0) break;
    guess = new Date(guess.getTime() + diffMs);
  }
  return guess;
}

/**
 * Computes the next UTC instant matching `dailyTime` ("HH:MM") in `timeZone`.
 * If today's slot has already passed OR `skipDateKey` equals today's local date,
 * schedules tomorrow's slot.
 */
export function computeNextRunAt(
  dailyTime: string,
  timeZone: string,
  now = new Date(),
  skipDateKey?: string | null,
): Date {
  const safeTz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const { hour, minute } = parseDailyTime(dailyTime);
  const localNow = getLocalDateParts(now, safeTz);

  const todayCandidate = zonedTimeToUtc(
    localNow.year,
    localNow.month,
    localNow.day,
    hour,
    minute,
    safeTz,
  );

  if (todayCandidate.getTime() > now.getTime() && skipDateKey !== localNow.dateKey) {
    return todayCandidate;
  }

  // Advance calendar day safely via UTC date roll-over
  const tomorrowCal = new Date(
    Date.UTC(localNow.year, localNow.month - 1, localNow.day + 1),
  );
  return zonedTimeToUtc(
    tomorrowCal.getUTCFullYear(),
    tomorrowCal.getUTCMonth() + 1,
    tomorrowCal.getUTCDate(),
    hour,
    minute,
    safeTz,
  );
}

// ── Pending Digest Types & Formatter ───────────────────────────────────────

export type DigestItemKind =
  | "card_payment"
  | "card_cutoff"
  | "recurring"
  | "debt"
  | "installment";

export type DigestItem = {
  id: string;
  kind: DigestItemKind;
  title: string;
  subtitle: string;
  dueDate: string | null;
  dueInDays: number | null;
  amount: number | null;
  currency: string;
  href: string;
  priority: number; // lower = more urgent
};

export type DigestPreferenceFlags = {
  advanceDays: number;
  notifyCardPayments: boolean;
  notifyCardCutoffs: boolean;
  notifyRecurrings: boolean;
  notifyDebts: boolean;
  notifyInstallments: boolean;
  locale: string;
};

export type PendingDigest = {
  items: DigestItem[];
  title: string;
  body: string;
  url: string;
  tag: string;
};

type OrgBatchData = {
  cards: {
    id: number;
    organizationId: string;
    name: string;
    currency: string;
    interestRate: number | null;
    paymentDayType: "MONTHLY_DAY" | "EVERY_X_DAYS" | null;
    paymentDay: number | null;
    paymentEveryDays: number | null;
    paymentAnchorDate: Date | null;
    cutoffDayType: "MONTHLY_DAY" | "EVERY_X_DAYS" | null;
    cutoffDay: number | null;
    cutoffEveryDays: number | null;
    cutoffAnchorDate: Date | null;
  }[];
  balanceByCard: Map<number, number>;
  lastPaymentByCard: Map<number, Date>;
  installmentsByCard: Map<
    number,
    {
      title: string;
      totalAmount: number;
      totalInstallments: number;
      paidInstallments: number;
      monthlyAmount: number;
      interestRate: number;
      includedInBalance: boolean;
    }[]
  >;
  recurrings: {
    id: number;
    organizationId: string;
    name: string;
    type: "EXPENSE" | "INCOME" | "TRANSFER";
    amount: number;
    nextDate: Date | null;
    accountId: number;
  }[];
  pendingOccurrences: {
    id: number;
    dueDate: Date;
    amount: number;
    recurring: {
      id: number;
      organizationId: string;
      name: string;
      type: "EXPENSE" | "INCOME" | "TRANSFER";
      accountId: number;
    };
  }[];
  debts: {
    id: number;
    organizationId: string;
    type: "ANYONE_TO_ME" | "ME_TO_ANYONE";
    name: string;
    amount: number;
    remainingAmount: number | null;
    currency: string;
    payBackDate: Date | null;
    account: { currency: string } | null;
  }[];
  currencyByAccount: Map<number, string>;
};

function daysBetweenUtc(target: Date, now: Date): number {
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const targetUtc = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()),
  );
  return Math.round((targetUtc.getTime() - todayUtc.getTime()) / DAY_MS);
}

function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-SV", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatDuePhrase(days: number | null, locale: string): string {
  const isEn = locale === "en";
  if (days === null) return "";
  if (days < 0) {
    const abs = Math.abs(days);
    return isEn
      ? `overdue ${abs}d`
      : `vencido hace ${abs}d`;
  }
  if (days === 0) return isEn ? "today" : "hoy";
  if (days === 1) return isEn ? "tomorrow" : "mañana";
  return isEn ? `in ${days}d` : `en ${days}d`;
}

/**
 * Fetches domain data for up to 100 organizations in a fixed, constant number
 * of batched SQL queries (no N+1 per user).
 */
async function fetchBatchedOrgData(
  orgIds: string[],
  maxAdvanceDays: number,
  now = new Date(),
): Promise<OrgBatchData> {
  if (orgIds.length === 0) {
    return {
      cards: [],
      balanceByCard: new Map(),
      lastPaymentByCard: new Map(),
      installmentsByCard: new Map(),
      recurrings: [],
      pendingOccurrences: [],
      debts: [],
      currencyByAccount: new Map(),
    };
  }

  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const horizonDate = new Date(todayUtc.getTime() + maxAdvanceDays * DAY_MS);

  const [accounts, recurrings, pendingOccurrences, debts] = await Promise.all([
    db.bankAccount.findMany({
      where: {
        organizationId: { in: orgIds },
        deletedAt: null,
        archived: false,
        isActive: true,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        type: true,
        currency: true,
        interestRate: true,
        paymentDayType: true,
        paymentDay: true,
        paymentEveryDays: true,
        paymentAnchorDate: true,
        cutoffDayType: true,
        cutoffDay: true,
        cutoffEveryDays: true,
        cutoffAnchorDate: true,
      },
    }),
    db.recurring.findMany({
      where: {
        organizationId: { in: orgIds },
        deletedAt: null,
        pausedAt: null,
        nextDate: { lte: horizonDate },
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        type: true,
        amount: true,
        nextDate: true,
        accountId: true,
      },
    }),
    db.recurringOccurrence.findMany({
      where: {
        status: "PENDING",
        dueDate: { lte: horizonDate },
        recurring: {
          organizationId: { in: orgIds },
          deletedAt: null,
          pausedAt: null,
        },
      },
      select: {
        id: true,
        dueDate: true,
        amount: true,
        recurring: {
          select: {
            id: true,
            organizationId: true,
            name: true,
            type: true,
            accountId: true,
          },
        },
      },
    }),
    db.debt.findMany({
      where: {
        organizationId: { in: orgIds },
        deletedAt: null,
        paidBack: false,
        payBackDate: { not: null, lte: horizonDate },
      },
      select: {
        id: true,
        organizationId: true,
        type: true,
        name: true,
        amount: true,
        remainingAmount: true,
        currency: true,
        payBackDate: true,
        account: { select: { currency: true } },
      },
    }),
  ]);

  const currencyByAccount = new Map<number, string>();
  const cards: OrgBatchData["cards"] = [];
  for (const a of accounts) {
    currencyByAccount.set(a.id, a.currency);
    if (a.type === "CREDIT_CARD") {
      cards.push(a);
    }
  }

  const cardIds = cards.map((c) => c.id);
  const rollingCardIds = cards
    .filter(
      (c) =>
        c.paymentDayType === "EVERY_X_DAYS" &&
        c.paymentEveryDays != null &&
        !c.paymentAnchorDate,
    )
    .map((c) => c.id);

  const [cardSums, lastPayments, installments] =
    cardIds.length > 0
      ? await Promise.all([
          db.record.groupBy({
            by: ["accountId"],
            where: {
              accountId: { in: cardIds },
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
          rollingCardIds.length > 0
            ? db.record.groupBy({
                by: ["accountId"],
                where: {
                  accountId: { in: rollingCardIds },
                  deletedAt: null,
                  amount: { gt: 0 },
                  recordDate: { not: null },
                },
                _max: { recordDate: true },
              })
            : Promise.resolve([]),
          db.cardInstallment.findMany({
            where: {
              accountId: { in: cardIds },
              deletedAt: null,
            },
            select: {
              accountId: true,
              title: true,
              totalAmount: true,
              totalInstallments: true,
              paidInstallments: true,
              monthlyAmount: true,
              interestRate: true,
              includedInBalance: true,
            },
          }),
        ])
      : [[], [], []];

  const balanceByCard = new Map<number, number>();
  for (const s of cardSums) {
    balanceByCard.set(s.accountId, s._sum.amount ?? 0);
  }

  const lastPaymentByCard = new Map<number, Date>();
  for (const lp of lastPayments) {
    if (lp._max.recordDate) {
      lastPaymentByCard.set(lp.accountId, lp._max.recordDate);
    }
  }

  const installmentsByCard = new Map<number, OrgBatchData["installmentsByCard"] extends Map<number, infer V> ? V : never>();
  for (const inst of installments) {
    const list = installmentsByCard.get(inst.accountId) ?? [];
    list.push({
      title: inst.title,
      totalAmount: inst.totalAmount / MINOR_UNIT,
      totalInstallments: inst.totalInstallments,
      paidInstallments: inst.paidInstallments,
      monthlyAmount: inst.monthlyAmount / MINOR_UNIT,
      interestRate: inst.interestRate,
      includedInBalance: inst.includedInBalance,
    });
    installmentsByCard.set(inst.accountId, list);
  }

  return {
    cards,
    balanceByCard,
    lastPaymentByCard,
    installmentsByCard,
    recurrings,
    pendingOccurrences,
    debts,
    currencyByAccount,
  };
}

/**
 * Pure in-memory digest builder for a single user/org from pre-fetched batch data.
 */
function buildDigestFromBatch(
  orgId: string,
  prefs: DigestPreferenceFlags,
  data: OrgBatchData,
  now = new Date(),
  cashPaymentOverrides?: Map<number, number>,
): PendingDigest {
  const isEn = prefs.locale === "en";
  const horizon = Math.max(0, Math.min(14, prefs.advanceDays));
  const items: DigestItem[] = [];

  const orgCards = data.cards.filter((c) => c.organizationId === orgId);

  // 1) Credit card payments & cutoffs
  for (const card of orgCards) {
    const balanceMinor = data.balanceByCard.get(card.id) ?? 0;
    const debt = Math.max(0, -balanceMinor) / MINOR_UNIT;
    const insts = data.installmentsByCard.get(card.id) ?? [];
    const instSummary = summarizeCardInstallments(debt, insts);

    if (prefs.notifyCardPayments && debt > 0.005) {
      const due = computeNextCycleDate(
        card.paymentDayType,
        card.paymentDay,
        card.paymentEveryDays,
        card.paymentAnchorDate,
        data.lastPaymentByCard.get(card.id) ?? null,
        now,
      );
      if (due.nextDate && due.inDays !== null && due.inDays <= horizon) {
        const cashDue = cashPaymentOverrides?.get(card.id) ?? debt;
        const amount = cashDue > 0.005 ? cashDue : debt;
        const phrase = formatDuePhrase(due.inDays, prefs.locale);
        items.push({
          id: `card-pay-${card.id}`,
          kind: "card_payment",
          title: isEn ? `Pay ${card.name}` : `Pagar ${card.name}`,
          subtitle: isEn
            ? `${formatMoney(amount, card.currency, prefs.locale)} · due ${phrase}`
            : `${formatMoney(amount, card.currency, prefs.locale)} · vence ${phrase}`,
          dueDate: due.nextDate,
          dueInDays: due.inDays,
          amount,
          currency: card.currency,
          href: `/accounts/${card.id}`,
          priority: due.inDays <= 0 ? 0 : 10 + due.inDays,
        });
      }
    }

    if (prefs.notifyCardCutoffs) {
      const cutoff = computeNextCycleDate(
        card.cutoffDayType,
        card.cutoffDay,
        card.cutoffEveryDays,
        card.cutoffAnchorDate,
        null,
        now,
      );
      if (cutoff.nextDate && cutoff.inDays !== null && cutoff.inDays <= Math.min(horizon, 2)) {
        const phrase = formatDuePhrase(cutoff.inDays, prefs.locale);
        items.push({
          id: `card-cutoff-${card.id}`,
          kind: "card_cutoff",
          title: isEn ? `Cutoff ${card.name}` : `Corte ${card.name}`,
          subtitle: isEn
            ? `Statement closes ${phrase}`
            : `Cierra estado de cuenta ${phrase}`,
          dueDate: cutoff.nextDate,
          dueInDays: cutoff.inDays,
          amount: debt > 0 ? debt : null,
          currency: card.currency,
          href: `/accounts/${card.id}`,
          priority: 40 + cutoff.inDays,
        });
      }
    }

    if (prefs.notifyInstallments && instSummary.activeCount > 0) {
      const due = computeNextCycleDate(
        card.paymentDayType,
        card.paymentDay,
        card.paymentEveryDays,
        card.paymentAnchorDate,
        data.lastPaymentByCard.get(card.id) ?? null,
        now,
      );
      if (due.nextDate && due.inDays !== null && due.inDays <= horizon) {
        const phrase = formatDuePhrase(due.inDays, prefs.locale);
        items.push({
          id: `card-inst-${card.id}`,
          kind: "installment",
          title: isEn
            ? `Installments · ${card.name}`
            : `Cuotas a plazos · ${card.name}`,
          subtitle: isEn
            ? `${instSummary.activeCount} active (${formatMoney(instSummary.monthlyTotal, card.currency, prefs.locale)}/mo) · ${phrase}`
            : `${instSummary.activeCount} activas (${formatMoney(instSummary.monthlyTotal, card.currency, prefs.locale)}/mes) · ${phrase}`,
          dueDate: due.nextDate,
          dueInDays: due.inDays,
          amount: instSummary.monthlyTotal,
          currency: card.currency,
          href: `/accounts/${card.id}`,
          priority: 50 + due.inDays,
        });
      }
    }
  }

  // 2) Recurring occurrences & upcoming recurrings (deduplicated by recurringId)
  if (prefs.notifyRecurrings) {
    const seenRecIds = new Set<number>();
    const orgOccs = data.pendingOccurrences.filter(
      (o) => o.recurring.organizationId === orgId,
    );
    for (const occ of orgOccs) {
      const days = daysBetweenUtc(occ.dueDate, now);
      if (days > horizon) continue;
      seenRecIds.add(occ.recurring.id);
      const currency = data.currencyByAccount.get(occ.recurring.accountId) ?? "USD";
      const amount = Math.abs(occ.amount) / MINOR_UNIT;
      const phrase = formatDuePhrase(days, prefs.locale);
      items.push({
        id: `rec-occ-${occ.id}`,
        kind: "recurring",
        title: occ.recurring.name,
        subtitle: isEn
          ? `${formatMoney(amount, currency, prefs.locale)} · ${phrase}`
          : `${formatMoney(amount, currency, prefs.locale)} · ${phrase}`,
        dueDate: occ.dueDate.toISOString().slice(0, 10),
        dueInDays: days,
        amount,
        currency,
        href: "/recurring",
        priority: days <= 0 ? 5 : 20 + days,
      });
    }

    const orgRecs = data.recurrings.filter(
      (r) => r.organizationId === orgId && !seenRecIds.has(r.id),
    );
    for (const rec of orgRecs) {
      if (!rec.nextDate) continue;
      const days = daysBetweenUtc(rec.nextDate, now);
      if (days > horizon) continue;
      const currency = data.currencyByAccount.get(rec.accountId) ?? "USD";
      const amount = Math.abs(rec.amount) / MINOR_UNIT;
      const phrase = formatDuePhrase(days, prefs.locale);
      items.push({
        id: `rec-${rec.id}`,
        kind: "recurring",
        title: rec.name,
        subtitle: isEn
          ? `${formatMoney(amount, currency, prefs.locale)} · ${phrase}`
          : `${formatMoney(amount, currency, prefs.locale)} · ${phrase}`,
        dueDate: rec.nextDate.toISOString().slice(0, 10),
        dueInDays: days,
        amount,
        currency,
        href: "/recurring",
        priority: days <= 0 ? 6 : 25 + days,
      });
    }
  }

  // 3) Debts with upcoming payBackDate
  if (prefs.notifyDebts) {
    const orgDebts = data.debts.filter((d) => d.organizationId === orgId);
    for (const debt of orgDebts) {
      if (!debt.payBackDate) continue;
      const days = daysBetweenUtc(debt.payBackDate, now);
      if (days > horizon) continue;
      const remaining =
        Math.abs(debt.remainingAmount ?? debt.amount) / MINOR_UNIT;
      if (remaining <= 0.005) continue;
      const currency = debt.account?.currency || debt.currency || "USD";
      const phrase = formatDuePhrase(days, prefs.locale);
      const verb =
        debt.type === "ANYONE_TO_ME"
          ? isEn
            ? "Owe"
            : "Pagar deuda"
          : isEn
            ? "Collect"
            : "Cobrar";
      items.push({
        id: `debt-${debt.id}`,
        kind: "debt",
        title: `${verb}: ${debt.name}`,
        subtitle: `${formatMoney(remaining, currency, prefs.locale)} · ${phrase}`,
        dueDate: debt.payBackDate.toISOString().slice(0, 10),
        dueInDays: days,
        amount: remaining,
        currency,
        href: "/debts",
        priority: days <= 0 ? 8 : 30 + days,
      });
    }
  }

  items.sort((a, b) => a.priority - b.priority);

  // Build concise push title & body
  const localePrefix = isEn ? "/en" : "/es";
  if (items.length === 0) {
    return {
      items: [],
      title: isEn ? "All caught up" : "Todo al día",
      body: isEn
        ? "No upcoming payments or reminders for today."
        : "No tienes pagos ni recordatorios pendientes para hoy.",
      url: `${localePrefix}/notifications`,
      tag: "firecent-daily-digest",
    };
  }

  if (items.length === 1) {
    const only = items[0]!;
    return {
      items,
      title: only.title,
      body: only.subtitle,
      url: `${localePrefix}${only.href}`,
      tag: "firecent-daily-digest",
    };
  }

  const topTwo = items
    .slice(0, 2)
    .map((i) => `${i.title} (${i.subtitle})`)
    .join(" · ");
  const extraCount = items.length - 2;
  const suffix =
    extraCount > 0
      ? isEn
        ? ` +${extraCount} more`
        : ` +${extraCount} más`
      : "";

  return {
    items,
    title: isEn
      ? `${items.length} pending reminders`
      : `${items.length} pendientes hoy`,
    body: `${topTwo}${suffix}`,
    url: `${localePrefix}/notifications`,
    tag: "firecent-daily-digest",
  };
}

/**
 * Computes exact statement balance ("Pago de contado") only for cards that
 * actually matched the notification window, avoiding unnecessary DB work.
 */
async function computeCashPaymentOverrides(
  cards: OrgBatchData["cards"],
  data: OrgBatchData,
  now = new Date(),
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  const eligible = cards
    .map((card) => ({
      card,
      lastCutoff: computeLastCycleDate(
        card.cutoffDayType,
        card.cutoffDay,
        card.cutoffEveryDays,
        card.cutoffAnchorDate,
        now,
      ),
    }))
    .filter((entry): entry is { card: OrgBatchData["cards"][number]; lastCutoff: Date } => entry.lastCutoff !== null);

  if (eligible.length === 0) return result;

  // Bounded parallelism across only the few cards actually due within horizon
  await runWithConcurrency(eligible, 10, async ({ card, lastCutoff }) => {
    const balanceMinor = data.balanceByCard.get(card.id) ?? 0;
    const debtMinor = Math.max(0, -balanceMinor);
    if (debtMinor <= 0) return;

    const [atCutoff, paidAfter] = await Promise.all([
      db.record.aggregate({
        where: {
          organizationId: card.organizationId,
          accountId: card.id,
          deletedAt: null,
          OR: [{ recordDate: { lte: lastCutoff } }, { recordDate: null }],
        },
        _sum: { amount: true },
      }),
      db.record.aggregate({
        where: {
          organizationId: card.organizationId,
          accountId: card.id,
          deletedAt: null,
          amount: { gt: 0 },
          recordDate: { gt: lastCutoff },
        },
        _sum: { amount: true },
      }),
    ]);

    const owedAtCutoffMinor = Math.max(0, -(atCutoff._sum.amount ?? 0));
    const paidSinceCutoffMinor = paidAfter._sum.amount ?? 0;
    const instSummary = summarizeCardInstallments(
      debtMinor / MINOR_UNIT,
      data.installmentsByCard.get(card.id) ?? [],
    );
    const cashMinor = Math.max(
      0,
      Math.min(
        debtMinor,
        owedAtCutoffMinor -
          paidSinceCutoffMinor -
          Math.round(instSummary.deferredInBalance * MINOR_UNIT),
      ),
    );
    result.set(card.id, cashMinor / MINOR_UNIT);
  });

  return result;
}

/**
 * Preview digest for a single user/organization (used by `/notifications` UI).
 */
export async function buildUserDigestPreview(
  orgId: string,
  prefs: DigestPreferenceFlags,
  now = new Date(),
): Promise<PendingDigest> {
  const data = await fetchBatchedOrgData([orgId], Math.max(0, Math.min(14, prefs.advanceDays)), now);
  const dueCards = data.cards.filter((card) => {
    const debtMinor = Math.max(0, -(data.balanceByCard.get(card.id) ?? 0));
    if (debtMinor <= 0) return false;
    const due = computeNextCycleDate(
      card.paymentDayType,
      card.paymentDay,
      card.paymentEveryDays,
      card.paymentAnchorDate,
      data.lastPaymentByCard.get(card.id) ?? null,
      now,
    );
    return due.inDays !== null && due.inDays <= prefs.advanceDays;
  });
  const cashOverrides = await computeCashPaymentOverrides(dueCards, data, now);
  return buildDigestFromBatch(orgId, prefs, data, now, cashOverrides);
}

// ── Push Delivery & Concurrency Helpers ────────────────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const current = items[idx++]!;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export type PushNotificationEntry = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  silent?: boolean;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** Optional list of individual notifications rendered from a single Web Push. */
  notifications?: PushNotificationEntry[];
};

const MAX_INDIVIDUAL_NOTIFICATIONS = 4;

/**
 * Converts a PendingDigest into a single Web Push payload that renders one
 * clean notification per pending item (up to 4 + 1 overflow summary), with
 * only the first notification chiming (`silent: true` on 2nd+) and direct
 * deep-links to each item's screen. Top-level fields stay populated as a
 * fallback for older Service Workers.
 */
export function buildPushPayloadFromDigest(
  digest: PendingDigest,
  locale: string,
): PushPayload {
  const isEn = locale === "en";
  const localePrefix = isEn ? "/en" : "/es";

  if (digest.items.length <= 1) {
    return {
      title: digest.title,
      body: digest.body,
      url: digest.url,
      tag: digest.tag,
      notifications: [
        {
          title: digest.title,
          body: digest.body,
          url: digest.url,
          tag: digest.items[0] ? `firecent-${digest.items[0].id}` : digest.tag,
          silent: false,
        },
      ],
    };
  }

  const shown = digest.items.slice(0, MAX_INDIVIDUAL_NOTIFICATIONS);
  const overflow = digest.items.slice(MAX_INDIVIDUAL_NOTIFICATIONS);

  const notifications: PushNotificationEntry[] = shown.map((item, idx) => ({
    title: item.title,
    body: item.subtitle,
    url: `${localePrefix}${item.href}`,
    tag: `firecent-${item.id}`,
    silent: idx > 0,
  }));

  if (overflow.length > 0) {
    const names = overflow
      .slice(0, 3)
      .map((i) => i.title)
      .join(" · ");
    notifications.push({
      title: isEn
        ? `+${overflow.length} more pending`
        : `+${overflow.length} pendientes más`,
      body: names,
      url: `${localePrefix}/notifications`,
      tag: "firecent-daily-overflow",
      silent: true,
    });
  }

  return {
    title: digest.title,
    body: digest.body,
    url: digest.url,
    tag: digest.tag,
    notifications,
  };
}

export async function sendPushToSubscriptions(
  subscriptions: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    failureCount: number;
  }[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (!ensureVapidConfigured() || subscriptions.length === 0) {
    return { sent: 0, failed: 0, pruned: 0 };
  }

  let sent = 0;
  let failed = 0;
  let pruned = 0;
  const serialized = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag ?? "firecent-notification",
    badge: "/splash/app-icons/notification-badge-96.png?v=3",
    ...(payload.notifications ? { notifications: payload.notifications } : {}),
  });

  await runWithConcurrency(subscriptions, PUSH_CONCURRENCY, async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        serialized,
        { TTL: 60 * 60 * 6 },
      );
      sent += 1;
      await db.pushSubscription
        .update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date(), failureCount: 0 },
        })
        .catch(() => {});
    } catch (err: unknown) {
      failed += 1;
      const statusCode =
        typeof err === "object" && err !== null && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      const shouldPrune = statusCode === 404 || statusCode === 410 || sub.failureCount + 1 >= 5;
      if (shouldPrune) {
        pruned += 1;
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        await db.pushSubscription
          .update({
            where: { id: sub.id },
            data: { failureCount: { increment: 1 } },
          })
          .catch(() => {});
      }
    }
  });

  return { sent, failed, pruned };
}

// ── Scalable Cron Dispatcher (Advisory Lock + Indexed Batch Chunks) ────────

export type CronDispatchResult = {
  skippedReason?: string;
  batches: number;
  usersChecked: number;
  usersNotified: number;
  pushesSent: number;
  pushesFailed: number;
  subscriptionsPruned: number;
  durationMs: number;
};

/**
 * Processes due daily notifications in indexed chunks of `USER_BATCH_SIZE` (100).
 * Uses a PostgreSQL advisory lock so concurrent ticks or replicas never overlap,
 * and batched `IN (...)` queries per chunk so 1,000 users take ~50 lightweight
 * queries total instead of N+1 per-user round-trips.
 */
export async function dispatchDueDailyNotifications(
  now = new Date(),
): Promise<CronDispatchResult> {
  const startedAt = Date.now();
  if (!ensureVapidConfigured()) {
    return {
      skippedReason: "vapid_not_configured",
      batches: 0,
      usersChecked: 0,
      usersNotified: 0,
      pushesSent: 0,
      pushesFailed: 0,
      subscriptionsPruned: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  if (dispatchInProgress) {
    return {
      skippedReason: "already_running",
      batches: 0,
      usersChecked: 0,
      usersNotified: 0,
      pushesSent: 0,
      pushesFailed: 0,
      subscriptionsPruned: 0,
      durationMs: Date.now() - startedAt,
    };
  }
  dispatchInProgress = true;

  let batches = 0;
  let usersChecked = 0;
  let usersNotified = 0;
  let pushesSent = 0;
  let pushesFailed = 0;
  let subscriptionsPruned = 0;

  try {
    while (batches < MAX_BATCHES_PER_TICK) {
      // Single indexed query: WHERE enabled = true AND nextRunAt <= now LIMIT 100
      const duePrefs = await db.notificationPreference.findMany({
        where: {
          enabled: true,
          nextRunAt: { lte: now },
        },
        orderBy: { nextRunAt: "asc" },
        take: USER_BATCH_SIZE,
        include: {
          user: {
            select: {
              memberships: {
                select: { organizationId: true },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
        },
      });

      if (duePrefs.length === 0) break;
      batches += 1;
      usersChecked += duePrefs.length;

      // Optimistic row-claim: advance nextRunAt atomically per row before sending
      // so concurrent replicas/ticks can never double-send the same digest.
      const claimedPrefs: typeof duePrefs = [];
      await runWithConcurrency(duePrefs, 20, async (pref) => {
        const localToday = getLocalDateParts(now, pref.timezone).dateKey;
        const nextRunAt = computeNextRunAt(
          pref.dailyTime,
          pref.timezone,
          now,
          localToday,
        );
        const claimed = await db.notificationPreference.updateMany({
          where: {
            id: pref.id,
            nextRunAt: pref.nextRunAt,
          },
          data: { nextRunAt },
        });
        if (claimed.count === 1) {
          claimedPrefs.push(pref);
        }
      });

      if (claimedPrefs.length === 0) {
        if (duePrefs.length < USER_BATCH_SIZE) break;
        continue;
      }

      const userIds = claimedPrefs.map((p) => p.userId);
      const allSubs = await db.pushSubscription.findMany({
        where: { userId: { in: userIds } },
        select: {
          id: true,
          userId: true,
          endpoint: true,
          p256dh: true,
          auth: true,
          failureCount: true,
        },
      });

      const subsByUser = new Map<string, typeof allSubs>();
      for (const s of allSubs) {
        const list = subsByUser.get(s.userId) ?? [];
        list.push(s);
        subsByUser.set(s.userId, list);
      }

      // Resolve target organizations & maximum lookahead horizon for this chunk
      const orgIdByUser = new Map<string, string>();
      const uniqueOrgIds = new Set<string>();
      let maxAdvanceDays = 0;

      for (const pref of claimedPrefs) {
        const subs = subsByUser.get(pref.userId) ?? [];
        const localToday = getLocalDateParts(now, pref.timezone).dateKey;
        const alreadySentToday = pref.lastSentDate === localToday;
        const resolvedOrgId =
          pref.organizationId ?? pref.user.memberships[0]?.organizationId ?? null;
        if (subs.length > 0 && !alreadySentToday && resolvedOrgId) {
          orgIdByUser.set(pref.userId, resolvedOrgId);
          uniqueOrgIds.add(resolvedOrgId);
          if (pref.advanceDays > maxAdvanceDays) {
            maxAdvanceDays = pref.advanceDays;
          }
        }
      }

      // Fixed O(1) batched queries for ALL organizations in this 100-user chunk
      const batchData = await fetchBatchedOrgData(
        [...uniqueOrgIds],
        Math.min(14, maxAdvanceDays),
        now,
      );

      // Compute exact cashPayment only for cards actually due within horizon
      const dueCards = batchData.cards.filter((card) => {
        const debtMinor = Math.max(0, -(batchData.balanceByCard.get(card.id) ?? 0));
        if (debtMinor <= 0) return false;
        const due = computeNextCycleDate(
          card.paymentDayType,
          card.paymentDay,
          card.paymentEveryDays,
          card.paymentAnchorDate,
          batchData.lastPaymentByCard.get(card.id) ?? null,
          now,
        );
        return due.inDays !== null && due.inDays <= Math.min(14, maxAdvanceDays);
      });
      const cashOverrides = await computeCashPaymentOverrides(dueCards, batchData, now);

      // Dispatch pushes in bounded concurrency
      await runWithConcurrency(claimedPrefs, 15, async (pref) => {
        const localToday = getLocalDateParts(now, pref.timezone).dateKey;
        const subs = subsByUser.get(pref.userId) ?? [];
        const resolvedOrgId = orgIdByUser.get(pref.userId);

        if (!resolvedOrgId || subs.length === 0 || pref.lastSentDate === localToday) {
          return;
        }

        const digest = buildDigestFromBatch(
          resolvedOrgId,
          {
            advanceDays: pref.advanceDays,
            notifyCardPayments: pref.notifyCardPayments,
            notifyCardCutoffs: pref.notifyCardCutoffs,
            notifyRecurrings: pref.notifyRecurrings,
            notifyDebts: pref.notifyDebts,
            notifyInstallments: pref.notifyInstallments,
            locale: pref.locale,
          },
          batchData,
          now,
          cashOverrides,
        );

        const shouldSend = digest.items.length > 0 || !pref.quietIfEmpty;
        if (!shouldSend) return;

        const res = await sendPushToSubscriptions(
          subs,
          buildPushPayloadFromDigest(digest, pref.locale),
        );
        pushesSent += res.sent;
        pushesFailed += res.failed;
        subscriptionsPruned += res.pruned;
        if (res.sent > 0) {
          usersNotified += 1;
          await db.notificationPreference
            .update({
              where: { id: pref.id },
              data: { lastSentDate: localToday, lastSentAt: now },
            })
            .catch(() => {});
        }
      });

      if (duePrefs.length < USER_BATCH_SIZE) break;
    }
  } finally {
    dispatchInProgress = false;
  }

  return {
    batches,
    usersChecked,
    usersNotified,
    pushesSent,
    pushesFailed,
    subscriptionsPruned,
    durationMs: Date.now() - startedAt,
  };
}
