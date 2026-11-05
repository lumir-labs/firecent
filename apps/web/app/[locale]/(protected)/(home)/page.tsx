import { getTranslations } from "next-intl/server";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { p } from "@app/api/permissions";
import { NetWorthCard } from "./_components/net-worth-card";

/**
 * Home dashboard. Gate `dashboard:basic` (server-side); the data itself is
 * fetched by each card through tRPC, which re-checks the same permission.
 */
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <NetWorthCard className="lg:col-span-8" />
    </div>
  );
}
