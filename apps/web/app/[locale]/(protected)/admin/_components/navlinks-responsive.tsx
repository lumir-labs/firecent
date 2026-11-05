"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { stripLocalePrefix } from "@/i18n/routing";
import { Menubar, MenubarMenu } from "@/components/ui/menubar";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { useSidebarNotifications } from "@/hooks/use-notifications";
import getMenu from "./menus";
import { isMenuSectionActive } from "@/lib/menu";
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
  const notifications = useSidebarNotifications(permissions);
  const menu = getMenu({
    notifications,
    permissions,
  });

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 flex justify-center z-10">
      <Menubar className="w-full bg-card flex flex-row justify-around items-start rounded-t-2xl relative border h-18 py-0 shadow-none">
        {menu.categories.map((cat) => (
          <MenubarMenu key={cat.title}>
            <Link
              href={cat.path || "#"}
              className={cn(
                isMenuSectionActive(pathName, cat)
                  ? selectedClassName
                  : unselectedClassName,
                "relative mx-0 px-1 hover:text-muted-foreground data-[state=open]:bg-muted data-[state=open]:text-muted-foreground hover:bg-muted focus:bg-muted outline-hidden cursor-pointer text-2xl py-2 w-16 flex items-center justify-center transition-colors duration-400",
              )}
            >
              <div className="flex flex-col gap-1 items-center">
                <span>{cat.icon}</span>
                <span className="text-[9.5px]">{tNav(cat.title)}</span>
              </div>

              {cat.items.some(
                (item) =>
                  item.notifications?.count !== undefined &&
                  item.notifications.count > 0,
              ) && (
                <div className="absolute top-2 right-3 w-[10px] h-[10px] rounded-full bg-red-600 border-white border-2"></div>
              )}
            </Link>
          </MenubarMenu>
        ))}
      </Menubar>
    </div>
  );
}
