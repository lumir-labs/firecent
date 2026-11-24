import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { p } from "@app/api/permissions";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { RecurringView } from "./_components/recurring-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Recurring");
  return { title: t("title") };
}

export default async function RecurringPage() {
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

  return <RecurringView />;
}
