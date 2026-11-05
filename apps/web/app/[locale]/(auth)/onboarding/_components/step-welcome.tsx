"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

type StepWelcomeProps = {
  userName: string | null;
};

export function StepWelcome({ userName }: StepWelcomeProps) {
  const t = useTranslations("Onboarding");

  return (
    <div className="flex flex-col items-center text-center space-y-4 py-4">
      <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl shadow-sm">
        <Sparkles className="size-7" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          {t("welcome.title", { name: userName ? `, ${userName}` : "" })}
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          {t("welcome.description")}
        </p>
      </div>
    </div>
  );
}
