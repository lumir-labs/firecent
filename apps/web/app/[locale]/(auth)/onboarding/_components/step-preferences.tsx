"use client";

import { User, Users, Building2, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { UsageOption } from "./types";

type StepPreferencesProps = {
  selected: UsageOption | null;
  onSelectAction: (usage: UsageOption) => void;
};

export function StepPreferences({
  selected,
  onSelectAction,
}: StepPreferencesProps) {
  const t = useTranslations("Onboarding");
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "App";

  const options: { id: UsageOption; icon: typeof User }[] = [
    { id: "personal", icon: User },
    { id: "team", icon: Users },
    { id: "business", icon: Building2 },
  ];

  return (
    <div className="flex flex-col space-y-6 py-2">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold tracking-tight">
          {t("preferences.title", { appName })}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("preferences.description")}
        </p>
      </div>

      <div className="grid gap-3" role="radiogroup">
        {options.map(({ id, icon: Icon }) => {
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectAction(id)}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border text-left transition-all",
                "hover:border-primary/50 hover:bg-muted/50",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    {t(`preferences.${id}Label` as any)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(`preferences.${id}Description` as any)}
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  "size-5 rounded-full border flex items-center justify-center transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30",
                )}
              >
                {isSelected && <CheckCircle2 className="size-3.5" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
