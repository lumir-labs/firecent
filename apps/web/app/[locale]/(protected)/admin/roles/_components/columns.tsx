"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";
import { TextFieldUpdate } from "./prop-edit";
import type { Role } from "@/lib/actions/roles";

export const columnVisibilityState: {
  [key: string]: boolean;
} = {
  id: false,
};

export const columnSortingState = [];

export function useRolesColumns(): ColumnDef<Role>[] {
  const t = useTranslations("Admin");

  return useMemo(
    (): ColumnDef<Role>[] => [
      {
        accessorKey: "id",
        id: "id",
        header: t("roles.columns.id"),
      },
      {
        accessorKey: "name",
        id: "name",
        header: t("roles.columns.name"),
        cell: ({ row }) => (
          <TextFieldUpdate
            role={row.original}
            current={row.original.name}
            prop="name"
          />
        ),
      },
      {
        accessorKey: "label",
        id: "label",
        header: t("roles.columns.label"),
        cell: ({ row }) => (
          <TextFieldUpdate
            role={row.original}
            current={row.original.label || ""}
            prop="label"
          />
        ),
      },
      {
        id: "actions",
        accessorKey: "actions",
        header: t("roles.columns.actions"),
        cell: ({ row }) => <DataTableRowActions row={row} />,
      },
    ],
    [t],
  );
}
