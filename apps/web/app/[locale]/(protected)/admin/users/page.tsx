import { UsersTable } from "./_components/users-table";
import { listUsers } from "@/lib/actions/users";
import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { getTranslations } from "next-intl/server";
import { p } from "@app/api/permissions";

export default async function Page() {
  const tAdmin = await getTranslations("Admin");
  const { hasPermission } = await validatePermission(p.users.menu);
  if (!hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }
  const users = await listUsers();
  if ("error" in users) {
    return (
      <AccessAlert title={tAdmin("errorTitle")} description={users.error} />
    );
  }
  return <UsersTable data={users} />;
}
