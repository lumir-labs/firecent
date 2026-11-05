"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { deleteViewAsCookie } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { createViewAsCookie } from "@/lib/actions/admin";
import { Check } from "lucide-react";
import type { Role } from "@app/db";

export default function RoleSwitcher({
  isViewAs,
  roles,
}: {
  isViewAs: string | null;
  roles: Role[];
}) {
  const router = useRouter();
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const [isLoading, setIsLoading] = useState(false);
  return (
    <>
      {!isViewAs && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Eye className="size-4 mr-2" />
            )}
            {tAdmin("roleSwitcher.viewAs")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {roles?.map((role) => (
              <DropdownMenuItem
                key={role.id}
                disabled={isLoading}
                onClick={async () => {
                  setIsLoading(true);
                  await deleteViewAsCookie().then(async () => {
                    await createViewAsCookie(role.id.toString()).then(() => {
                      router.refresh();
                      setIsLoading(false);
                      /*                             window.location.reload(); */
                    });
                  });
                }}
              >
                {role.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}

      {isViewAs && (
        <>
          <DropdownMenuItem disabled>
            {tAdmin("roleSwitcher.viewingAs")}{" "}
            <Badge variant="destructive">
              {roles?.find((role) => role.id.toString() === isViewAs)?.label}
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Eye className="size-4 mr-2 text-muted-foreground" />
              )}
              {tAdmin("roleSwitcher.switch")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {roles?.map((role) => (
                <DropdownMenuItem
                  key={role.id}
                  disabled={isLoading || role.id.toString() === isViewAs}
                  onClick={async () => {
                    setIsLoading(true);
                    await deleteViewAsCookie().then(async () => {
                      await createViewAsCookie(role.id.toString()).then(() => {
                        router.refresh();
                        setIsLoading(false);
                        /*                             window.location.reload(); */
                      });
                    });
                  }}
                >
                  {role.label}
                  {isViewAs === role.id.toString() && (
                    <Check className="size-4 mr-2 text-destructive" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onClick={() => {
              setIsLoading(true);
              deleteViewAsCookie().then(() => {
                router.refresh();
                setIsLoading(false);
              });
            }}
          >
            <EyeOff className="size-4 mr-2 text-muted-foreground" />
            {tCommon("cancel")}
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
