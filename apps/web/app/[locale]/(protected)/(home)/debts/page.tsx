import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { p } from "@app/api/permissions";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { DebtsView } from "./_components/debts-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Debts");
  return { title: t("title") };
}

export default async function DebtsPage() {
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

  return <DebtsView />;
}
