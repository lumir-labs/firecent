import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getTranslations } from "next-intl/server";

export async function LandingShowcase() {
  const t = await getTranslations("Landing");

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {t("showcase.eyebrow")}
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
          {t("showcase.title")}
        </h2>
        <p className="mt-4 text-muted-foreground">{t("showcase.subtitle")}</p>
      </div>

      <Tabs defaultValue="dashboard" className="mt-10 items-center">
        <TabsList>
          <TabsTrigger value="dashboard">
            {t("showcase.tabDashboard")}
          </TabsTrigger>
          <TabsTrigger value="roles">{t("showcase.tabRoles")}</TabsTrigger>
          <TabsTrigger value="api">{t("showcase.tabApi")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="w-full">
          <Card>
            <CardHeader>
              <CardTitle>{t("showcase.dashboardTitle")}</CardTitle>
              <CardDescription>
                {t("showcase.dashboardDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "health.check", ok: true },
                { label: "auth.session", ok: true },
                { label: "org.active", ok: true },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5 font-mono text-xs"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  <Badge variant="secondary" className="gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    200
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="w-full">
          <Card>
            <CardHeader>
              <CardTitle>{t("showcase.rolesTitle")}</CardTitle>
              <CardDescription>{t("showcase.rolesDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {[
                { role: "root", perms: 24 },
                { role: "admin", perms: 18 },
                { role: "user", perms: 4 },
              ].map((row) => (
                <div
                  key={row.role}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge>{row.role}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {row.perms} {t("showcase.permsSuffix")}
                    </span>
                  </div>
                  <Check className="size-4 text-emerald-500" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="w-full">
          <Card>
            <CardHeader>
              <CardTitle>{t("showcase.apiTitle")}</CardTitle>
              <CardDescription>{t("showcase.apiDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
{`// tRPC — end-to-end type-safe
const { data } = trpc.health.check.useQuery();

// REST — for integrations
GET /api/v1/info → { ok: true }`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
