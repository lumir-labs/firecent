import { getTranslations } from "next-intl/server";
import {
  Bell,
  Building2,
  CreditCard,
  KeyRound,
  Shield,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { p } from "@app/api/permissions";

import { NavRow, PageHeader, SectionHeader } from "@/components/finance";
import { Card } from "@/components/ui/card";
import { getServerSession } from "@/lib/auth";

export default async function SettingsPage() {
  const [t, session] = await Promise.all([
    getTranslations("Shell"),
    getServerSession(),
  ]);
  const permissions = session?.user?.permissions ?? [];
  const canOrg = permissions.some((perm) => p.organizations.read.includes(perm));
  const canKeys = permissions.some((perm) => p.apikeys.menu.includes(perm));
  const canAdmin = permissions.some(
    (perm) => p.users.menu.includes(perm) || p.roles.menu.includes(perm),
  );

  return (
    <div className="flex flex-col gap-6 px-5 pt-2 lg:px-0">
      <PageHeader title={t("nav.settings")} className="px-0" />

      <section className="flex flex-col gap-3">
        <SectionHeader title={t("settings.spaceSection")} />
        <Card variant="plain" className="divide-y overflow-hidden">
          <NavRow
            icon={Tag}
            label={t("nav.categories")}
            href="/categories"
          />
          {canOrg && (
            <NavRow
              icon={Building2}
              label={t("settings.membersAndSpace")}
              href="/organization"
            />
          )}
          {canKeys && (
            <NavRow
              icon={KeyRound}
              label={t("settings.apiKeys")}
              href="/organization/api-keys"
            />
          )}
          <NavRow
            icon={CreditCard}
            label={t("settings.billing")}
            href="/billing"
          />
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title={t("settings.accountSection")} />
        <Card variant="plain" className="divide-y overflow-hidden">
          <NavRow
            icon={Bell}
            label={t("nav.notifications")}
            href="/notifications"
          />
          <NavRow
            icon={UserIcon}
            label={t("userMenu.profile")}
            href="/profile"
          />
          {canAdmin && (
            <NavRow
              icon={Shield}
              label={t("userMenu.admin")}
              href="/admin"
            />
          )}
        </Card>
      </section>
    </div>
  );
}
