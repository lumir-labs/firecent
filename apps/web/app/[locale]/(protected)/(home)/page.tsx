import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { p } from "@app/api/permissions";

import AccessAlert from "@/components/common/access-alert";
import { validatePermission } from "@/lib/actions/permissions";
import { getServerSession } from "@/lib/auth";
import { HomeView } from "./_components/home/home-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Shell");
  return { title: t("nav.home") };
}

export default async function Page() {
  const [tAdmin, session, access] = await Promise.all([
    getTranslations("Admin"),
    getServerSession(),
    validatePermission(p.dashboard.basic),
  ]);

  if (!access.hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }

  const userName = session?.user?.name || session?.user?.email || "";
  return <HomeView userName={userName} />;
}
