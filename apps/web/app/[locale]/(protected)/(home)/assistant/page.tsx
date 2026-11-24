import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader, StateBlock } from "@/components/finance";

export default async function AssistantPage() {
  const t = await getTranslations("Shell");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.assistant")} />
      <StateBlock
        kind="empty"
        icon={Sparkles}
        title={t("nav.assistant")}
        body={t("comingSoon")}
      />
    </div>
  );
}
