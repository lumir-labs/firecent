import { getTranslations } from "next-intl/server";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { listOrgApiKeys } from "@/lib/actions/api-keys";
import { p } from "@app/api/permissions";
import { ApiKeysTable } from "./_components/api-keys-table";

export default async function Page() {
  const tPortal = await getTranslations("Portal");
  const tAdmin = await getTranslations("Admin");

  // Gate `apikeys:menu` (mirror of the `p.*.menu` pattern used by admin pages).
  const menu = await validatePermission(p.apikeys.menu);
  if (!menu.hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }

  // Revoked keys included: the state (active/revoked/expired) must be visible.
  const keys = await listOrgApiKeys(true);
  if (keys.error || !keys.data) {
    return (
      <AccessAlert
        title={tAdmin("errorTitle")}
        description={tPortal("apiKeys.loadError")}
      />
    );
  }

  // Create/revoke/rotate buttons only with permission (the real guard
  // lives in each server action; this is just UX).
  const [create, revoke] = await Promise.all([
    validatePermission(p.apikeys.create),
    validatePermission(p.apikeys.revoke),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{tPortal("apiKeys.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {tPortal("apiKeys.desc")}
        </p>
      </div>

      <ApiKeysTable
        data={keys.data}
        canCreate={create.hasPermission}
        canManage={revoke.hasPermission}
      />
    </div>
  );
}
