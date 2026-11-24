import { getTranslations } from "next-intl/server";
import type { LucideIcon } from "lucide-react";

import { PageHeader, StateBlock } from "@/components/finance";

export async function ComingSoonPage({
  titleKey,
  icon,
  back = "/more",
}: {
  titleKey: string;
  icon: LucideIcon;
  back?: string;
}) {
  const t = await getTranslations("Shell");
  const title = t(titleKey as never);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} back={back} backLabel={t("nav.more")} />
      <StateBlock
        kind="empty"
        icon={icon}
        title={title}
        body={t("comingSoon")}
      />
    </div>
  );
}
