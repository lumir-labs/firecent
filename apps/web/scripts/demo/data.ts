/**
 * Demo dataset (Maya & Daniel). Transcribed from docs/prototype/mock-data.md
 * (§1 users, §2 accounts, §3 categories, §5 November movements, §7 debts and
 * §8 history). Pure data + pure builders: no database access here.
 *
 * Conventions (docs/roadmap/README.md):
 * - D1: stored amounts are SIGNED cents. The mock lists positive amounts and
 *   lets `type` decide; `seed-demo.ts` applies the sign.
 * - D6: a transfer is two records. Here it is ONE row (`toAccount` set) and
 *   the seed expands it.
 * - D7: an account balance is the sum of its records, so history starts with an
 *   `Opening balance` record on 1 Jun (`buildOpeningBalances`).
 * - Dates are mock dates (today = 2026-11-12). The seed shifts them.
 */

export const MOCK_TODAY = "2026-11-12";

// ── §1 Users and Spaces ─────────────────────────────────────────────────────

export const DEMO_USERS = {
  maya: { email: "maya@demo.test", firstName: "Maya", lastName: "Torres" },
  daniel: { email: "daniel@demo.test", firstName: "Daniel", lastName: "Reyes" },
} as const;
export type DemoUserKey = keyof typeof DEMO_USERS;

export const DEMO_SPACES = {
  home: {
    name: "Maya & Daniel (demo)",
    slug: "demo-maya-daniel",
    members: [
      { user: "maya", role: "owner" },
      { user: "daniel", role: "member" },
    ],
    withData: true,
  },
  personal: {
    name: "Personal (demo)",
    slug: "demo-personal",
    members: [{ user: "maya", role: "owner" }],
    withData: false,
  },
} as const satisfies Record<
  string,
  {
    name: string;
    slug: string;
    members: readonly { user: DemoUserKey; role: string }[];
    withData: boolean;
  }
>;

export const DEMO_SLUGS: string[] = Object.values(DEMO_SPACES).map((s) => s.slug);

// ── §2 Accounts ─────────────────────────────────────────────────────────────

export type AccountKey = "JC" | "EF" | "SR" | "MC" | "CA" | "BB" | "AG";

export type DemoAccount = {
  key: AccountKey;
  name: string;
  type: "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CREDIT_CARD" | "CASH";
  currency: "USD" | "MXN";
  owner: DemoUserKey;
  /** visibility: PRIVATE (Fase 4): the field does not exist yet. */
  visibility: "SHARED" | "PRIVATE";
  accountNumber?: string;
  creditLimit?: number;
  paymentDay?: number;
  interestRate?: number;
  /** Balance on 1 Nov in the account's own currency (cents). */
  balanceNov1: number;
  /** Expected balance today, account currency (cents): `mock-data §2`. */
  balanceToday: number;
};

export const ACCOUNTS: DemoAccount[] = [
  { key: "JC", name: "Joint Checking", type: "CHECKING_ACCOUNT", currency: "USD", owner: "daniel", visibility: "SHARED", accountNumber: "4821", balanceNov1: 756542, balanceToday: 842055 },
  { key: "EF", name: "Emergency Fund", type: "SAVINGS_ACCOUNT", currency: "USD", owner: "maya", visibility: "SHARED", accountNumber: "9034", balanceNov1: 2430000, balanceToday: 2430000 },
  { key: "SR", name: "Sapphire Reserve", type: "CREDIT_CARD", currency: "USD", owner: "daniel", visibility: "SHARED", accountNumber: "7719", creditLimit: 1200000, paymentDay: 15, interestRate: 24.99, balanceNov1: -172125, balanceToday: -184632 },
  { key: "MC", name: "Maya's Checking", type: "CHECKING_ACCOUNT", currency: "USD", owner: "maya", visibility: "PRIVATE", accountNumber: "2260", balanceNov1: 314153, balanceToday: 391218 },
  { key: "CA", name: "Cash", type: "CASH", currency: "USD", owner: "maya", visibility: "PRIVATE", balanceNov1: 13000, balanceToday: 14000 },
  // MXN cents. mock §2 shows MX$38,500.00 today; MX$39,550.00 on 1 Nov.
  { key: "BB", name: "BBVA México", type: "SAVINGS_ACCOUNT", currency: "MXN", owner: "maya", visibility: "PRIVATE", accountNumber: "5512", balanceNov1: 3955000, balanceToday: 3850000 },
  { key: "AG", name: "Amex Gold", type: "CREDIT_CARD", currency: "USD", owner: "maya", visibility: "PRIVATE", accountNumber: "1008", creditLimit: 800000, paymentDay: 28, interestRate: 21.24, balanceNov1: -47140, balanceToday: -61240 },
];

