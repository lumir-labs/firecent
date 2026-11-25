export type CycleDayType = "MONTHLY_DAY" | "EVERY_X_DAYS" | null;

const DAY_MS = 86_400_000;

/**
 * Computes the next upcoming date (YYYY-MM-DD) and days remaining for a
 * credit card schedule (payment due date or statement cutoff date).
 *
 * - `MONTHLY_DAY`: fixed day of month (1..31), clamped to shorter months.
 * - `EVERY_X_DAYS`: repeats every `everyDays` days from `anchorDate` (or a
 *   fallback date such as the latest payment). If `anchorDate` is today or in
 *   the future, that exact date is returned; once it passes, it rolls forward
 *   by exact multiples of `everyDays`.
 */
export function computeNextCycleDate(
  dayType: CycleDayType,
  day: number | null,
  everyDays: number | null = null,
  anchorDate: Date | null = null,
  fallbackDate: Date | null = null,
  now = new Date(),
): { nextDate: string | null; inDays: number | null } {
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (dayType === "EVERY_X_DAYS") {
    if (!everyDays || everyDays < 1) {
      return { nextDate: null, inDays: null };
    }
    const base = anchorDate ?? fallbackDate;
    if (!base) {
      return { nextDate: null, inDays: null };
    }
    const baseUtc = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
    );
    const stepMs = everyDays * DAY_MS;

    let target: Date;
    if (anchorDate) {
      // Explicit anchor: if still today or future, keep it as-is; if past, roll forward.
      if (baseUtc >= todayUtc) {
        target = baseUtc;
      } else {
        const cycles = Math.ceil((todayUtc.getTime() - baseUtc.getTime()) / stepMs);
        target = new Date(baseUtc.getTime() + cycles * stepMs);
      }
    } else {
      // Fallback (e.g. last payment): always at least 1 cycle after the recorded payment.
      const elapsedMs = todayUtc.getTime() - baseUtc.getTime();
      const cycles =
        elapsedMs < 0 ? 1 : Math.max(1, Math.ceil(elapsedMs / stepMs));
      target = new Date(baseUtc.getTime() + cycles * stepMs);
    }

    const inDays = Math.round((target.getTime() - todayUtc.getTime()) / DAY_MS);
    return {
      nextDate: target.toISOString().slice(0, 10),
      inDays,
    };
  }

  if (!day || day < 1 || day > 31) {
    return { nextDate: null, inDays: null };
  }

  const daysInThisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  let target = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      Math.min(day, daysInThisMonth),
    ),
  );
  if (target < todayUtc) {
    const nextMonthDays = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0),
    ).getUTCDate();
    target = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        Math.min(day, nextMonthDays),
      ),
    );
  }
  const inDays = Math.round((target.getTime() - todayUtc.getTime()) / DAY_MS);
  return {
    nextDate: target.toISOString().slice(0, 10),
    inDays,
  };
}

/**
 * Computes the most recent cycle date on or before today (UTC) — used to
 * determine the closing date of the latest credit card statement for
 * calculating "Pago de contado" (statement balance remaining).
 */
export function computeLastCycleDate(
  dayType: CycleDayType,
  day: number | null,
  everyDays: number | null = null,
  anchorDate: Date | null = null,
  now = new Date(),
): Date | null {
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (dayType === "EVERY_X_DAYS") {
    if (!everyDays || everyDays < 1 || !anchorDate) return null;
    const baseUtc = new Date(
      Date.UTC(
        anchorDate.getUTCFullYear(),
        anchorDate.getUTCMonth(),
        anchorDate.getUTCDate(),
      ),
    );
    const stepMs = everyDays * DAY_MS;
    const diffMs = todayUtc.getTime() - baseUtc.getTime();
    // Largest k such that baseUtc + k * stepMs <= todayUtc
    const k = Math.floor(diffMs / stepMs);
    return new Date(baseUtc.getTime() + k * stepMs);
  }

  if (!day || day < 1 || day > 31) return null;

  const daysInThisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const thisMonth = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      Math.min(day, daysInThisMonth),
    ),
  );
  if (thisMonth <= todayUtc) return thisMonth;

  const prevMonthDays = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - 1,
      Math.min(day, prevMonthDays),
    ),
  );
}

