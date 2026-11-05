"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import { isMenuActive } from "@/lib/menu";
import { cn } from "@/lib/utils";
import getUserMenu from "./user-menus";

// Brand sidebar item: quiet at rest, soft grey on hover, primary tint when
// active. Semantic tokens only, so light/dark follow the theme with no
// per-mode classes.
const itemClassName = cn(
  "h-9 gap-2.5 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/80",
  "hover:text-sidebar-foreground [&_svg]:size-[18px]",
  "data-active:bg-sidebar-primary/10 data-active:text-sidebar-primary",
  "data-active:hover:bg-sidebar-primary/10 data-active:hover:text-sidebar-primary",
);

const groupLabelClassName =
  "h-auto px-2.5 pt-0 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase";

export function UserSidebar({ permissions }: { permissions: string[] }) {
  const tNav = useTranslations("Nav");
  const pathName = usePathname();

  const menu = getUserMenu({ permissions });
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "firecent";

  return (
    <Sidebar className="border-none">
      <SidebarHeader className="px-5 pt-5 pb-3">
        <Link href="/" aria-label={appName} className="flex w-fit">
          <Image
            src="/logo.svg"
            alt={appName}
            width={112}
            height={28}
            className="h-7 w-auto dark:hidden"
            priority
          />
          <Image
            src="/logo_d.svg"
            alt={appName}
            width={112}
            height={28}
            className="hidden h-7 w-auto dark:block"
            priority
          />
        </Link>
      </SidebarHeader>
      <SidebarContent className="no-scrollbar gap-5 px-3 pt-2">
        {menu.categories
          .filter((category) => category.sidebar !== false)
          .map((category) => (
            <SidebarGroup key={category.title} className="p-0">
              <SidebarGroupLabel className={groupLabelClassName}>
                {tNav(category.title)}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {category.items
                    .filter((item) => item.sidebar !== false)
                    .map((item) => {
                      const active = isMenuActive(pathName, item.path);
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={active}
                            className={itemClassName}
                            render={
                              <Link
                                href={item.path}
                                aria-current={active ? "page" : undefined}
                              >
                                {item.icon}
                                <span>{tNav(item.title)}</span>
                              </Link>
                            }
                          />
                        </SidebarMenuItem>
                      );
                    })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
