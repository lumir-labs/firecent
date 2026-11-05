"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createMissingPermissions } from "@/lib/actions/permissions";
import { DefinedPermission } from "@/lib/permissions";
import { AlertTriangle, Loading02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface MissingPermissionsProps {
  missingPermissionsGrouped: Record<string, DefinedPermission[]>;
}

export default function MissingPermissions({
  missingPermissionsGrouped,
}: MissingPermissionsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const tAdmin = useTranslations("Admin");
  const router = useRouter();

  const categories = Object.keys(missingPermissionsGrouped || {});
  const totalMissing = Object.values(missingPermissionsGrouped || {}).reduce(
    (acc, list) => acc + list.length,
    0,
  );

  if (totalMissing === 0) {
    return null;
  }

  async function handleCreatePermissions() {
    setIsCreating(true);
    try {
      const allMissing = Object.values(missingPermissionsGrouped).flat();

      const result = await createMissingPermissions(
        allMissing.map((item) => ({
          name: item.key,
          label: item.label,
          description: item.description,
        })),
      );

      if (result.error) {
        toast.error(
          tAdmin("permissions.missing.createError", { error: result.error }),
        );
        return;
      }

      toast.success(
        tAdmin("permissions.missing.created", {
          count: String(result.count),
        }),
      );
      router.refresh();
    } catch {
      toast.error(tAdmin("permissions.missing.error"));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Alert className="mb-4 border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10 text-amber-900 dark:text-amber-200">
      <HugeiconsIcon
        icon={AlertTriangle}
        size={18}
        strokeWidth={2.5}
        className="text-amber-600 dark:text-amber-400 mt-0.5"
      />
      <AlertTitle className="flex items-center justify-between font-semibold text-sm mb-2">
        <div className="flex items-center gap-2">
          <span>{tAdmin("permissions.missing.title")}</span>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-700 dark:text-amber-300 font-mono text-xs"
          >
            {totalMissing}
          </Badge>
        </div>
      </AlertTitle>

      <AlertDescription className="space-y-3 text-xs">
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category} className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded capitalize">
                {category}:
              </span>
              {missingPermissionsGrouped[category].map((perm) => (
                <Badge
                  key={perm.key}
                  variant="outline"
                  className="bg-background/60 text-foreground font-normal border-amber-500/20 text-[11px]"
                >
                  {perm.label}
                </Badge>
              ))}
            </div>
          ))}
        </div>

        <div className="pt-1">
          <Button
            variant="default"
            size="sm"
            disabled={isCreating}
            onClick={handleCreatePermissions}
            className="gap-2 h-8 text-xs"
          >
            {isCreating && (
              <HugeiconsIcon
                icon={Loading02Icon}
                size={14}
                className="animate-spin"
              />
            )}
            {tAdmin("permissions.missing.action", {
              count: String(totalMissing),
            })}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
