"use client";

import { useState, useEffect } from "react";
import { usePermissionColumns } from "./_components/columns";
import { DataTable } from "./_components/data-table";
import { useRouter } from "@/i18n/navigation";
import { PermissionWithRoles } from "@/lib/actions/permissions";
import { Role } from "@/lib/actions/roles";

interface PermissionMatrixProps {
  permissions: PermissionWithRoles[];
  roles: Role[];
}

export default function PermissionsMatrixTable({
  permissions,
  roles,
}: PermissionMatrixProps) {
  const [permissionRoles, setPermissionRoles] = useState<Map<string, boolean>>(
    new Map(),
  );
  const { refresh } = useRouter();

  // Initialize the permissions assigned to roles
  useEffect(() => {
    const initialPermissionRoles = new Map<string, boolean>();

    roles.forEach((role) => {
      if (role.id && role.permissions) {
        role.permissions.forEach((permission) => {
          const key = `${permission.id}-${role.id}`;
          initialPermissionRoles.set(key, true);
        });
      }
    });

    async function updatePermissionRoles() {
      setPermissionRoles(initialPermissionRoles);
    }
    updatePermissionRoles();
  }, [roles]);

  // Function to toggle a role for a permission
  const toggleRole = (permissionId: number, roleId: number) => {
    const key = `${permissionId}-${roleId}`;
    const newPermissionRoles = new Map(permissionRoles);

    if (newPermissionRoles.has(key)) {
      newPermissionRoles.set(key, !newPermissionRoles.get(key));
    } else {
      newPermissionRoles.set(key, true);
    }

    setPermissionRoles(newPermissionRoles);
  };

  // Function to check whether a permission is assigned to a role
  const isPermissionAssigned = (
    permissionId: number,
    roleId: number,
  ): boolean => {
    return permissionRoles.get(`${permissionId}-${roleId}`) || false;
  };

  // Create columns dynamically
  const columns = usePermissionColumns(
    roles,
    isPermissionAssigned,
    toggleRole,
    refresh,
  );

  return (
    <div className="space-y-4">
      <DataTable data={permissions} columns={columns} />
    </div>
  );
}
