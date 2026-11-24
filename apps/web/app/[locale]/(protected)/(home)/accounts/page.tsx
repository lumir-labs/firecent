import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { p } from "@app/api/permissions";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { AccountsView } from "./_components/accounts-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Accounts");
  return { title: t("title") };
}

export default async function AccountsPage() {
  const tAdmin = await getTranslations("Admin");
  const access = await validatePermission(p.dashboard.basic);
  if (!access.hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }

  return <AccountsView />;
}
