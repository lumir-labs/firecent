/**
 * Seeded DUMMY data for the authenticated area's dashboard.
 * Generic SaaS-style boilerplate: credible but fixed numbers, no fetch.
 * Month/week labels are neutral (valid in es/en).
 */

export const kpis = {
  revenue: 48250,
  revenueDelta: "+12.5%",
  activeUsers: 1284,
  activeUsersDelta: "+8.2%",
  churn: "2.1%",
  churnDelta: "-0.4 pts",
  growth: "+34%",
  growthDelta: "YoY",
} as const;

export const monthlyRevenue = [
  { month: "Nov", revenue: 31200, expenses: 18400 },
  { month: "Dec", revenue: 33500, expenses: 19100 },
  { month: "Jan", revenue: 32800, expenses: 18900 },
  { month: "Feb", revenue: 35400, expenses: 19800 },
  { month: "Mar", revenue: 38200, expenses: 20500 },
  { month: "Apr", revenue: 37600, expenses: 21200 },
  { month: "May", revenue: 40100, expenses: 21900 },
  { month: "Jun", revenue: 42300, expenses: 22600 },
  { month: "Jul", revenue: 41900, expenses: 23100 },
  { month: "Aug", revenue: 44800, expenses: 23800 },
  { month: "Sep", revenue: 46100, expenses: 24200 },
  { month: "Oct", revenue: 48250, expenses: 24900 },
];

export const weeklyActiveUsers = [
  { week: "W28", users: 842 },
  { week: "W29", users: 901 },
  { week: "W30", users: 876 },
  { week: "W31", users: 954 },
  { week: "W32", users: 1021 },
  { week: "W33", users: 998 },
  { week: "W34", users: 1076 },
  { week: "W35", users: 1134 },
  { week: "W36", users: 1109 },
  { week: "W37", users: 1198 },
  { week: "W38", users: 1241 },
  { week: "W39", users: 1284 },
];

export const statusDistribution = [
  { status: "active", value: 862, fill: "var(--chart-1)" },
  { status: "trial", value: 214, fill: "var(--chart-2)" },
  { status: "pastDue", value: 96, fill: "var(--chart-4)" },
  { status: "canceled", value: 112, fill: "var(--chart-5)" },
];

export type PortalEvent = {
  id: string;
  event: string;
  detail: string;
  date: string;
  status: "ok" | "pending" | "alert";
};

export const recentEvents: PortalEvent[] = [
  {
    id: "ev-1042",
    event: "Invoice paid",
    detail: "Plan Pro · Oct",
    date: "2026-10-07",
    status: "ok",
  },
  {
    id: "ev-1041",
    event: "Member invited",
    detail: "ana@example.com",
    date: "2026-10-06",
    status: "pending",
  },
  {
    id: "ev-1040",
    event: "API key created",
    detail: "CI · read-only",
    date: "2026-10-05",
    status: "ok",
  },
  {
    id: "ev-1039",
    event: "Payment retry",
    detail: "Card ···· 4242",
    date: "2026-10-03",
    status: "alert",
  },
  {
    id: "ev-1038",
    event: "Plan upgraded",
    detail: "Starter → Pro",
    date: "2026-10-01",
    status: "ok",
  },
  {
    id: "ev-1037",
    event: "Member removed",
    detail: "temp@contractor.co",
    date: "2026-09-28",
    status: "pending",
  },
];
