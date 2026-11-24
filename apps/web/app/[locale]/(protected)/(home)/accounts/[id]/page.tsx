import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { p } from "@app/api/permissions";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { AccountDetailView } from "./_components/account-detail-view";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = Number.parseInt(id, 10);
  if (!Number.isFinite(accountId) || accountId <= 0) {
    notFound();
  }

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

  return <AccountDetailView accountId={accountId} />;
}
