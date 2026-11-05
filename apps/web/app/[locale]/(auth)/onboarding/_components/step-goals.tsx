"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  PiggyBank,
  TrendingUp,
  Users,
  Plane,
  Home,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import type { GoalOption } from "./types";

type StepGoalsProps = {
  selected: GoalOption[];
  onToggleAction: (goal: GoalOption) => void;
};

export function StepGoals({ selected, onToggleAction }: StepGoalsProps) {
  const t = useTranslations("Onboarding.goals");
  const titleId = React.useId();

  const items: {
    id: GoalOption;
    title: string;
    description: string;
    icon: typeof PiggyBank;
  }[] = [
    { id: "save", title: t("saveTitle"), description: t("saveDesc"), icon: PiggyBank },
    { id: "control", title: t("controlTitle"), description: t("controlDesc"), icon: TrendingUp },
    { id: "split", title: t("splitTitle"), description: t("splitDesc"), icon: Users },
    { id: "travel", title: t("travelTitle"), description: t("travelDesc"), icon: Plane },
    { id: "house", title: t("houseTitle"), description: t("houseDesc"), icon: Home },
    { id: "other", title: t("otherTitle"), description: t("otherDesc"), icon: MoreHorizontal },
  ];

  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-1.5 text-center">
        <h1
          id={titleId}
          className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-[28px]"
        >
          {t("title")}
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Multi-select: square checkboxes (vs. round radios on the previous step) */}
      <div
        role="group"
        aria-labelledby={titleId}
        className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {items.map(({ id, title, description, icon: Icon }) => {
          const isSelected = selected.includes(id);
          return (
            <motion.button
              key={id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => onToggleAction(id)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group relative flex cursor-pointer flex-col items-start rounded-2xl border p-3.5 text-left transition-colors sm:p-4",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                isSelected
                  ? "border-primary bg-primary/[0.05] shadow-[0_0_0_1px_var(--primary)]"
                  : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-3 right-3 flex size-5 items-center justify-center rounded-md border-2 transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
                )}
              >
                {isSelected && <Check className="size-3.5 stroke-[3]" />}
              </span>

              <span
                className={cn(
                  "mb-3 flex size-10 items-center justify-center rounded-xl transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-5" />
              </span>

              <span className="text-sm leading-snug font-semibold text-foreground">
                {title}
              </span>
              <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                {description}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
