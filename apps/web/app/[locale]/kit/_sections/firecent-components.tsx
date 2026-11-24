"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CircleUser,
  Ellipsis,
  Landmark,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Settings,
  Target,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AccountRow,
  AccountRowSkeleton,
  AssistantCard,
  AssistantCardSkeleton,
  CardTotalFooter,
  CardTotalFooterSkeleton,
  CategoryIcon,
  ChangeLine,
  ChangeLineSkeleton,
  DayHeader,
  DayHeaderSkeleton,
  FieldRow,
  FieldRowSkeleton,
  FirecentMark,
  LoadingRegion,
  Money,
  MoneySkeleton,
  NatureBar,
  NatureBarSkeleton,
  NatureSwatch,
  NavRow,
  NavRowSkeleton,
  PaceLegend,
  PageHeader,
  PageHeaderSkeleton,
  ScopeControl,
  ScopeControlSkeleton,
  SectionHeader,
  SectionHeaderSkeleton,
  Sparkline,
  SparklineSkeleton,
  SplitBar,
  SplitBarSkeleton,
  StatPair,
  StatPairSkeleton,
  StateBlock,
  StepList,
  StepListSkeleton,
  TransactionRow,
  TransactionRowSkeleton,
  UpcomingRow,
  UpcomingRowSkeleton,
  type Scope,
} from "@/components/finance";

