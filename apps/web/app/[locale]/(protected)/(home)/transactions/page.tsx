import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { p } from "@app/api/permissions";
import { AddRecord } from "./_components/add-record";
import { TransactionsList } from "./_components/transactions-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Transactions");
  return { title: t("title") };
}

/**
 * Transactions (records) of the organization in session.
 * Gate `dashboard:basic`; the list fetches through tRPC (`records.list`),
 * which re-checks the same permission.
 */
export default async function Page() {
  const t = await getTranslations("Transactions");
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <TransactionsList />
      <AddRecord />
    </div>
  );
}
