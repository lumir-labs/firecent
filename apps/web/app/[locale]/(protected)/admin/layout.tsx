import type { Metadata } from "next";
import type React from "react";
import { getTranslations } from "next-intl/server";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./_components/app-sidebar";
import Header from "./_components/header";
import { NavlinksResponsive } from "./_components/navlinks-responsive";
import Redirect from "./_components/redirect";
import { getServerSession } from "@/lib/auth";
import QueryProvider from "@/providers/query-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { p } from "@app/api/permissions";

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
  const session = await getServerSession();
  if (!session?.user.emailVerified) {
    return <Redirect href="/auth/reset" />;
  }

  const sessionPermissions = session?.user?.permissions || [];
  const hasAdminAccess =
    sessionPermissions.includes(p.dashboard.basic.key) ||
    sessionPermissions.includes(p.roles.menu.key) ||
    sessionPermissions.includes(p.permissions.menu.key) ||
    sessionPermissions.includes(p.users.menu.key) ||
    sessionPermissions.includes(p.organizations.menu.key);

  if (!hasAdminAccess) {
    return <Redirect href="/" />;
  }

  // "12:23  Error: Do not pass children as props. Instead, nest children between the opening and closing tags.  react/no-children-prop"
  return (
    <QueryProvider>
      <SidebarProvider className="max-h-dvh w-dvw overflow-hidden">
        <AppSidebar permissions={sessionPermissions || []} />
        <SidebarInset className="min-w-0 mb-0 sm:mb-0 bg-sidebar">
          <Header user={session?.user || null} />
          <ScrollArea className="bg-background flex-1 sm:pb-4 p-4 px-6 pb-20 overflow-hidden">
            {children}
          </ScrollArea>
        </SidebarInset>
        <NavlinksResponsive session={session} />
      </SidebarProvider>
    </QueryProvider>
  );
}