// ── §3 Categories ───────────────────────────────────────────────────────────

export type Nature = "DEBO" | "NECESITO" | "QUIERO" | null;
export type DemoCategory = { name: string; nature: Nature; icon: string };

export const CATEGORIES: DemoCategory[] = [
  { name: "Rent", nature: "DEBO", icon: "building-2" },
  { name: "Car loan", nature: "DEBO", icon: "car" },
  { name: "Student loan", nature: "DEBO", icon: "graduation-cap" },
  { name: "Insurance", nature: "DEBO", icon: "shield" },
  { name: "Groceries", nature: "NECESITO", icon: "shopping-cart" },
  { name: "Transport", nature: "NECESITO", icon: "bus" },
  { name: "Phone & internet", nature: "NECESITO", icon: "wifi" },
  { name: "Utilities", nature: "NECESITO", icon: "zap" },
  { name: "Health", nature: "NECESITO", icon: "heart-pulse" },
  { name: "Household", nature: "NECESITO", icon: "lamp" },
  { name: "Pets", nature: "NECESITO", icon: "paw-print" },
  { name: "Dining out", nature: "QUIERO", icon: "utensils" },
  { name: "Entertainment", nature: "QUIERO", icon: "ticket" },
  { name: "Subscriptions", nature: "QUIERO", icon: "tv" },
  { name: "Shopping", nature: "QUIERO", icon: "shopping-bag" },
  { name: "Fitness", nature: "QUIERO", icon: "dumbbell" },
  { name: "Gifts", nature: "QUIERO", icon: "gift" },
  { name: "Paycheck", nature: null, icon: "briefcase" },
  { name: "Other income", nature: null, icon: "coins" },
];

export const LABELS = [
  { name: "Trip: Lisbon", color: "BLUE" },
  { name: "Reimbursable", color: "GREEN" },
  { name: "Tax", color: "GRAY" },
] as const;

// ── Records ─────────────────────────────────────────────────────────────────

export type DemoRecord = {
  /** mock id (1001…1044); history rows have none. */
  mockId?: number;
  /** Mock date, `YYYY-MM-DD`. */
  date: string;
  payee: string | null;
  category: string | null;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  /** Positive cents in the account's currency; the seed applies the sign (D1). */
  cents: number;
  account: AccountKey;
  /** Transfers only: destination account. */
  toAccount?: AccountKey;
  /** Maya, Daniel or null (generated by a recurring: no user). */
  by: DemoUserKey | null;
  note?: string;
  label?: string;
  /** Amount in the base currency when the account is not USD. */
  refCurrencyAmount?: number;
  /** Debt this record pays (mock debt id). */
  debt?: string;
};

const M = "maya" as const;
const D = "daniel" as const;

type Row = [
  id: number,
  day: number,
  payee: string | null,
  category: string | null,
  type: DemoRecord["type"],
  cents: number,
  account: AccountKey,
  by: DemoUserKey | null,
  extra?: Partial<Pick<DemoRecord, "note" | "label" | "toAccount" | "refCurrencyAmount" | "debt">>,
];

