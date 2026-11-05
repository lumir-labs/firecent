"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { monthlyRevenue, statusDistribution, weeklyActiveUsers } from "./data";

const revenueConfig = {
  revenue: { label: "MRR", color: "var(--chart-1)" },
  expenses: { label: "Costs", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function RevenueAreaChart() {
  return (
    <ChartContainer config={revenueConfig} className="h-64 w-full">
      <AreaChart data={monthlyRevenue} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          dataKey="revenue"
          type="monotone"
          fill="var(--color-revenue)"
          fillOpacity={0.35}
          stroke="var(--color-revenue)"
          strokeWidth={2}
        />
        <Area
          dataKey="expenses"
          type="monotone"
          fill="var(--color-expenses)"
          fillOpacity={0.15}
          stroke="var(--color-expenses)"
          strokeWidth={2}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}

const usersConfig = {
  users: { label: "Users", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ActiveUsersLineChart() {
  return (
    <ChartContainer config={usersConfig} className="h-64 w-full">
      <LineChart data={weeklyActiveUsers} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="week"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Line
          dataKey="users"
          type="monotone"
          stroke="var(--color-users)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

const statusConfig = {
  active: { label: "Active", color: "var(--chart-1)" },
  trial: { label: "Trial", color: "var(--chart-2)" },
  pastDue: { label: "Past due", color: "var(--chart-4)" },
  canceled: { label: "Canceled", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function StatusDonutChart() {
  return (
    <ChartContainer config={statusConfig} className="h-64 w-full">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={statusDistribution}
          dataKey="value"
          nameKey="status"
          innerRadius={56}
          outerRadius={88}
          paddingAngle={3}
          strokeWidth={0}
        />
        <ChartLegend content={<ChartLegendContent nameKey="status" />} />
      </PieChart>
    </ChartContainer>
  );
}
