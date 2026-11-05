import type { ColumnDef, Row } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PermissionWithRoles,
  updatePermission,
  updateRolePermission,
} from "@/lib/actions/permissions";
import { toast } from "sonner";
import CopyButton from "@/components/common/copy-button";
import { FieldUpdate } from "@/components/common/field-update";
import { Role } from "@/lib/actions/roles";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const columnVisibilityState: {
  [key: string]: boolean;
} = {
  id: false,
  name: false,
};

export const columnSortingState = [
  {
    id: "label",
    desc: false,
  },
];

// Invoked from a Client Component (permissions-table), which is why it can
// use hooks even though this file has no "use client".
export function usePermissionColumns(
  roles: Role[],
  isPermissionAssigned: (permissionId: number, roleId: number) => boolean,
  toggleRole: (permissionId: number, roleId: number) => void,
  refresh: () => void,
): ColumnDef<PermissionWithRoles>[] {
  const t = useTranslations("Admin");
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  async function handleCheckboxChange(
    permissionId: number,
    roleId: number,
    checked: boolean,
  ) {
    setIsUpdatingId(`${permissionId}-${roleId}`);
    if (checked) {
      toggleRole(permissionId, roleId);
      try {
        const result = await updateRolePermission(roleId, permissionId, "add");
        if (result?.warning) {
          toast.warning(`⚠️ ${result.warning.title}`, {
            description: result.warning.description,
            duration: 10000,
            richColors: true,
          });
        } else {
          toast.success(t("permissions.assigned"), { richColors: true });
        }
        refresh();
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : t("permissions.assignError");
        toast.error(msg, { richColors: true });
        toggleRole(permissionId, roleId);
      } finally {
        setIsUpdatingId(null);
      }
    } else {
      toggleRole(permissionId, roleId);
      try {
        await updateRolePermission(roleId, permissionId, "remove");
        toast.success(t("permissions.unassigned"), { richColors: true });
        refresh();
      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : t("permissions.unassignError");
        toast.error(msg, { richColors: true });
        toggleRole(permissionId, roleId);
      } finally {
        setIsUpdatingId(null);
      }
    }
  }

  return [
    {
      accessorKey: "id",
      id: "id",
      header: t("permissions.columns.id"),
    },
    {
      accessorKey: "name",
      id: "name",
      header: t("permissions.columns.permission"),
      cell: ({ row }) => {
        const permission = row.original;
        return (
          <div className="flex items-center gap-2">
            <CopyButton
              text={permission.name}
              message={t("permissions.copied")}
            />
            <span className="font-medium">{permission.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "label",
      id: "label",
      header: t("permissions.columns.label"),
      cell: ({ row }) => {
        const permission = row.original;
        return (
          <FieldUpdate
            current={permission.label || "-"}
            itemId={permission.id || 0}
            updateFn={(id, value) =>
              updatePermission({ id: permission.id || 0, prop: "label", value })
            }
          />
        );
      },
    },
    {
      accessorKey: "description",
      id: "description",
      header: t("permissions.columns.description"),
      cell: ({ row }) => {
        const permission = row.original;
        return (
          <FieldUpdate
            current={permission.description || "-"}
            itemId={permission.id || 0}
            updateFn={(id, value) =>
              updatePermission({
                id: permission.id || 0,
                prop: "description",
                value,
              })
            }
          />
        );
      },
    },
    // Dynamic columns for each role
    ...roles.map((role) => ({
      id: `role-${role.id}`,
      header: role.label || "",
      cell: ({ row }: { row: Row<PermissionWithRoles> }) => {
        const permission = row.original;
        const isUpdating = isUpdatingId === `${permission.id}-${role.id}`;
        return (
          <div className="text-center">
            {role.id && (
              <Checkbox
                disabled={isUpdating}
                className={cn(isUpdating && "cursor-wait opacity-50")}
                checked={isPermissionAssigned(permission.id, role.id)}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(
                    permission.id,
                    role.id,
                    checked as boolean,
                  )
                }
              />
            )}
          </div>
        );
      },
    })),
  ];
}
