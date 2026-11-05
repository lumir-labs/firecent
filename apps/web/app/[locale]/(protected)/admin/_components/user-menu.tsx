import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
//import RoleBadge from "@/components/elements/home/role-badge";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ChevronDown,
  HelpCircle,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Logout from "./logout";
import RoleSwitcher from "./role-switcher";
import type { Role } from "@app/db";
import type { User } from "better-auth";
import ThemeSwitcher from "@/components/common/theme-switcher";
import Image from "next/image";

export default async function UserMenu({
  user,
  roles,
  isViewAs,
  canViewAs,
}: {
  user: User | null;
  roles: Role[];
  isViewAs: string | null;
  canViewAs: boolean;
}) {
  const tNav = await getTranslations("Nav");
  return (
    <div className="flex shrink-0 justify-between items-center max-h-14 sm:p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex justify-between items-center cursor-pointer gap-1"
          nativeButton={false}
          render={
            <div className="flex items-center">
              <Avatar>
                <AvatarImage src={user?.image || ""} />
                <AvatarFallback>
                  {`${user?.name?.charAt(0).toUpperCase()}`}
                </AvatarFallback>
              </Avatar>
              <div className="text-left sm:flex sm:flex-col sm:justify-center hidden mx-1 leading-5 text-foreground">
                <div className="flex items-start gap-1">
                  <p className="text-xs font-semibold">{user?.name}</p>
                  {/* <RoleBadge size="sm" role={session?.user?.role || ""} /> */}
                </div>
                <p className="leading-3 text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              <ChevronDown className="h-4 mx-2 text-muted-foreground" />
            </div>
          }
        />
        <DropdownMenuContent
          className="max-w-max min-w-max"
          align="end"
          sideOffset={10}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
            <ThemeSwitcher variant="long" />
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href={`/profile`} className="flex items-center gap-2">
                <UserIcon className="size-4" />
                <p>{tNav("userMenu.viewProfile")}</p>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Link href={`/profile`} className="flex items-center gap-2">
                <Settings className="size-4" />
                <p>{tNav("userMenu.settings")}</p>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Link href={`/`} className="flex items-center gap-2">
                <HelpCircle className="size-4" />
                <p>{tNav("userMenu.help")}</p>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          {/*           {canViewAs && (
            <>
              <RoleSwitcher roles={roles} isViewAs={isViewAs} />
              <DropdownMenuSeparator />
            </>
          )} */}

          <DropdownMenuGroup>
            <Logout>
              <DropdownMenuItem>{tNav("userMenu.logout")}</DropdownMenuItem>
            </Logout>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
