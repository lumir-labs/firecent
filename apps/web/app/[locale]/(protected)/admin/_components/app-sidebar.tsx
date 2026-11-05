"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { useSidebarNotifications } from "@/hooks/use-notifications";
import getMenu from "./menus";
import { isMenuActive } from "@/lib/menu";
import { cn } from "@/lib/utils";
import Image from "@/components/common/image";

export function AppSidebar({ permissions }: { permissions: string[] }) {
  const tNav = useTranslations("Nav");
  const pathName = usePathname();

  // Load notifications only for the menus the user can see
  const notifications = useSidebarNotifications(permissions);

  const menu = getMenu({ permissions, notifications });

  const highlightPath = (subItem: string) => isMenuActive(pathName, subItem);

  return (
    <Sidebar className="border-none dark">
      <SidebarHeader className=" items-center p-4">
        <div className="flex max-h-12 h-12 items-center gap-2">
          <div className="flex items-center gap-2">
            <Image
              src="/icon.webp"
              alt="logo"
              width={200}
              height={200}
              className="w-10 p-1 sm:mt-1 mt-0 dark:invert"
              fallback={
                <div className="text-white font-bold text-lg">
                  {process.env.NEXT_PUBLIC_APP_NAME}
                </div>
              }
            />
            <span className="text-base font-bold text-white -mb-1">
              {process.env.NEXT_PUBLIC_APP_NAME}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="no-scrollbar">
        <SidebarGroup className="pt-0 pl-4 pr-0">
          <SidebarMenu>
            {menu.categories
              .filter((item) => item.sidebar !== false)
              .map((item) => (
                <Collapsible
                  key={item.title}
                  defaultOpen={true}
                  className="group/collapsible"
                  render={
                    <SidebarMenuItem>
                      {item.title ? (
                        <div className="text-[10px] mb-1 font-bold text-muted-foreground/60 uppercase px-2 pt-3 flex items-center gap-2">
                          {/*  {item.icon && <item.icon className="size-3" />} */}
                          {tNav(item.title)}
                        </div>
                      ) : null}
                      <CollapsibleContent className="py-2 mr-4">
                        <SidebarMenuSub className="mr-0 border-none mx-0 px-0">
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                className={cn(
                                  "text-[15px] h-9 w-full transition-all text-card-foreground flex items-center px-2 py-1 gap-2 hover:bg-primary dark:hover:bg-secondary-foreground rounded-lg hover:text-primary-foreground dark:hover:text-secondary",
                                  highlightPath(subItem.path)
                                    ? "bg-secondary-foreground text-secondary dark:bg-primary dark:text-primary-foreground"
                                    : "",
                                )}
                                render={
                                  <Link href={subItem.path}>
                                    <span>{subItem.icon}</span>
                                    <span>{tNav(subItem.title)}</span>
                                    {subItem.notifications !== undefined &&
                                    subItem.notifications.count !== undefined &&
                                    subItem.notifications.count > 0 ? (
                                      <Badge className="text-xs bg-destructive text-white leading-3 border-2 border-white rounded-full min-w-5.5 px-1.25 py-0.5 ml-auto">
                                        {subItem.notifications.count > 99
                                          ? "99+"
                                          : subItem.notifications.count}
                                      </Badge>
                                    ) : null}
                                  </Link>
                                }
                              />
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  }
                />
              ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
