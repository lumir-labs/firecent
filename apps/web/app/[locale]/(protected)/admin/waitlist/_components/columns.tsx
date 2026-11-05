"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import type { WaitlistEntry } from "@/lib/actions/waitlist";
import { DataTableRowActions } from "./data-table-row-actions";

export const columnVisibilityState: {
  [key: string]: boolean;
} = {
  id: false,
};

export const columnSortingState = [];

export function useWaitlistColumns(): ColumnDef<WaitlistEntry>[] {
  const t = useTranslations("Admin");
  const format = useFormatter();

  return useMemo(
    (): ColumnDef<WaitlistEntry>[] => [
      {
        accessorKey: "id",
        id: "id",
        header: t("waitlist.columns.id"),
      },
      {
        accessorKey: "email",
        id: "email",
        header: t("waitlist.columns.email"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: t("waitlist.columns.createdAt"),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {format.dateTime(new Date(row.original.createdAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        ),
      },
      {
        id: "actions",
        accessorKey: "actions",
        header: t("waitlist.columns.actions"),
        cell: ({ row }) => <DataTableRowActions row={row} />,
      },
    ],
    [t, format],
  );
}
