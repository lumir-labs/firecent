"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

import { SuccessCelebrationIllustration } from "./onboarding-illustrations";

export function StepSuccess() {
  const t = useTranslations("Onboarding.success");

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      {/* Celebration Hero Badge */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 350, damping: 20 }}
        className="relative"
      >
        <SuccessCelebrationIllustration className="size-36 sm:size-40" />
      </motion.div>

      {/* Headings */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="space-y-2 max-w-xs mx-auto"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          {t("subtitle")}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1">
          {t("description")}
        </p>
      </motion.div>
    </div>
  );
}
