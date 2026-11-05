/**
 * Demo weekly activity for the home chart (boilerplate placeholder, NOT real
 * analytics). Fixed values on purpose: deterministic snapshots, honest demo
 * data, zero backend dependency. Replace with a tRPC query when the domain
 * has real metrics.
 */
export type WeekDay = { day: number; value: number };

export const WEEK_ACTIVITY: WeekDay[] = [
  { day: 0, value: 42 },
  { day: 1, value: 68 },
  { day: 2, value: 35 },
  { day: 3, value: 80 },
  { day: 4, value: 57 },
  { day: 5, value: 90 },
  { day: 6, value: 64 },
];

export const WEEK_TOTAL: number = WEEK_ACTIVITY.filter(
  (d) => d.value > 0,
).length;