export type InstallmentCalcInput = {
  totalAmount: number; // major units
  totalInstallments: number;
  paidInstallments: number;
  monthlyAmount: number; // major units
  interestRate: number; // annual %
  includedInBalance: boolean;
};

export type CardInstallmentsSummary = {
  activeCount: number;
  /** Remaining installment principal already embedded inside the card's reported debt. */
  deferredInBalance: number;
  /** Remaining total payments across all active installments. */
  totalRemaining: number;
  /** Sum of fixed monthly quotas due this cycle across active installments. */
  monthlyTotal: number;
  /** Estimated monthly interest portion across with-interest installment plans. */
  monthlyInterest: number;
  /** Revolving card debt subject to the card's standard APR (excluding deferred installment principal). */
  revolvingDebt: number;
};

/**
 * Computes remaining principal for a single installment plan (exact amortization
 * when interestRate > 0, linear remaining quotas when 0%).
 */
export function computeInstallmentRemaining(item: InstallmentCalcInput): {
  remainingInstallments: number;
  remainingTotal: number;
  remainingPrincipal: number;
  monthlyInterest: number;
} {
  const remainingInstallments = Math.max(
    0,
    item.totalInstallments - item.paidInstallments,
  );
  if (remainingInstallments === 0) {
    return {
      remainingInstallments: 0,
      remainingTotal: 0,
      remainingPrincipal: 0,
      monthlyInterest: 0,
    };
  }

  const remainingTotal =
    Math.round(remainingInstallments * item.monthlyAmount * 100) / 100;

  if (item.interestRate <= 0) {
    return {
      remainingInstallments,
      remainingTotal,
      remainingPrincipal: remainingTotal,
      monthlyInterest: 0,
    };
  }

  // Simulate amortization up to paidInstallments to find accurate remaining principal
  const r = item.interestRate / 100 / 12;
  let principal = item.totalAmount;
  for (let i = 0; i < item.paidInstallments && principal > 0.01; i++) {
    const interest = principal * r;
    const paidPrincipal = Math.max(0, item.monthlyAmount - interest);
    principal = Math.max(0, principal - paidPrincipal);
  }
  const monthlyInterest = Math.round(principal * r * 100) / 100;
  return {
    remainingInstallments,
    remainingTotal,
    remainingPrincipal: Math.round(principal * 100) / 100,
    monthlyInterest,
  };
}

/**
 * Summarizes active installment plans on a credit card so statement balance,
 * revolving interest, and minimum payment estimates stay accurate.
 */
export function summarizeCardInstallments(
  debt: number,
  installments: InstallmentCalcInput[],
): CardInstallmentsSummary {
  let activeCount = 0;
  let deferredInBalance = 0;
  let totalRemaining = 0;
  let monthlyTotal = 0;
  let monthlyInterest = 0;

  for (const item of installments) {
    const calc = computeInstallmentRemaining(item);
    if (calc.remainingInstallments <= 0) continue;
    activeCount += 1;
    totalRemaining += calc.remainingTotal;
    monthlyTotal += item.monthlyAmount;
    monthlyInterest += calc.monthlyInterest;
    if (item.includedInBalance) {
      deferredInBalance += calc.remainingPrincipal;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const deferred = round2(deferredInBalance);
  return {
    activeCount,
    deferredInBalance: deferred,
    totalRemaining: round2(totalRemaining),
    monthlyTotal: round2(monthlyTotal),
    monthlyInterest: round2(monthlyInterest),
    revolvingDebt: round2(Math.max(0, debt - deferred)),
  };
}
