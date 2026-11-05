/**
 * Seeded DUMMY data for the admin dashboard charts.
 * Platform flavor: organizations created, user breakdown by role and
 * permissions assigned per module. Fixed numbers, no fetch.
 */

export const orgsPerMonth = [
  { month: "Mar", orgs: 4 },
  { month: "Apr", orgs: 7 },
  { month: "May", orgs: 6 },
  { month: "Jun", orgs: 11 },
  { month: "Jul", orgs: 9 },
  { month: "Aug", orgs: 14 },
  { month: "Sep", orgs: 12 },
  { month: "Oct", orgs: 17 },
];

export const usersByRole = [
  { role: "admin", value: 18, fill: "var(--chart-1)" },
  { role: "manager", value: 46, fill: "var(--chart-2)" },
  { role: "member", value: 231, fill: "var(--chart-3)" },
  { role: "viewer", value: 89, fill: "var(--chart-4)" },
  { role: "guest", value: 37, fill: "var(--chart-5)" },
];

export const permsPerModule = [
  { module: "Users", perms: 24 },
  { module: "Orgs", perms: 18 },
  { module: "Roles", perms: 15 },
  { module: "Billing", perms: 9 },
  { module: "API keys", perms: 12 },
  { module: "Audit", perms: 7 },
];
