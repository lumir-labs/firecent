/**
 * Firecent domain components (Phase 1C). Presentation only: they receive
 * computed data (major units, D8) and never call tRPC. See docs/COMPONENTS.md.
 */

export * from "./types";
export { localizeCategoryName } from "./utils";

export { Money, MoneySkeleton, formatMoneyText, resolveMoney } from "./money";
export type { MoneyProps, MoneySize, MoneyTone } from "./money";
export { ChangeLine, ChangeLineSkeleton } from "./change-line";
export type { ChangeLineProps } from "./change-line";
export { Sparkline, SparklineSkeleton, sparklinePath } from "./sparkline";
export type { SparklineProps } from "./sparkline";
export { SplitBar, SplitBarSkeleton } from "./split-bar";
export type { SplitBarProps } from "./split-bar";
export { SectionHeader, SectionHeaderSkeleton } from "./section-header";
export type { SectionHeaderProps } from "./section-header";
export { StatPair, StatPairSkeleton } from "./stat-pair";
export type { StatItem, StatPairProps } from "./stat-pair";
export { NatureSwatch } from "./nature-swatch";
export type { NatureSwatchProps } from "./nature-swatch";
export { NatureBar, NatureBarSkeleton } from "./nature-bar";
export type { NatureBarProps } from "./nature-bar";
export { PaceLegend } from "./pace-legend";
export type { PaceLegendProps } from "./pace-legend";
export { UpcomingRow, UpcomingRowSkeleton } from "./upcoming-row";
export type { UpcomingMode, UpcomingRowProps } from "./upcoming-row";
export { CardTotalFooter, CardTotalFooterSkeleton } from "./card-total-footer";
export type { CardTotalFooterProps } from "./card-total-footer";
export { AssistantCard, AssistantCardSkeleton } from "./assistant-card";
export type { AssistantAction, AssistantCardProps } from "./assistant-card";
export { FirecentMark } from "./firecent-mark";
export type { FirecentMarkProps } from "./firecent-mark";
export { StepList, StepListSkeleton } from "./step-list";
export type { Step, StepListProps } from "./step-list";
export { PageHeader, PageHeaderSkeleton } from "./page-header";
export type { PageHeaderProps } from "./page-header";
export { TransactionRow, TransactionRowSkeleton } from "./transaction-row";
export type { TransactionRowProps } from "./transaction-row";
export { DayHeader, DayHeaderSkeleton } from "./day-header";
export type { DayHeaderProps } from "./day-header";
export { ScopeControl, ScopeControlSkeleton } from "./scope-control";
export type { ScopeControlProps } from "./scope-control";
export { FieldRow, FieldRowSkeleton } from "./field-row";
export type { FieldRowProps } from "./field-row";
export { NavRow, NavRowSkeleton } from "./nav-row";
export type { NavRowProps } from "./nav-row";
export { AccountRow, AccountRowSkeleton, ACCOUNT_TYPE_ICON } from "./account-row";
export type { AccountRowProps } from "./account-row";
export { StateBlock, LoadingRegion } from "./state-block";
export type { StateAction, StateBlockProps, StateKind } from "./state-block";
export { CategoryIcon, resolveCategoryIcon } from "./category-icon";
export type { CategoryIconProps, CategoryIconSize } from "./category-icon";
export { AmountKeypad } from "./amount-keypad";
export type { AmountKeypadProps } from "./amount-keypad";
export {
  AccountSwatch,
  METALLIC_FINISHES,
  ACCOUNT_COLOR_PRESETS,
  resolveAccountFinish,
} from "./account-finish";
export type {
  MetallicFinishKey,
  PresetColorKey,
  ResolvedFinish,
} from "./account-finish";
