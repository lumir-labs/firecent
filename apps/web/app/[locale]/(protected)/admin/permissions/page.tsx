import PermissionsMatrixTable from "./permissions-table";
import AccessAlert from "@/components/common/access-alert";
import { getTranslations } from "next-intl/server";
import { listPermissions, validatePermission } from "@/lib/actions/permissions";
import { listRoles } from "@/lib/actions/roles";
import {
  getMissingPermissionsGrouped,
  getUnusedPermissions,
  p,
} from "@/lib/permissions";
import MissingPermissions from "./missing-permissions";
import UnusedPermissions from "./unused-permissions";

export default async function page() {
  const tAdmin = await getTranslations("Admin");
  const res = await validatePermission(p.permissions.menu);
  if (!res.hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }

  const permissionsList = await listPermissions();
  if (permissionsList.error || !permissionsList.data) {
    return (
      <AccessAlert
        title={tAdmin("permissions.loadErrorTitle")}
        description={tAdmin("permissions.permissionsLoadError")}
      />
    );
  }
  const rolesList = await listRoles();
  if (rolesList.error) {
    return (
      <AccessAlert
        title={tAdmin("permissions.loadErrorTitle")}
        description={tAdmin("permissions.rolesLoadError")}
      />
    );
  }

  const permissionsListNames = permissionsList.data.map((p) => p.name);
  const missingPermissionsGrouped =
    getMissingPermissionsGrouped(permissionsListNames);
  const unusedPermissions = getUnusedPermissions(permissionsList.data);

  return (
    <>
      <MissingPermissions
        missingPermissionsGrouped={missingPermissionsGrouped}
      />
      <UnusedPermissions unusedPermissions={unusedPermissions} />
      <PermissionsMatrixTable
        permissions={permissionsList?.data || []}
        roles={rolesList?.data || []}
      />
    </>
  );
}