// Mock data from docs/prototype/home.html (Maya & Daniel, Thu Nov 12, 2026).
const TODAY = "2026-11-12";
const BALANCE = [
  31240, 31010, 31620, 31890, 31450, 32080, 32410, 32150, 32760, 33020, 32690,
  33340, 33610, 33280, 33950, 34320, 34010, 34590, 34880, 34610, 35086, 35190,
  34888, 36398,
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </p>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-7">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function HeroCard({ scope, setScope }: { scope: Scope; setScope: (s: Scope) => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-hero-border bg-hero p-5 text-hero-foreground"
      style={{
        backgroundImage:
          "radial-gradient(110% 85% at 10% 0%, color-mix(in srgb, var(--primary) 24%, transparent), transparent 58%), radial-gradient(80% 75% at 95% 100%, color-mix(in srgb, var(--nature-want) 14%, transparent), transparent 62%)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-medium text-hero-muted">Balance</h3>
          <p className="text-[12px] text-hero-muted/80">7 accounts · Maya &amp; Daniel</p>
        </div>
        <ScopeControl value={scope} onChange={setScope} memberCount={2} surface="hero" />
      </div>
      <div className="mt-3">
        <Money value={36398.47} currency="USD" size="hero" surface="hero" />
        <ChangeLine value={1312.86} currency="USD" context="this month since Nov 1" surface="hero" />
      </div>
      <Sparkline
        className="mt-4"
        points={BALANCE}
        surface="hero"
        ariaLabel="Balance over the last six months, rising from $31,240 on June 1 to $36,398 today"
      />
      <p className="mt-1.5 flex justify-between text-[11px] text-hero-muted">
        <span>Jun 1 · $31,240</span>
        <span>Today</span>
      </p>
      <div className="mt-4 space-y-3">
        <StatPair
          surface="hero"
          items={[
            { icon: ArrowDownLeft, iconClassName: "text-hero-positive", label: "Money in", value: 6125, currency: "USD", sub: "2 deposits", href: "/transactions?type=INCOME" },
            { icon: ArrowUpRight, iconClassName: "text-nature-want", label: "Money out", value: 4812.14, currency: "USD", sub: "40 expenses", href: "/transactions?type=EXPENSE" },
            { icon: PiggyBank, iconClassName: "text-hero-accent", label: "Left in caps", value: 1263, currency: "USD", sub: "$70.17 / day", href: "/budget" },
          ]}
        />
        <SplitBar shared={30874.23} onlyYou={5524.24} currency="USD" surface="hero" hrefShared="/accounts?scope=shared" hrefOnlyYou="/accounts?scope=only-you" />
      </div>
    </div>
  );
}

function Samples() {
  const [scope, setScope] = React.useState<Scope>("everything");
  const [scope2, setScope2] = React.useState<Scope>("everything");

  return (
    <div className="text-[15px] leading-[1.45]">
      <Label>Home · hero (Money hero, ChangeLine, Sparkline, StatPair, SplitBar, ScopeControl en surface=&quot;hero&quot;)</Label>
      <HeroCard scope={scope} setScope={setScope} />

      <Block label="Money · tamaños (hero, sheet, card, row-strong, row, inline)">
        <Card variant="plain" className="divide-y">
          <div className="p-4">
            <p className="text-[13px] font-medium text-muted-foreground">Net worth</p>
            <Money value={36398.47} currency="USD" size="hero" />
            <ChangeLine value={1312.86} currency="USD" context="this month" />
          </div>
          <div className="flex items-baseline justify-between p-4">
            <span className="text-[13px] text-muted-foreground">sheet</span>
            <Money value={-41.24} currency="USD" size="sheet" tone="movement" />
          </div>
          <div className="p-4">
            <p className="text-[13px] text-muted-foreground">card · row-strong · row · inline</p>
            <span className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <Money value={1263} currency="USD" size="card" />
              <Money value={30874.23} currency="USD" size="row-strong" />
              <Money value={709.46} currency="USD" size="row" />
              <Money value={18.99} currency="USD" />
            </span>
          </div>
          <div className="p-4">
            <p className="text-[13px] text-muted-foreground">Vacío (muted)</p>
            <Money value={0} currency="USD" size="hero" muted />
          </div>
        </Card>
      </Block>

      <Block label="Money · tonos (movement / upcoming / plain), approx, converted, trimZeroCents">
        <Card variant="plain" className="divide-y text-[15px]">
          {[
            ["movement · EXPENSE", <Money key="a" value={-41.24} currency="USD" tone="movement" kind="EXPENSE" size="row" weight="semibold" />],
            ["movement · INCOME", <Money key="b" value={2975} currency="USD" tone="movement" kind="INCOME" size="row" weight="semibold" />],
            ["movement · TRANSFER", <Money key="c" value={-1800} currency="USD" tone="movement" kind="TRANSFER" size="row" />],
            ["upcoming · EXPENSE", <Money key="d" value={-15.49} currency="USD" tone="upcoming" kind="EXPENSE" size="row" />],
            ["upcoming · INCOME", <Money key="e" value={3150} currency="USD" tone="upcoming" kind="INCOME" size="row" />],
            ["upcoming · approx", <Money key="f" value={-94} currency="USD" tone="upcoming" approx size="row" />],
            ["plain · negativo", <Money key="g" value={-1846.32} currency="USD" size="row" />],
            ["MXN + converted", <Money key="h" value={-1050} currency="MXN" tone="movement" kind="EXPENSE" size="row" weight="semibold" converted={{ value: -56.85, currency: "USD" }} />],
            ["trimZeroCents (plan)", <span key="i" className="text-muted-foreground">of <Money value={3300} currency="USD" trimZeroCents /></span>],
          ].map(([k, v]) => (
            <div key={k as string} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
              <span className="font-mono text-[12px] text-muted-foreground">{k}</span>
              {v}
            </div>
          ))}
        </Card>
      </Block>

      <Block label="ChangeLine · up / down / flat">
        <Card variant="plain" className="px-4 pt-2 pb-4">
          <ChangeLine value={1312.86} currency="USD" context="this month" />
          <ChangeLine value={-212.4} currency="USD" context="this month" />
          <ChangeLine value={0} currency="USD" context="vs last month" />
        </Card>
      </Block>

      <Block label="Sparkline · default (primary) + SplitBar · default">
        <Card variant="plain" className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Balance</p>
          <Money value={36398.47} currency="USD" size="hero" />
          <Sparkline className="mt-4" points={BALANCE} ariaLabel="Balance over six months, from $31,240 to $36,398" />
          <SplitBar className="mt-4" shared={30874.23} onlyYou={5524.24} currency="USD" hrefShared="/accounts?scope=shared" hrefOnlyYou="/accounts?scope=only-you" />
        </Card>
      </Block>

      <Block label="SectionHeader · action / count / description">
        <div className="space-y-6">
          <SectionHeader title="Recent activity" action={{ label: "All 44 transactions", href: "/transactions" }} />
          <SectionHeader title="Needs your attention" count={3} />
          <SectionHeader
            title="November category limits"
            description={<span className="num"><strong className="font-semibold text-foreground">$4,317.00</strong> of $5,580.00 across 12 limits</span>}
            action={{ label: "Budget", href: "/budget" }}
          />
        </div>
      </Block>

      <Block label="StatPair · default (dentro de Card)">
        <Card variant="plain">
          <StatPair
            items={[
              { icon: ArrowDownLeft, iconClassName: "text-positive", label: "Money in", value: 6125, currency: "USD" },
              { icon: Target, label: "Left to spend", value: 1263, currency: "USD", sub: "$70.17 / day" },
            ]}
          />
        </Card>
      </Block>

      <Block label="NatureSwatch · NatureBar (pace 0.4; Want por encima del plan) · PaceLegend">
        <Card variant="plain" className="space-y-4 p-4">
          <div className="flex gap-4 text-[14px]">
            <span className="flex items-center gap-2"><NatureSwatch nature="DEBO" />Owe</span>
            <span className="flex items-center gap-2"><NatureSwatch nature="NECESITO" />Need</span>
            <span className="flex items-center gap-2"><NatureSwatch nature="QUIERO" />Want</span>
          </div>
          <NatureBar nature="DEBO" spent={2470} planned={2470} currency="USD" pace={0.4} />
          <NatureBar nature="NECESITO" spent={1302.68} planned={2200} currency="USD" pace={0.4} href="/budget" />
          <NatureBar nature="QUIERO" spent={1039.46} planned={900} currency="USD" pace={0.4} />
          <PaceLegend label="Today · 40% pace" />
        </Card>
      </Block>

      <Block label="UpcomingRow (auto, due, expected, manual) + CardTotalFooter">
        <Card variant="plain">
          <ul className="divide-y">
            <li><UpcomingRow date="2026-11-14" title="Netflix" amount={-15.49} currency="USD" kind="EXPENSE" subtitle="On Sapphire Reserve" mode="auto" href="/recurring" /></li>
            <li><UpcomingRow date="2026-11-15" title="Pay Sapphire Reserve" amount={-1512.8} currency="USD" kind="TRANSFER" subtitle="From Joint Checking" mode="due" dueInDays={3} href="/accounts" /></li>
            <li><UpcomingRow date="2026-11-16" title="Daniel's paycheck" amount={3150} currency="USD" kind="INCOME" subtitle="Into Joint Checking" mode="expected" href="/recurring" /></li>
            <li><UpcomingRow date="2026-11-18" title="Con Edison" amount={-94} approx currency="USD" kind="EXPENSE" subtitle="You confirm the amount" mode="manual" href="/recurring" /></li>
          </ul>
          <CardTotalFooter label="To pay in next 7 days" value={1622.29} currency="USD" />
        </Card>
      </Block>

      <Block label="AssistantCard (dismissible; se oculta sola)">
        <AssistantCard
          eyebrow="Your assistant noticed"
          title="Spotify went up $2.00 this month"
          body={
            <>
              Duo is now <Money value={18.99} currency="USD" className="font-medium" />. Together with
              Netflix and Max, subscriptions rose <span className="num font-medium">$7.50/mo</span> this
              year. Also, <strong className="font-medium">Chewy</strong> looks like a monthly order (~$61).
            </>
          }
          actions={[
            { label: "Review subscriptions", href: "/recurring" },
            { label: "Ask about it", href: "/assistant" },
          ]}
        />
      </Block>

      <Block label="FirecentMark · color / mono / logo">
        <div className="flex items-center gap-6">
          <FirecentMark className="h-10" title="Firecent" />
          <FirecentMark variant="mono" className="h-10" />
          <FirecentMark variant="mono" className="h-5 text-muted-foreground" />
          <FirecentMark variant="logo" className="h-8" title="Firecent" />
        </div>
      </Block>

      <Block label="StepList · active / pending / done">
        <StepList
          steps={[
            { title: "Add an account", body: "Checking, savings, cash or credit card", done: true, href: "/accounts" },
            { title: "Set category limits", body: "Put a monthly cap on the categories you track", active: true, href: "/budget" },
            { title: "Record or import your month", body: "Tap + to log as you go, or send a statement to the assistant", href: "/transactions" },
          ]}
        />
      </Block>

      <Block label="PageHeader · child (back + acciones) / root (28 px). En lg: 24 px + desktopActions">
        <Card variant="plain" className="divide-y">
          <PageHeader
            title="Joint Checking"
            subtitle="Checking ·· 4821 · Maya & Daniel"
            back="/accounts"
            backLabel="Accounts"
            actions={
              <Button variant="ghost" size="icon-touch" aria-label="Account actions">
                <Ellipsis />
              </Button>
            }
            desktopActions={
              <Button variant="outline" size="lg" className="rounded-xl">
                <Ellipsis /> Actions
              </Button>
            }
            className="lg:px-4 lg:pb-4"
          />
          <PageHeader
            title="Transactions"
            actions={
              <Button variant="ghost" size="icon-touch" aria-label="Notifications">
                <Bell />
              </Button>
            }
            className="pb-2 lg:px-4 lg:pb-4"
          />
        </Card>
      </Block>

      <Block label="DayHeader + TransactionRow (tile neutro SPEC; tile con color opt-in)">
        <DayHeader date={TODAY} today={TODAY} net={-104.55} currency="USD" />
        <Card variant="plain">
          <ul className="divide-y">
            <li><TransactionRow title="DoorDash" category={{ icon: "utensils", name: "Dining out" }} account="Joint Checking" amount={-41.24} currency="USD" kind="EXPENSE" addedBy={{ initial: "M", color: "PURPLE", name: "Maya" }} href="/transactions" /></li>
            <li><TransactionRow title="McNally Jackson" category={{ icon: "shopping-bag", name: "Shopping" }} account="Amex Gold" private amount={-25.31} currency="USD" kind="EXPENSE" href="/transactions" /></li>
            <li><TransactionRow title="Ticketmaster" category={{ icon: "ticket", name: "Entertainment" }} account="Joint Checking" amount={-142.6} currency="USD" kind="EXPENSE" tags={<Badge variant="shared" className="h-5 text-[11px]">Sofía owes $71.30</Badge>} addedBy={{ initial: "D", color: "ORANGE", name: "Daniel" }} href="/transactions" /></li>
          </ul>
        </Card>
        <DayHeader date="2026-11-11" today={TODAY} net={2975} currency="USD" />
        <Card variant="plain">
          <ul className="divide-y">
            <li><TransactionRow title="Payroll · Acme" category={{ icon: "briefcase", name: "Salary" }} account="Maya's Checking" private amount={2975} currency="USD" kind="INCOME" secondary="9:12 AM" href="/transactions" /></li>
            <li><TransactionRow title="To Joint Checking" category={{ icon: "arrow-left-right", name: "Transfer" }} account="Maya's Checking" amount={-1800} currency="USD" kind="TRANSFER" href="/transactions" /></li>
            <li><TransactionRow title="OXXO" category={{ icon: "shopping-cart", name: "Groceries" }} account="BBVA México" private amount={-1050} currency="MXN" kind="EXPENSE" converted={{ value: -56.85, currency: "USD" }} href="/transactions" /></li>
            <li><TransactionRow title="Costco" category={{ icon: "ShoppingCart", name: "Groceries", color: "GREEN" }} account="Joint Checking" amount={-211.36} currency="USD" kind="EXPENSE" addedBy={{ initial: "D", color: "ORANGE", name: "Daniel" }} excluded href="/transactions" /></li>
          </ul>
        </Card>
        <DayHeader date="2026-11-09" today={TODAY} net={-64.9} currency="USD" />
      </Block>

      <Block label="ScopeControl · default (memberCount=1 → no se renderiza)">
        <ScopeControl value={scope2} onChange={setScope2} memberCount={2} />
        <div className="mt-2 rounded-xl border border-dashed p-2 text-center text-[12px] text-muted-foreground">
          memberCount=1:
          <ScopeControl value={scope2} onChange={setScope2} memberCount={1} /> (vacío)
        </div>
      </Block>

      <Block label="FieldRow (estático / href / onClick)">
        <Card variant="plain" className="divide-y">
          <FieldRow label="Category" value="Entertainment" href="/categories" />
          <FieldRow label="Account" value="Joint Checking" onClick={() => {}} />
          <FieldRow label="Date" value="Thu, Nov 12" />
        </Card>
      </Block>

      <Block label="NavRow">
        <Card variant="plain" className="divide-y">
          <NavRow icon={Wallet} label="Accounts" preview="$36,398.47" href="/accounts" />
          <NavRow icon={Repeat} label="Recurring" preview="3 due" badge={<span className="size-2 rounded-full bg-nature-want" aria-label="New" />} href="/recurring" />
          <NavRow icon={Settings} label="Settings" href="/settings" />
        </Card>
      </Block>

      <Block label="AccountRow (shared, private, crédito, MXN)">
        <Card variant="plain">
          <ul className="divide-y">
            <li><AccountRow name="Joint Checking" type="CHECKING_ACCOUNT" last4="4821" balance={8420.55} currency="USD" secondary="+$855.13 this month" secondaryTone="positive" href="/accounts/1" /></li>
            <li><AccountRow name="Maya's Checking" type="CHECKING_ACCOUNT" last4="2260" private balance={3912.18} currency="USD" href="/accounts/4" /></li>
            <li><AccountRow name="Sapphire Reserve" type="CREDIT_CARD" last4="7719" balance={-1846.32} currency="USD" secondary="Due Nov 15" secondaryTone="warning" href="/accounts/3" /></li>
            <li><AccountRow name="BBVA México" type="SAVINGS_ACCOUNT" private balance={38500} currency="MXN" converted={{ value: 2084.46, currency: "USD" }} href="/accounts/6" /></li>
            <li><AccountRow name="Cash" type="CASH" private balance={140} currency="USD" color="YELLOW" href="/accounts/5" /></li>
          </ul>
        </Card>
      </Block>

      <Block label="StateBlock · empty / error / no-results">
        <Card variant="plain" className="divide-y">
          <StateBlock
            kind="empty"
            icon={Receipt}
            title="No transactions yet"
            body="Add your first one with the + button, or import a statement and approve what gets saved."
            action={<Button size="touch"><Plus /> Add transaction</Button>}
          />
          <StateBlock kind="error" action={{ onClick: () => {} }} />
          <StateBlock kind="no-results" action={{ onClick: () => {} }} />
        </Card>
      </Block>

      <Block label="CategoryIcon · sm / md / lg · neutro (SPEC) y color opt-in">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryIcon icon="utensils" size="sm" />
          <CategoryIcon icon="shopping-cart" size="md" />
          <CategoryIcon icon={Landmark} size="lg" />
          <CategoryIcon icon="NoSuchIcon" />
          <span className="mx-1 h-6 w-px bg-border" />
          <CategoryIcon icon="utensils" color="ORANGE" />
          <CategoryIcon icon="shopping-cart" color="GREEN" />
          <CategoryIcon icon="bus" color="BLUE" />
          <CategoryIcon icon="ticket" color="PINK" />
          <CategoryIcon icon="CircleUser" />
          <CategoryIcon icon={CircleUser} color="PURPLE" />
        </div>
      </Block>

      <Block label="Skeletons (dentro de LoadingRegion: aria-busy + status sr-only)">
        <LoadingRegion label="Loading your balance" className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-hero-border bg-hero p-5">
            <MoneySkeleton size="hero" surface="hero" />
            <ChangeLineSkeleton surface="hero" />
            <SparklineSkeleton surface="hero" />
            <StatPairSkeleton count={3} surface="hero" />
            <SplitBarSkeleton surface="hero" />
          </div>
          <PageHeaderSkeleton />
          <SectionHeaderSkeleton />
          <Card variant="plain" className="p-4">
            <MoneySkeleton size="hero" />
            <ChangeLineSkeleton />
            <SparklineSkeleton className="mt-4" />
            <SplitBarSkeleton className="mt-4" />
          </Card>
          <Card variant="plain"><StatPairSkeleton /></Card>
          <Card variant="plain" className="space-y-4 p-4">
            <NatureBarSkeleton />
            <NatureBarSkeleton />
          </Card>
          <Card variant="plain" className="divide-y">
            <UpcomingRowSkeleton />
            <UpcomingRowSkeleton />
            <CardTotalFooterSkeleton />
          </Card>
          <AssistantCardSkeleton />
          <StepListSkeleton />
          <DayHeaderSkeleton />
          <Card variant="plain" className="divide-y">
            <TransactionRowSkeleton />
            <TransactionRowSkeleton />
          </Card>
          <ScopeControlSkeleton />
          <Card variant="plain" className="divide-y">
            <FieldRowSkeleton />
            <NavRowSkeleton />
            <AccountRowSkeleton />
          </Card>
        </LoadingRegion>
      </Block>
    </div>
  );
}

export function FirecentComponents() {
  return (
    <section className="space-y-4" aria-labelledby="fc-components">
      <div>
        <h2 id="fc-components" className="text-lg font-semibold tracking-tight">
          Firecent · componentes
        </h2>
        <p className="text-sm text-muted-foreground">
          <code className="font-mono text-xs">components/finance/*</code> (1C). Cada
          columna a 430 px máx. como el prototipo móvil. Izquierda claro, derecha
          oscuro (isla <code className="font-mono text-xs">.dark</code>).
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border bg-background px-4 py-5 sm:px-5">
          <div className="mx-auto max-w-[430px]">
            <Samples />
          </div>
        </div>
        <div className="dark min-w-0 rounded-2xl border bg-background px-4 py-5 text-foreground sm:px-5">
          <div className="mx-auto max-w-[430px]">
            <Samples />
          </div>
        </div>
      </div>
    </section>
  );
}
