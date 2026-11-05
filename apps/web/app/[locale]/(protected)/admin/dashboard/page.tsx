import { getLocale, getTranslations } from "next-intl/server";
import { Building2, KeyRound, ShieldCheck, Users } from "lucide-react";

import AccessAlert from "@/components/common/access-alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getDateLocale, isLocale } from "@/i18n/utils";
import {
  getDashboardStats,
  listRecentOrganizations,
} from "@/lib/actions/dashboard";
import { validatePermission } from "@/lib/actions/permissions";
import { p } from "@app/api/permissions";
import { OrgsBarChart, PermsBarChart, RolesDonutChart } from "./charts";

export default async function Page() {
  const tAdmin = await getTranslations("Admin");
  const tDashboard = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");

  const { hasPermission } = await validatePermission(p.dashboard.basic);
  if (!hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }

  const [statsRes, recentRes] = await Promise.all([
    getDashboardStats(),
    listRecentOrganizations(),
  ]);

  if (statsRes.error || !statsRes.data) {
    return (
      <AccessAlert
        title={tAdmin("errorTitle")}
        description={statsRes.error || tAdmin("noPermission")}
      />
    );
  }

  const localeValue = await getLocale();
  const dateLocale = getDateLocale(isLocale(localeValue) ? localeValue : "es");

  const kpis = [
    {
      label: tDashboard("kpiUsers"),
      desc: tDashboard("kpiUsersDesc"),
      value: statsRes.data.users,
      icon: Users,
    },
    {
      label: tDashboard("kpiOrgs"),
      desc: tDashboard("kpiOrgsDesc"),
      value: statsRes.data.organizations,
      icon: Building2,
    },
    {
      label: tDashboard("kpiRoles"),
      desc: tDashboard("kpiRolesDesc"),
      value: statsRes.data.roles,
      icon: ShieldCheck,
    },
    {
      label: tDashboard("kpiPerms"),
      desc: tDashboard("kpiPermsDesc"),
      value: statsRes.data.permissions,
      icon: KeyRound,
    },
  ];

  const shortcuts = [
    { href: "/admin/users" as const, label: tNav("users") },
    { href: "/admin/organizations" as const, label: tNav("organizations") },
    { href: "/admin/roles" as const, label: tNav("roles") },
    { href: "/admin/permissions" as const, label: tNav("permissions") },
  ];

  const recent = recentRes.data || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, desc, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-extrabold tracking-tight">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border-violet-500/20">
          <CardHeader>
            <CardTitle>{tDashboard("chartOrgsTitle")}</CardTitle>
            <CardDescription>{tDashboard("chartOrgsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <OrgsBarChart />
          </CardContent>
        </Card>

        <Card className="border-violet-500/20">
          <CardHeader>
            <CardTitle>{tDashboard("chartRolesTitle")}</CardTitle>
            <CardDescription>{tDashboard("chartRolesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RolesDonutChart />
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 md:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>{tDashboard("chartPermsTitle")}</CardTitle>
            <CardDescription>{tDashboard("chartPermsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <PermsBarChart />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{tDashboard("recentTitle")}</CardTitle>
                <CardDescription>{tDashboard("recentDesc")}</CardDescription>
              </div>
              <Link
                href="/admin/organizations"
                className="text-sm font-medium text-primary hover:underline"
              >
                {tDashboard("viewAll")}
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {tDashboard("recentEmpty")}
              </p>
            ) : (
              recent.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{org.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {org.description ||
                        new Date(org.createdAt).toLocaleDateString(dateLocale, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {org._count.members} {tDashboard("members")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tDashboard("linksTitle")}</CardTitle>
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
    </div>
  );
}
