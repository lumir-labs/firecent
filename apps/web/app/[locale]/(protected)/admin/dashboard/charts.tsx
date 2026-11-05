"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { orgsPerMonth, permsPerModule, usersByRole } from "./data";

const orgsConfig = {
  orgs: { label: "Orgs", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function OrgsBarChart() {
  return (
    <ChartContainer config={orgsConfig} className="h-64 w-full">
      <BarChart data={orgsPerMonth} margin={{ left: -16, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="orgs" fill="var(--color-orgs)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const rolesConfig = {
  admin: { label: "Admin", color: "var(--chart-1)" },
  manager: { label: "Manager", color: "var(--chart-2)" },
  member: { label: "Member", color: "var(--chart-3)" },
  viewer: { label: "Viewer", color: "var(--chart-4)" },
  guest: { label: "Guest", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function RolesDonutChart() {
  return (
    <ChartContainer config={rolesConfig} className="h-64 w-full">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={usersByRole}
          dataKey="value"
          nameKey="role"
          innerRadius={52}
          outerRadius={84}
          paddingAngle={3}
          strokeWidth={0}
        >
          {usersByRole.map((entry) => (
            <Cell key={entry.role} fill={entry.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="role" />} />
      </PieChart>
    </ChartContainer>
  );
}

const permsConfig = {
  perms: { label: "Perms", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function PermsBarChart() {
  return (
    <ChartContainer config={permsConfig} className="h-72 w-full">
      <BarChart
        data={permsPerModule}
        layout="vertical"
        margin={{ left: 8, right: 16 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="module"
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="perms" fill="var(--color-perms)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
