import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import Image from "next/image";

import { isLocale } from "@/i18n/utils";
import { Link } from "@/i18n/navigation";
import { ResetForm } from "./_components/reset-form";
import { AuthHero } from "../login/_components/auth-hero";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = await getTranslations({ locale, namespace: "Auth" });
  return {
    title: t("loginTitle"),
    description: t("loginDescription"),
  };
}

/**
 * Destination of the unverified-email guard (`admin/layout.tsx` redirects here
 * with `<Redirect href="/auth/reset" />`).
 *
 * Phase 0 NOTE: better-auth runs with `emailAndPassword` disabled
 * (`apps/web/lib/auth.ts`) and no reset/forget-password plugin, so there is
 * no `forgetPassword` flow to wire. The project is passwordless
 * (magic-link + Google): requesting a new link also verifies the email and
 * unblocks the redirect. No auth configuration is improvised for hygiene.
 */
export default function ResetPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-background">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs flex flex-col gap-6">
            <Link
              href="/landing"
              className="flex items-center gap-2 font-medium"
            >
              <div className="flex items-center justify-center">
                <Image
                  src="/logo_d.svg"
                  alt="Firecent"
                  width={200}
                  height={70}
                  className="hidden dark:block w-44 h-auto"
                  priority
                />
                <Image
                  src="/logo.svg"
                  alt="Firecent"
                  width={200}
                  height={70}
                  className="w-44 h-auto dark:hidden"
                  priority
                />
              </div>
            </Link>
            <Suspense>
              <ResetForm />
            </Suspense>
          </div>
        </div>
      </div>
      <AuthHero />
    </div>
  );
}