// §5, ascending by id (the list in the mock is descending).
const NOV_ROWS: Row[] = [
  [1001, 1, "Parkside Apartments", "Rent", "EXPENSE", 215000, "JC", null],
  [1002, 1, "Whole Foods", "Groceries", "EXPENSE", 12743, "JC", M],
  [1003, 1, "Blue Bottle", "Dining out", "EXPENSE", 950, "AG", M],
  [1004, 2, "Northwind Design", "Paycheck", "INCOME", 315000, "JC", null, { note: "Daniel's paycheck" }],
  [1005, 2, "Verizon", "Phone & internet", "EXPENSE", 11000, "JC", null],
  [1006, 2, "Lucali", "Dining out", "EXPENSE", 9640, "JC", D],
  [1007, 3, "MTA OMNY", "Transport", "EXPENSE", 3400, "MC", M],
  [1008, 3, "Metro-North", "Transport", "EXPENSE", 16800, "MC", M, { note: "Monthly pass" }],
  [1009, 3, "Glossier", "Shopping", "EXPENSE", 3800, "AG", M],
  [1010, 4, "Trader Joe's", "Groceries", "EXPENSE", 8617, "JC", M],
  [1011, 4, "Chelsea Piers Fitness", "Fitness", "EXPENSE", 8900, "JC", null],
  [1012, 4, null, null, "TRANSFER", 10000, "MC", M, { toAccount: "CA", note: "ATM" }],
  [1013, 5, "Toyota Financial", "Car loan", "EXPENSE", 32000, "JC", null, { debt: "d1" }],
  [1014, 5, "Spectrum", "Phone & internet", "EXPENSE", 6999, "JC", null],
  [1015, 5, "Spotify", "Subscriptions", "EXPENSE", 1899, "SR", null, { note: "Duo, up from 1699" }],
  [1016, 5, "The Dead Rabbit", "Dining out", "EXPENSE", 3000, "CA", M],
  [1017, 6, "Lumen Labs", "Paycheck", "INCOME", 297500, "MC", null, { note: "Maya's paycheck" }],
  [1018, 6, null, null, "TRANSFER", 180000, "MC", null, { toAccount: "JC", note: "Maya's share" }],
  [1019, 6, "CVS Pharmacy", "Health", "EXPENSE", 4235, "MC", M],
  [1020, 6, "Barry's", "Fitness", "EXPENSE", 3200, "AG", M],
  [1021, 6, "AMC Theatres", "Entertainment", "EXPENSE", 3450, "JC", M],
  [1022, 7, "Whole Foods", "Groceries", "EXPENSE", 15288, "JC", M],
  [1023, 7, "Via Carota", "Dining out", "EXPENSE", 8460, "SR", M],
  [1024, 7, "Street fair", "Entertainment", "EXPENSE", 2200, "CA", M],
  [1025, 8, "Shell", "Transport", "EXPENSE", 4820, "JC", D],
  [1026, 8, "Max", "Subscriptions", "EXPENSE", 1849, "SR", null],
  [1027, 8, "Amazon", "Shopping", "EXPENSE", 6784, "JC", D],
  [1028, 9, "Dr. Patel", "Health", "EXPENSE", 4000, "JC", M, { note: "Copay" }],
  [1029, 9, "Chewy", "Pets", "EXPENSE", 6124, "JC", M],
  [1030, 9, "Sweetgreen", "Dining out", "EXPENSE", 1645, "AG", M],
  [1031, 9, "Joe's Pizza", "Dining out", "EXPENSE", 2875, "JC", D],
  // MXN cents; US$56.85 at 18.47.
  [1032, 9, "Liverpool", "Gifts", "EXPENSE", 105000, "BB", M, { refCurrencyAmount: 5685 }],
  [1033, 10, "Trader Joe's", "Groceries", "EXPENSE", 9362, "JC", M],
  [1034, 10, "National Grid", "Utilities", "EXPENSE", 5875, "JC", null, { note: "Estimate was ~58.00" }],
  [1035, 10, "iCloud+", "Subscriptions", "EXPENSE", 299, "SR", null],
  [1036, 10, "Kindle", "Entertainment", "EXPENSE", 1299, "AG", M],
  [1037, 10, "Paper Source", "Gifts", "EXPENSE", 6000, "MC", M],
  [1038, 11, "Target", "Household", "EXPENSE", 6490, "JC", D, { label: "Reimbursable" }],
  [1039, 11, "Costco", "Groceries", "EXPENSE", 21136, "JC", D],
  [1040, 11, "Blue Bottle", "Dining out", "EXPENSE", 675, "AG", M],
  [1041, 11, "Ticketmaster", "Entertainment", "EXPENSE", 14260, "JC", M, { note: "Bleachers, 2 tickets" }],
  [1042, 12, "Union Sq Greenmarket", "Groceries", "EXPENSE", 3800, "CA", M],
  [1043, 12, "McNally Jackson", "Shopping", "EXPENSE", 2531, "AG", M],
  [1044, 12, "DoorDash", "Dining out", "EXPENSE", 4124, "JC", M],
];

/** Time of day per record: within a day, a higher mock id is newer. */
export const NOV_RECORDS: DemoRecord[] = (() => {
  return NOV_ROWS.map(([mockId, day, payee, category, type, cents, account, by, extra]) => ({
    mockId,
    date: `2026-11-${String(day).padStart(2, "0")}`,
    payee,
    category,
    type,
    cents,
    account,
    by,
    ...extra,
  }));
})();

// ── §8 History (Jun–Oct) ────────────────────────────────────────────────────

