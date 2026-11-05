import { WaitlistTable } from "./_components/waitlist-table";
import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { getTranslations } from "next-intl/server";
import { listWaitlist } from "@/lib/actions/waitlist";
import { p } from "@app/api/permissions";

export default async function Page() {
  const tAdmin = await getTranslations("Admin");
  const { hasPermission } = await validatePermission(p.waitlist.menu);
  if (!hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }
  const waitlist = await listWaitlist();
  if (waitlist.error) {
    return (
      <AccessAlert title={tAdmin("errorTitle")} description={waitlist.error} />
    );
  }
  return <WaitlistTable data={waitlist.data || []} />;
}
