"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import type { UsageOption } from "./types";
import {
  GroupAvatarIllustration,
  PersonalAvatarIllustration,
  BusinessIllustration,
} from "./onboarding-illustrations";

type StepUsageProps = {
  selected: UsageOption;
  onSelectAction: (usage: UsageOption) => void;
};

const NAV_KEYS: Record<string, 1 | -1> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export function StepUsage({ selected, onSelectAction }: StepUsageProps) {
  const t = useTranslations("Onboarding.usage");
  const titleId = React.useId();
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const options: {
    id: UsageOption;
    title: string;
    description: string;
    Illustration: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: "group",
      title: t("groupTitle"),
      description: t("groupDesc"),
      Illustration: GroupAvatarIllustration,
    },
    {
      id: "personal",
      title: t("personalTitle"),
      description: t("personalDesc"),
      Illustration: PersonalAvatarIllustration,
    },
    {
      id: "business",
      title: t("businessTitle"),
      description: t("businessDesc"),
      Illustration: BusinessIllustration,
    },
  ];

  // Standard radio-group keyboard behaviour: arrows move and select.
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta = NAV_KEYS[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onSelectAction(options[next].id);
    optionRefs.current[next]?.focus();
  };

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

      {/* Rows on mobile, 3 columns on desktop */}
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
      >
        {options.map(({ id, title, description, Illustration }, index) => {
          const isSelected = selected === id;
          return (
            <motion.button
              key={id}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelectAction(id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group relative flex cursor-pointer items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-colors",
                "sm:flex-col sm:gap-3 sm:px-4 sm:pt-7 sm:pb-5 sm:text-center",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                isSelected
                  ? "border-primary bg-primary/[0.05] shadow-[0_0_0_1px_var(--primary)]"
                  : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <Illustration className="size-12 shrink-0 rounded-2xl sm:size-16" />

              <div className="min-w-0 flex-1 space-y-0.5 sm:flex-none sm:space-y-1">
                <div className="text-[15px] leading-snug font-semibold text-foreground sm:text-base">
                  {title}
                </div>
                <div className="text-[13px] leading-normal text-muted-foreground">
                  {description}
                </div>
              </div>

              {/* Radio indicator: inline on mobile, top-right on desktop */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  "sm:absolute sm:top-3 sm:right-3",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
                )}
              >
                {isSelected && <Check className="size-3.5 stroke-[3]" />}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
