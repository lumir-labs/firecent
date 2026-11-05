"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { stripLocalePrefix } from "@/i18n/routing";
import { Menubar, MenubarMenu } from "@/components/ui/menubar";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import getUserMenu from "./user-menus";
import { isMenuActive, isMenuSectionActive } from "@/lib/menu";
import type { Session } from "@/lib/auth";

export function NavlinksResponsive({ session }: { session: Session | null }) {
  const tNav = useTranslations("Nav");
  const rawPathName = usePathname();
  const pathName = stripLocalePrefix(rawPathName);
  const permissions = session?.user.permissions || [];
  const selectedClassName =
    "border-t-4 border-primary font-bold text-primary";
  const unselectedClassName =
    "border-t-4 border-transparent text-muted-foreground";
  const menu = getUserMenu({
    permissions,
  });

  // One tab per item flagged `mobile` (the dashboard's main sections); a
  // category with none flagged collapses into a single tab (its own path).
  const tabs = menu.categories.flatMap((cat) => {
    const pinned = cat.items.filter((item) => item.mobile);
    if (pinned.length === 0) {
      return [
        {
          key: cat.title,
          title: cat.title,
          icon: cat.icon,
          href: cat.path || "#",
          active: isMenuSectionActive(pathName, cat),
        },
      ];
    }
    return pinned.map((item) => ({
      key: item.path,
      title: item.title,
      icon: item.icon,
      href: item.path,
      active: isMenuActive(pathName, item.path),
    }));
  });

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 flex justify-center z-10 pb-[env(safe-area-inset-bottom)]">
      <Menubar className="w-full bg-card flex flex-row justify-around items-start rounded-t-2xl relative border h-18 py-0 shadow-none">
        {tabs.map((tab) => (
          <MenubarMenu key={tab.key}>
            <Link
              href={tab.href}
              className={cn(
                tab.active ? selectedClassName : unselectedClassName,
                "relative mx-0 px-1 hover:text-muted-foreground data-[state=open]:bg-muted data-[state=open]:text-muted-foreground hover:bg-muted focus:bg-muted outline-hidden cursor-pointer text-2xl py-2 w-16 flex items-center justify-center transition-colors duration-400",
              )}
            >
              <div className="flex flex-col gap-1 items-center min-w-0">
                <span>{tab.icon}</span>
                <span className="text-[9.5px] leading-tight truncate max-w-full">{tNav(tab.title)}</span>
              </div>
            </Link>
          </MenubarMenu>
        ))}
      </Menubar>
    </div>
  );
}
