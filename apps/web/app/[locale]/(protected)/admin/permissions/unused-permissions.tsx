"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteUnusedPermissions, PermissionWithRoles } from "@/lib/actions/permissions";
import { Delete02Icon, Loading02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface UnusedPermissionsProps {
  unusedPermissions: PermissionWithRoles[];
}

export default function UnusedPermissions({
  unusedPermissions,
}: UnusedPermissionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const tAdmin = useTranslations("Admin");
  const router = useRouter();

  if (!unusedPermissions || unusedPermissions.length === 0) {
    return null;
  }

  async function handleDeletePermissions() {
    setIsDeleting(true);
    try {
      const ids = unusedPermissions.map((perm) => perm.id);
      const result = await deleteUnusedPermissions(ids);

      if (result.error) {
        toast.error(
          tAdmin("permissions.unused.deleteError", { error: result.error }),
        );
        return;
      }

      toast.success(
        tAdmin("permissions.unused.deleted", {
          count: String(result.count),
        }),
      );
      router.refresh();
    } catch {
      toast.error(tAdmin("permissions.unused.error"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Alert className="mb-4 border-destructive/30 bg-destructive/5 text-destructive dark:text-red-400">
      <HugeiconsIcon
        icon={Delete02Icon}
        size={18}
        strokeWidth={2.5}
        className="text-destructive mt-0.5"
      />
      <AlertTitle className="flex items-center justify-between font-semibold text-sm mb-2">
        <div className="flex items-center gap-2">
          <span>{tAdmin("permissions.unused.title")}</span>
          <Badge variant="outline" className="border-destructive/40 text-destructive font-mono text-xs">
            {unusedPermissions.length}
          </Badge>
        </div>
      </AlertTitle>

      <AlertDescription className="space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {unusedPermissions.map((perm) => (
            <Badge
              key={perm.id}
              variant="outline"
              className="bg-background/60 text-foreground font-normal border-destructive/20 text-[11px]"
            >
              {perm.label || perm.name}
            </Badge>
          ))}
        </div>

        <div className="pt-1">
          <Button
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            onClick={handleDeletePermissions}
            className="gap-2 h-8 text-xs"
          >
            {isDeleting && (
              <HugeiconsIcon
                icon={Loading02Icon}
                size={14}
                className="animate-spin"
              />
            )}
            {tAdmin("permissions.unused.action", {
              count: String(unusedPermissions.length),
            })}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