/** Money out by nature, per month (§8). Money in is 927500 every month. */
const HISTORY_OUT: { month: number; owe: number; need: number; want: number }[] = [
  { month: 6, owe: 325500, need: 279035, want: 288545 },
  { month: 7, owe: 325500, need: 251220, want: 218925 },
  { month: 8, owe: 325500, need: 263490, want: 297545 },
  { month: 9, owe: 329700, need: 258832, want: 208315 },
  { month: 10, owe: 329700, need: 284617, want: 266515 },
];

/** Balance at the start of each month (§8), only used by the verification. */
export const HISTORY_BALANCE_START: Record<string, number> = {
  "2026-06": 3124000,
  "2026-07": 3158420,
  "2026-08": 3290275,
  "2026-09": 3331240,
  "2026-10": 3461893,
  "2026-11": 3508561,
};

type Line = {
  day: number;
  payee: string;
  category: string;
  account: AccountKey;
  /** Fixed cents; otherwise `weight` of the nature's free pool. */
  fixed?: number;
  weight?: number;
};

// Last line of a nature without `fixed` absorbs the rounding remainder.
const OWE_LINES: Line[] = [
  { day: 1, payee: "Parkside Apartments", category: "Rent", account: "JC", fixed: 215000 },
  { day: 5, payee: "Toyota Financial", category: "Car loan", account: "JC", fixed: 32000 },
  { day: 20, payee: "Nelnet", category: "Student loan", account: "MC", fixed: 38500 },
  { day: 22, payee: "Geico", category: "Insurance", account: "JC", fixed: 14800 },
  { day: 24, payee: "Lemonade Renters", category: "Insurance", account: "JC", fixed: 4700 },
  { day: 26, payee: "State Farm", category: "Insurance", account: "JC", weight: 1 },
];
const NEED_LINES: Line[] = [
  { day: 2, payee: "Verizon", category: "Phone & internet", account: "JC", fixed: 11000 },
  { day: 5, payee: "Spectrum", category: "Phone & internet", account: "JC", fixed: 6999 },
  { day: 3, payee: "Metro-North", category: "Transport", account: "MC", weight: 0.1 },
  { day: 10, payee: "National Grid", category: "Utilities", account: "JC", weight: 0.07 },
  { day: 14, payee: "Dr. Patel", category: "Health", account: "JC", weight: 0.06 },
  { day: 17, payee: "Target", category: "Household", account: "JC", weight: 0.05 },
  { day: 9, payee: "Chewy", category: "Pets", account: "JC", weight: 0.05 },
  { day: 4, payee: "Whole Foods", category: "Groceries", account: "JC", weight: 0.25 },
  { day: 12, payee: "Trader Joe's", category: "Groceries", account: "JC", weight: 0.2 },
  { day: 19, payee: "Costco", category: "Groceries", account: "JC", weight: 0.22 },
];
const WANT_LINES: Line[] = [
  { day: 5, payee: "Spotify", category: "Subscriptions", account: "JC", fixed: 1699 },
  { day: 8, payee: "Max", category: "Subscriptions", account: "JC", fixed: 1849 },
  { day: 10, payee: "iCloud+", category: "Subscriptions", account: "JC", fixed: 299 },
  { day: 14, payee: "Netflix", category: "Subscriptions", account: "JC", fixed: 1549 },
  { day: 4, payee: "Chelsea Piers Fitness", category: "Fitness", account: "JC", fixed: 8900 },
  { day: 7, payee: "Via Carota", category: "Dining out", account: "JC", weight: 0.15 },
  { day: 15, payee: "Lucali", category: "Dining out", account: "JC", weight: 0.12 },
  { day: 23, payee: "Joe's Pizza", category: "Dining out", account: "JC", weight: 0.1 },
  { day: 13, payee: "AMC Theatres", category: "Entertainment", account: "JC", weight: 0.14 },
  { day: 18, payee: "Amazon", category: "Shopping", account: "MC", weight: 0.2 },
  { day: 25, payee: "Paper Source", category: "Gifts", account: "JC", weight: 1 },
];

