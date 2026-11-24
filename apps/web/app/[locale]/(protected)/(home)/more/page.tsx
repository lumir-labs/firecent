import { getTranslations } from "next-intl/server";
import {
  Building2,
  ChartNoAxesColumnIncreasing,
  ChartPie,
  HandCoins,
  Repeat,
  Settings,
  User as UserIcon,
  Wallet,
} from "lucide-react";

import { NavRow, PageHeader, SectionHeader } from "@/components/finance";
import { Card } from "@/components/ui/card";

export default async function MorePage() {
  const t = await getTranslations("Shell");

  return (
    <div className="flex flex-col gap-6 px-5 pt-2 lg:px-0">
      <PageHeader title={t("nav.more")} className="px-0" />

      <section className="flex flex-col gap-3">
        <SectionHeader title={t("more.moneySection")} />
        <Card variant="plain" className="divide-y overflow-hidden">
          <NavRow icon={Wallet} label={t("nav.accounts")} href="/accounts" />
          <NavRow icon={ChartPie} label={t("nav.budget")} href="/budget" />
          <NavRow
            icon={ChartNoAxesColumnIncreasing}
            label={t("nav.analytics")}
            href="/analytics"
          />
          <NavRow icon={Repeat} label={t("nav.recurring")} href="/recurring" />
          <NavRow icon={HandCoins} label={t("nav.debts")} href="/debts" />
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title={t("more.preferencesSection")} />
        <Card variant="plain" className="divide-y overflow-hidden">
          <NavRow icon={Settings} label={t("nav.settings")} href="/settings" />
          <NavRow
            icon={Building2}
            label={t("settings.membersAndSpace")}
            href="/organization"
          />
          <NavRow
            icon={UserIcon}
            label={t("userMenu.profile")}
            href="/profile"
          />
        </Card>
      </section>
    </div>
  );
}
