import { getTranslations } from "next-intl/server";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  TrendingUp,
  UserRoundX,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { getServerSession } from "@/lib/auth";
import { p } from "@app/api/permissions";
import { hasUserPermission } from "./_components/user-menus";
import {
  ActiveUsersLineChart,
  RevenueAreaChart,
  StatusDonutChart,
} from "./_components/dashboard/charts";
import {
  kpis,
  recentEvents,
  type PortalEvent,
} from "./_components/dashboard/data";

const eventBadge: Record<
  PortalEvent["status"],
  "secondary" | "outline" | "destructive"
> = {
  ok: "secondary",
  pending: "outline",
  alert: "destructive",
};

export default async function Page() {
  const tPortal = await getTranslations("Portal");
  const tNav = await getTranslations("Nav");

  const session = await getServerSession();
  const permissions = session?.user.permissions || [];

  const kpiCards = [
    {
      label: tPortal("kpiRevenue"),
      desc: tPortal("kpiRevenueDesc"),
      value: `$${kpis.revenue.toLocaleString("en-US")}`,
      delta: kpis.revenueDelta,
      up: true,
      icon: CircleDollarSign,
    },
    {
      label: tPortal("kpiActiveUsers"),
      desc: tPortal("kpiActiveUsersDesc"),
      value: kpis.activeUsers.toLocaleString("en-US"),
      delta: kpis.activeUsersDelta,
      up: true,
      icon: Users,
    },
    {
      label: tPortal("kpiChurn"),
      desc: tPortal("kpiChurnDesc"),
      value: kpis.churn,
      delta: kpis.churnDelta,
      up: false,
      icon: UserRoundX,
    },
    {
      label: tPortal("kpiGrowth"),
      desc: tPortal("kpiGrowthDesc"),
      value: kpis.growth,
      delta: kpis.growthDelta,
      up: true,
      icon: TrendingUp,
    },
  ];

  // Shortcuts filtered by permission (admin sections only appear with
  // their `*.menu`).
  const shortcuts = [
    { href: "/profile" as const, label: tNav("menu.profile") },
    ...(hasUserPermission(permissions, p.apikeys.menu)
      ? [
          {
            href: "/organization/api-keys" as const,
            label: tNav("menu.apiKeys"),
          },
        ]
      : []),
    { href: "/billing" as const, label: tNav("menu.billing") },
    ...(hasUserPermission(permissions, p.dashboard.basic)
      ? [{ href: "/admin/dashboard" as const, label: tNav("dashboard") }]
      : []),
    ...(hasUserPermission(permissions, p.users.menu)
      ? [{ href: "/admin/users" as const, label: tNav("users") }]
      : []),
    ...(hasUserPermission(permissions, p.roles.menu)
      ? [{ href: "/admin/roles" as const, label: tNav("roles") }]
      : []),
    ...(hasUserPermission(permissions, p.permissions.menu)
      ? [{ href: "/admin/permissions" as const, label: tNav("permissions") }]
      : []),
    ...(hasUserPermission(permissions, p.organizations.menu)
      ? [
          {
            href: "/admin/organizations" as const,
            label: tNav("organizations"),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{tPortal("dashboardTitle")}</h1>
        <p className="text-muted-foreground text-sm">
          {tPortal("dashboardDesc")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(({ label, desc, value, delta, up, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-extrabold tracking-tight">{value}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {up ? (
                  <ArrowUpRight className="size-3.5 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="size-3.5 text-emerald-500" />
                )}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {delta}
                </span>
                <span className="truncate">&nbsp;· {desc}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{tPortal("chartRevenueTitle")}</CardTitle>
            <CardDescription>{tPortal("chartRevenueDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueAreaChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tPortal("chartStatusTitle")}</CardTitle>
            <CardDescription>{tPortal("chartStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonutChart />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{tPortal("chartUsersTitle")}</CardTitle>
            <CardDescription>{tPortal("chartUsersDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ActiveUsersLineChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tPortal("shortcutsTitle")}</CardTitle>
            <CardDescription>{tPortal("shortcutsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {shortcuts.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tPortal("eventsTitle")}</CardTitle>
          <CardDescription>{tPortal("eventsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tPortal("colEvent")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {tPortal("colDetail")}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {tPortal("colDate")}
                </TableHead>
                <TableHead className="text-right">
                  {tPortal("colStatus")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEvents.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">{ev.event}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {ev.detail}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {ev.date}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={eventBadge[ev.status]}>{ev.id}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
