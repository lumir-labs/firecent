import type { Metadata } from "next";
import type React from "react";
import { locale } from "next/root-params";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UserSidebar } from "./_components/user-sidebar";
import Header from "./_components/header";
import { NavlinksResponsive } from "./_components/navlinks-responsive";
import { getServerSession } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { isLocale } from "@/i18n/utils";
import { TRPCProvider } from "@/providers/trpc-provider";
import { ScrollArea } from "@/components/ui/scroll-area";

export async function generateMetadata(): Promise<Metadata> {
  const tNav = await getTranslations("Nav");
  return {
    title: {
      template: `%s | ${process.env.NEXT_PUBLIC_APP_NAME}`,
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

  // Session guard: requires login, without the admin's view-as block and
  // without the redirect to `/auth/reset` (a route the admin uses but this
  // area doesn't need as a gate).
  const session = await getServerSession();
  if (!session?.user) {
    return redirect({ href: "/auth/login", locale: localeValue });
  }

  const sessionPermissions = session.user.permissions || [];

  // "12:23  Error: Do not pass children as props. Instead, nest children between the opening and closing tags.  react/no-children-prop"
  return (
    <TRPCProvider>
      <SidebarProvider className="max-h-dvh w-dvw overflow-hidden">
        <UserSidebar permissions={sessionPermissions} />
        <SidebarInset className="min-w-0 mb-0 sm:mb-0 bg-background">
          <Header user={session.user} />
          {/* Padding goes INSIDE the viewport: on the root it shrinks the
              viewport, which then clips the cards' outer ring/shadow and
              leaves dead, non-scrolling space under the content. */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4 pb-28 sm:px-6 sm:pb-6">{children}</div>
          </ScrollArea>
        </SidebarInset>
        <NavlinksResponsive session={session} />
      </SidebarProvider>
    </TRPCProvider>
  );
}
