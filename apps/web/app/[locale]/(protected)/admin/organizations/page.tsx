import { OrganizationsTable } from "./_components/organizations-table";
import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { getTranslations } from "next-intl/server";
import { listOrganizations } from "@/lib/actions/organization";
import { p } from "@app/api/permissions";

export default async function Page() {
  const tAdmin = await getTranslations("Admin");
  const { hasPermission } = await validatePermission(p.organizations.menu);
  if (!hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }
  const organizations = await listOrganizations();
  if (organizations.error) {
    return (
      <AccessAlert
        title={tAdmin("errorTitle")}
        description={organizations.error}
      />
    );
  }
  return <OrganizationsTable data={organizations.data || []} />;
}
