import "server-only";

import { Separator } from "@/components/ui/separator";
import ClientBreadcrumb from "@/components/common/breadcrumb";
import ThemeSwitcher from "@/components/common/theme-switcher";
import { OrgSwitcher } from "@/components/common/org-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "@/i18n/navigation";
import UserMenu from "../../admin/_components/user-menu";
import Image from "next/image";
import type { User } from "better-auth";
import {
  getSessionOrganization,
  listMyOrganizations,
} from "@/lib/actions/organization";

export default async function Header({ user }: { user: User | null }) {
  // Switcher: real memberships (not the permission-gated catalog) + the
  // session's active org. If the query fails, the header degrades without a switcher.
  const [orgsResult, activeResult] = await Promise.all([
    listMyOrganizations(),
    getSessionOrganization(),
  ]);
  const orgs = orgsResult.data ?? [];
  const activeId = activeResult.OrganizationId ?? null;

  return (
    <header>
      {/* Single desktop + mobile bar: NO logo (it lives only in the sidebar
          with its name), breadcrumb truncated with ellipsis (min-w-0) and a
          fixed right cluster so nothing stacks on anything at 360px. */}
      <div className="flex h-14 items-center justify-between gap-2 bg-card px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="hidden shrink-0 sm:flex" />
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 sm:hidden"
          >
            <Image
              src="/icon.webp"
              alt="logo"
              width={28}
              height={28}
              className="sm:h-7 h-5 w-auto dark:invert"
            />
          </Link>
          <Separator
            orientation="vertical"
            className="mr-1 hidden shrink-0 min-[420px]:block"
          />
          <div className="min-w-0 flex-1">
            <ClientBreadcrumb />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <OrgSwitcher orgs={orgs} activeId={activeId} />
          <ThemeSwitcher variant="short" />
          <UserMenu user={user} roles={[]} isViewAs={null} canViewAs={false} />
        </div>
      </div>
    </header>
  );
}