/** Splits `total` over the lines: fixed first, weighted pool next, last weighted line takes the remainder. */
function allocate(lines: Line[], total: number): number[] {
  const fixedSum = lines.reduce((s, l) => s + (l.fixed ?? 0), 0);
  const pool = total - fixedSum;
  const weighted = lines.filter((l) => l.fixed === undefined);
  const lastWeighted = weighted[weighted.length - 1];
  const sumW = weighted.reduce((s, l) => s + (l.weight ?? 0), 0);
  let used = 0;
  const out = lines.map((l) => {
    if (l.fixed !== undefined) return l.fixed;
    if (l === lastWeighted) return 0; // filled below
    const v = Math.round((pool * (l.weight ?? 0)) / sumW);
    used += v;
    return v;
  });
  const idx = lines.indexOf(lastWeighted);
  out[idx] = pool - used;
  if (pool <= 0 || out.some((v) => v <= 0)) {
    throw new Error(`History allocation produced a non-positive line (total ${total})`);
  }
  return out;
}

const ymd = (month: number, day: number) =>
  `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Jun–Oct: paychecks, Maya's share, and expenses that add up to §8's Money out. */
export function buildHistory(): DemoRecord[] {
  const out: DemoRecord[] = [];
  for (const h of HISTORY_OUT) {
    const m = h.month;
    for (const day of [2, 16]) {
      out.push({ date: ymd(m, day), payee: "Northwind Design", category: "Paycheck", type: "INCOME", cents: 315000, account: "JC", by: null, note: "Daniel's paycheck" });
    }
    out.push({ date: ymd(m, 6), payee: "Lumen Labs", category: "Paycheck", type: "INCOME", cents: 297500, account: "MC", by: null, note: "Maya's paycheck" });
    out.push({ date: ymd(m, 6), payee: null, category: null, type: "TRANSFER", cents: 180000, account: "MC", toAccount: "JC", by: null, note: "Maya's share" });
    for (const [lines, total] of [
      [OWE_LINES, h.owe],
      [NEED_LINES, h.need],
      [WANT_LINES, h.want],
    ] as const) {
      const cents = allocate(lines, total);
      lines.forEach((l, i) => {
        out.push({ date: ymd(m, l.day), payee: l.payee, category: l.category, type: "EXPENSE", cents: cents[i], account: l.account, by: null });
      });
    }
  }
  return out;
}

/** Signed delta (account currency cents) of a record on one account (D1/D6). */
export function signedFor(r: DemoRecord, account: AccountKey): number {
  if (r.type === "INCOME") return r.account === account ? r.cents : 0;
  if (r.type === "EXPENSE") return r.account === account ? -r.cents : 0;
  if (r.account === account) return -r.cents;
  if (r.toAccount === account) return r.cents;
  return 0;
}

/**
 * `Opening balance` per account on 1 Jun so that the balance on 1 Nov (sum of
 * records) is the one in §2. Opening = balanceNov1 − net of the Jun–Oct history.
 */
export function buildOpeningBalances(history: DemoRecord[]) {
  return ACCOUNTS.map((a) => {
    const net = history.reduce((s, r) => s + signedFor(r, a.key), 0);
    return { account: a.key, signed: a.balanceNov1 - net };
  });
}

// ── §7 Debts (the schema supports them today) ───────────────────────────────

export type DemoDebt = {
  id: string;
  type: "ME_TO_ANYONE" | "ANYONE_TO_ME";
  name: string;
  amount: number;
  remaining: number;
  created: string;
  payBack: string;
  account: AccountKey;
  note: string;
};

export const DEBTS: DemoDebt[] = [
  { id: "d1", type: "ME_TO_ANYONE", name: "Toyota Financial", amount: 1840000, remaining: 1120000, created: "2024-10-05", payBack: "2029-10-05", account: "JC", note: "Car loan. $320.00 a month, 35 payments left" },
  { id: "d2", type: "ME_TO_ANYONE", name: "Nelnet", amount: 2400000, remaining: 808500, created: "2021-08-20", payBack: "2028-07-20", account: "MC", note: "Student loan. $385.00 a month, 21 payments" },
  { id: "d3", type: "ME_TO_ANYONE", name: "Elena Torres", amount: 150000, remaining: 60000, created: "2026-05-02", payBack: "2027-02-28", account: "MC", note: "Moving costs. No fixed schedule" },
  { id: "d4", type: "ANYONE_TO_ME", name: "Leo Reyes", amount: 60000, remaining: 35000, created: "2026-08-15", payBack: "2026-12-15", account: "JC", note: "Lent for car repair" },
  { id: "d5", type: "ANYONE_TO_ME", name: "Sofía Torres", amount: 7130, remaining: 7130, created: "2026-11-11", payBack: "2026-11-30", account: "JC", note: "Her concert ticket (half of 1041)" },
];

/** First day of the history (opening balances are dated here). */
export const OPENING_DATE = "2026-06-01";
