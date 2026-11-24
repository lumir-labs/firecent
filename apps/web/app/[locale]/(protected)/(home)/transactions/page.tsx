import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { p } from "@app/api/permissions";
import { TransactionsView } from "./_components/transactions-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Transactions");
  return { title: t("title") };
}

export default async function Page() {
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

  return (
    <Suspense>
      <TransactionsView />
    </Suspense>
  );
}
