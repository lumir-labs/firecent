"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  getFullMenu,
  type Menu,
} from "@/app/[locale]/(protected)/admin/_components/menus";
import { getFullUserMenu } from "@/app/[locale]/(protected)/(home)/_components/user-menus";

// Keep in sync with `packages/lib/src/messages/{es,en}.json` → `Nav.breadcrumb`.
type BreadcrumbKey =
  | "breadcrumb.records"
  | "breadcrumb.addRecord"
  | "breadcrumb.permissions"
  | "breadcrumb.roles"
  | "breadcrumb.users"
  | "breadcrumb.userData";

export default function ClientBreadcrumb() {
  const tNav = useTranslations("Nav");
  // Localized usePathname: comes without the locale prefix.
  const path = usePathname();
  // the path name is like this intranet/user-adm
  // const base = path.split('/')[1]
  const page = path.split("/")[1];
  const subPage = path.split("/")[2];
  const subSubPage = path.split("/")[3];

  const fullMenu = getFullMenu();

  const pageMenu = fullMenu.find((item: Menu) => item.path === `/${page}`);
  const subMenu = pageMenu?.items?.find(
    (item: Menu["items"][number]) => item.path === `/${page}/${subPage}`,
  );

  const specificPaths: { path: string; key: BreadcrumbKey }[] = [
    {
      path: "/schedule/calendar/record",
      key: "breadcrumb.records",
    },
    {
      path: "/schedule/calendar/create",
      key: "breadcrumb.addRecord",
    },
    {
      path: "/resources/root/permissions",
      key: "breadcrumb.permissions",
    },
    {
      path: "/resources/root/roles",
      key: "breadcrumb.roles",
    },
    {
      path: "/resources/root/users",
      key: "breadcrumb.users",
    },
    {
      path: "/resources/root/userdata",
      key: "breadcrumb.userData",
    },
  ];
  const specific = specificPaths.find((item) => path.startsWith(item.path));

  // Crumbs as data: intermediate ones are hidden below `md` (only the current
  // one stays visible and truncated with ellipsis on mobile so the layout doesn't break).
  type Crumb = { label: string | null; href?: `/${string}` };
  let crumbs: Crumb[] = [];

  // The admin menu (`getFullMenu`) doesn't know the authenticated area's
  // routes (`/`, `/profile`, `/organization/*`, ...): resolve against the
  // user menu (exact match or longest prefix) to avoid rendering empty.
  const fullUserMenu = getFullUserMenu();
  let userCategory: (typeof fullUserMenu)[number] | undefined;
  let userItem: (typeof fullUserMenu)[number]["items"][number] | undefined;
  for (const cat of fullUserMenu) {
    for (const entry of cat.items) {
      const matches =
        path === entry.path ||
        (entry.path !== "/" && path.startsWith(`${entry.path}/`));
      if (matches && (!userItem || entry.path.length > userItem.path.length)) {
        userCategory = cat;
        userItem = entry;
      }
    }
  }

  if (userCategory && userItem) {
    if (userItem.path !== userCategory.path) {
      crumbs = [
        {
          label: tNav(userCategory.title),
          href: userCategory.path as `/${string}`,
        },
        { label: tNav(userItem.title) },
      ];
    } else {
      crumbs = [{ label: tNav(userItem.title) }];
    }
  } else {
    if (pageMenu) crumbs.push({ label: tNav(pageMenu.title), href: `/${page}` });
    if (subMenu)
      crumbs.push({
        label: tNav(subMenu.title),
        href: `/${page}/${subPage}`,
      });
    if (specific) crumbs.push({ label: tNav(specific.key) });
  }

  if (crumbs.length === 0) return null;

  return (
    <div className="min-w-0">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap gap-1 overflow-hidden sm:gap-1.5">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <span
                key={`${crumb.label}-${index}`}
                className={
                  isLast
                    ? "flex min-w-0 items-center"
                    : "hidden shrink-0 items-center gap-1 sm:gap-1.5 md:flex"
                }
              >
                {index > 0 && <BreadcrumbSeparator />}
                {isLast || !crumb.href ? (
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate">
                      {crumb.label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                ) : (
                  <BreadcrumbItem>
                    <Link
                      href={crumb.href}
                      className="whitespace-nowrap text-card-foreground"
                    >
                      {crumb.label}
                    </Link>
                  </BreadcrumbItem>
                )}
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
