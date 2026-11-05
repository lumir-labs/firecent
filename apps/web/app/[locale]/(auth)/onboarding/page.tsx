import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/auth";
import { isLocale } from "@/i18n/utils";
import { OnboardingWizard } from "./_components/onboarding-wizard";
import { locale } from "next/root-params";

export default async function Page() {
  const localeValue = await locale();
  if (!isLocale(localeValue)) notFound();

  const session = await getServerSession();

  return (
    <div className="relative h-svh max-h-svh w-full flex flex-col items-center justify-center bg-background overflow-clip selection:bg-primary/20">
      {/* Decorative ambient background glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full bg-primary/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 size-[500px] rounded-full bg-orange-400/8 blur-3xl"
      />

      <OnboardingWizard userName={session?.user?.name ?? null} />
    </div>
  );
}
