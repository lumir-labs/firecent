import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

import { isLocale } from "@/i18n/utils";
import { LoginForm } from "./_components/login-form";
import { AuthHero } from "./_components/auth-hero";

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

export default async function LoginPage() {
  const cookieStore = await cookies();
  // A pending 2FA challenge left by `signInTwoFactorHook`
  const pendingTwoFactor = cookieStore
    .getAll()
    .some((cookie) => /(^|\.)two_factor$/.test(cookie.name));

  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-background">
      {/* Left Column: Focused Login Experience */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 min-h-svh">
        <div className="w-full max-w-[380px] sm:max-w-[390px] flex flex-col justify-center my-auto">
          <LoginForm pendingTwoFactor={pendingTwoFactor} />
        </div>
      </div>

      {/* Right Column: Hero Visual Showcase */}
      <AuthHero />
    </div>
  );
}
