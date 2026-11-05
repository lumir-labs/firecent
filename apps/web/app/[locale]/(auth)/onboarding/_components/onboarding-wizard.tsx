"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { ChevronLeft, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createOrganizationOnboarding } from "@/lib/actions/organization";

import type { UsageOption, GoalOption, OnboardingData } from "./types";
import { StepUsage } from "./step-usage";
import { StepGoals } from "./step-goals";
import { StepSpace } from "./step-space";
import { StepSuccess } from "./step-success";

type OnboardingWizardProps = {
  userName: string | null;
};

/** Steps that show a progress segment (the success screen is not counted). */
const TOTAL_STEPS = 3;
const SPACE_STEP = 2;
const SUCCESS_STEP = 3;
const MIN_SPACE_NAME = 3;
const SPACE_FORM_ID = "onboarding-space-form";

// Directional slide variants for motion
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -24 : 24, opacity: 0 }),
};

export function OnboardingWizard({ userName }: OnboardingWizardProps) {
  const t = useTranslations("Onboarding");
  const router = useRouter();

  const [stepIndex, setStepIndex] = React.useState<number>(0);
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [spaceNameError, setSpaceNameError] = React.useState<string | null>(null);

  const [data, setData] = React.useState<OnboardingData>({
    usage: "group",
    goals: ["save"],
    spaceName: "",
  });

  const goTo = (next: number) => {
    setDirection(next > stepIndex ? 1 : -1);
    setStepIndex(next);
  };

  const handleNext = () => {
    if (stepIndex < SPACE_STEP) goTo(stepIndex + 1);
  };

  const handleBack = () => {
    if (stepIndex > 0 && stepIndex < SUCCESS_STEP) goTo(stepIndex - 1);
  };

  const handleSkip = () => goTo(SPACE_STEP);

  const handleCreateSpace = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = data.spaceName.trim();
    if (trimmed.length < MIN_SPACE_NAME) {
      setSpaceNameError(t("organization.nameMin"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOrganizationOnboarding(trimmed);

      if (result.error) {
        // If unauthenticated in demo/preview, allow advancing to the success step to experience the full UI
        if (
          result.error.includes("permission") ||
          result.error.includes("valid session") ||
          result.error.includes("No session")
        ) {
          goTo(SUCCESS_STEP);
          return;
        }
        toast.error(result.error, { richColors: true });
        return;
      }

      goTo(SUCCESS_STEP);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("organization.createError"),
        { richColors: true },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    router.push("/");
    router.refresh();
  };

  const canGoBack = stepIndex > 0 && stepIndex < SUCCESS_STEP;
  const canSkip = stepIndex < SPACE_STEP;
  const isSpaceStep = stepIndex === SPACE_STEP;
  const isSuccess = stepIndex === SUCCESS_STEP;

  const ctaLabel = isSuccess
    ? t("success.cta")
    : isSpaceStep
      ? t("space.submit")
      : t("next");

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          // Full-screen on every size: header & CTA stay fixed, only the step content changes.
          "relative z-10 flex h-svh w-full flex-col overflow-clip",
        )}
      >
        {/* ── Header: back · logo · skip, then progress ── */}
        <header className="mx-auto w-full max-w-3xl shrink-0 space-y-4 px-5 pt-4 sm:space-y-6 sm:px-8 sm:pt-8">
          <div className="grid h-10 grid-cols-[1fr_auto_1fr] items-center">
            <div className="justify-self-start">
              {canGoBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  aria-label={t("back")}
                  className="-ml-2 flex size-10 cursor-pointer items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-50"
                >
                  <ChevronLeft className="size-5.5 stroke-[2.5]" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-center">
              <Image
                src="/logo.svg"
                alt="Firecent"
                width={130}
                height={34}
                className="h-7 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                src="/logo_d.svg"
                alt="Firecent"
                width={130}
                height={34}
                className="hidden h-7 w-auto object-contain dark:block"
                priority
              />
            </div>

            <div className="justify-self-end">
              {canSkip && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="-mr-2 cursor-pointer rounded-lg px-2.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  {t("skip")}
                </button>
              )}
            </div>
          </div>

          {!isSuccess && (
            <StepProgress
              current={stepIndex}
              total={TOTAL_STEPS}
              label={t("progress", { step: stepIndex + 1, total: TOTAL_STEPS })}
            />
          )}
        </header>

        {/* ── Step content (scrolls on short screens instead of being cut off) ── */}
        <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-5 py-6 sm:px-8 sm:py-10">
          <div className="mx-auto w-full max-w-2xl sm:my-auto">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={stepIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="w-full"
              >
                {stepIndex === 0 && (
                  <StepUsage
                    selected={data.usage}
                    onSelectAction={(usage: UsageOption) =>
                      setData((prev) => ({ ...prev, usage }))
                    }
                  />
                )}

                {stepIndex === 1 && (
                  <StepGoals
                    selected={data.goals}
                    onToggleAction={(goal: GoalOption) =>
                      setData((prev) => {
                        const exists = prev.goals.includes(goal);
                        return {
                          ...prev,
                          goals: exists
                            ? prev.goals.filter((g) => g !== goal)
                            : [...prev.goals, goal],
                        };
                      })
                    }
                  />
                )}

                {isSpaceStep && (
                  <form id={SPACE_FORM_ID} onSubmit={handleCreateSpace} noValidate>
                    <StepSpace
                      usage={data.usage}
                      spaceName={data.spaceName}
                      error={spaceNameError}
                      onSpaceNameChange={(spaceName: string) => {
                        setSpaceNameError(null);
                        setData((prev) => ({ ...prev, spaceName }));
                      }}
                      isSubmitting={isSubmitting}
                    />
                  </form>
                )}

                {isSuccess && <StepSuccess />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ── Footer: one primary action, always in the same place ── */}
        <footer className="shrink-0 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-12">
          <div className="mx-auto w-full max-w-md">
            <Button
              type={isSpaceStep ? "submit" : "button"}
              form={isSpaceStep ? SPACE_FORM_ID : undefined}
              variant="gradient"
              onClick={isSpaceStep ? undefined : isSuccess ? handleFinish : handleNext}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="group h-12 w-full cursor-pointer rounded-2xl text-base font-semibold shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>{t("space.submitting")}</span>
                </>
              ) : (
                <>
                  <span>{ctaLabel}</span>
                  <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

function StepProgress({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-3">
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-valuetext={label}
        className="flex flex-1 gap-1.5"
      >
        {Array.from({ length: total }, (_, idx) => (
          <div
            key={idx}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted-foreground/15"
          >
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: idx <= current ? "100%" : "0%" }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        ))}
      </div>
      <span className="text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums">
        {label}
      </span>
    </div>
  );
}
