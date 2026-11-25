import type { Metadata } from "next";
import type React from "react";
import { locale } from "next/root-params";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { p } from "@app/api/permissions";

import { getServerSession, resolveSessionOrgId } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { isLocale } from "@/i18n/utils";
import { TRPCProvider } from "@/providers/trpc-provider";
import { ShellProvider } from "./_components/shell/shell-context";
import { AppSidebar } from "./_components/shell/app-sidebar";
import { MobileTopBar } from "./_components/shell/mobile-top-bar";
import { MobileTabBar } from "./_components/shell/mobile-tab-bar";

export async function generateMetadata(): Promise<Metadata> {
  const tNav = await getTranslations("Nav");
  return {
    title: {
      template: `%s | ${process.env.NEXT_PUBLIC_APP_NAME ?? "Firecent"}`,
      default: tNav("home"),
    },
  };
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const localeValue = await locale();
  if (!isLocale(localeValue)) notFound();

  const session = await getServerSession();
  if (!session?.user) {
    return redirect({ href: "/auth/login", locale: localeValue });
  }

  const spaces = (
    (session.user as { organizations?: { id: string; name: string }[] })
      .organizations ?? []
  ).map((o) => ({ id: o.id, name: o.name }));
  const activeSpaceId = resolveSessionOrgId(session);

  const permissions = session.user.permissions ?? [];
  const canAccessAdmin = permissions.some(
    (perm) => p.users.menu.includes(perm) || p.roles.menu.includes(perm),
  );

  const shellUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };

  return (
    <TRPCProvider>
      <ShellProvider
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        user={shellUser}
        canAccessAdmin={canAccessAdmin}
      >
        <div className="flex min-h-dvh w-full overflow-x-clip bg-background text-foreground lg:h-dvh lg:overflow-hidden">
          <AppSidebar user={shellUser} canAccessAdmin={canAccessAdmin} />
          <div
            data-scroll-container
            className="flex min-h-dvh min-w-0 flex-1 flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
          >
            <MobileTopBar />
            <main className="mx-auto w-full max-w-[560px] flex-1 pb-28 lg:max-w-[1120px] lg:px-8 lg:pb-12">
              {children}
            </main>
          </div>
          <MobileTabBar />
        </div>
      </ShellProvider>
    </TRPCProvider>
  );
}
