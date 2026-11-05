"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import type { Organization } from "@/lib/actions/organization";
import { DataTableRowActions } from "./data-table-row-actions";
import { TextFieldUpdate } from "./prop-edit";

export const columnVisibilityState: {
  [key: string]: boolean;
} = {
  id: false,
};

export const columnSortingState = [];

export function useOrganizationsColumns(): ColumnDef<Organization>[] {
  const t = useTranslations("Admin");

  return useMemo(
    (): ColumnDef<Organization>[] => [
      {
        accessorKey: "id",
        id: "id",
        header: t("organizations.columns.id"),
      },
      {
        accessorKey: "name",
        id: "name",
        header: t("organizations.columns.name"),
        cell: ({ row }) => (
          <TextFieldUpdate
            organization={row.original}
            current={row.original.name}
            prop="name"
          />
        ),
      },
      {
        accessorKey: "description",
        id: "description",
        header: t("organizations.columns.description"),
        cell: ({ row }) => (
          <TextFieldUpdate
            organization={row.original}
            current={row.original.description || ""}
            prop="description"
          />
        ),
      },
      {
        id: "actions",
        accessorKey: "actions",
        header: t("organizations.columns.actions"),
        cell: ({ row }) => <DataTableRowActions row={row} />,
      },
    ],
    [t],
  );
}
