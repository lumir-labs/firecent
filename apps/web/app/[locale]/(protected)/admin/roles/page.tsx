import { RolesTable } from "./_components/roles-table";
import { listRoles } from "@/lib/actions/roles";
import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { getTranslations } from "next-intl/server";
import { p } from "@app/api/permissions";

export default async function page() {
  const tAdmin = await getTranslations("Admin");
  const { hasPermission } = await validatePermission(p.roles.menu);
  if (!hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }
  const roles = await listRoles();
  if (roles.error) {
    return (
      <AccessAlert title={tAdmin("errorTitle")} description={roles.error} />
    );
  }
  return <RolesTable data={roles.data || []} />;
}
