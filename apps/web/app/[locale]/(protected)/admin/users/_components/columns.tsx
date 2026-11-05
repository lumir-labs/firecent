"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Column, ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CopyButton from "@/components/common/copy-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateUser, type User } from "@/lib/actions/users";
import { TextFieldUpdate } from "./prop-edit";
import BaseDialogMultiSelect from "@/components/base/base-dialog-multiselect";
import { useRoles } from "@/hooks/use-roles";
import { useOrganizationsCatalog } from "@/hooks/use-organizations";
import GenericSelect from "@/components/base/base-dialog-select";
import { getDateLocale } from "@/i18n/utils";

export const columnVisibilityState: {
  [key: string]: boolean;
} = {
  id: false,
  firstName: false,
  middleName: false,
  lastName: false,
  lastName2: false,
  createdAt: false,
  updatedAt: false,
};

export const columnSortingState = [];

function SortableHeader({
  column,
  title,
}: {
  column: Column<User>;
  title: string;
}) {
  return (
    <div className="flex items-center">
      <span className="min-w-max">{title}</span>
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {column.getIsSorted() === "asc" ? (
          <ChevronDown className="size-4" />
        ) : column.getIsSorted() === "desc" ? (
          <ChevronDown className="size-4 rotate-180" />
        ) : (
          <ChevronsUpDown className="size-4" />
        )}
      </Button>
    </div>
  );
}

type StatusTone = "confirmed" | "unconfirmed" | "passwordChange";

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <Badge
      className={cn(
        "text-xs font-medium leading-2 py-1.5",
        tone === "confirmed"
          ? "bg-brand-green text-brand-green-foreground"
          : tone === "unconfirmed"
            ? "bg-brand-gray text-brand-gray-foreground"
            : "bg-brand-blue text-brand-blue-foreground",
      )}
    >
      {label}
    </Badge>
  );
}

export function useUsersColumns(): ColumnDef<User>[] {
  const t = useTranslations("Admin");
  const dateLocale = getDateLocale(useLocale());

  return useMemo(() => {
    const formatDateTime = (value?: Date | string | null) =>
      value
        ? new Date(value).toLocaleDateString(dateLocale, {
            timeZone: "America/El_Salvador",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

    const statusOf = (emailVerified: boolean, pwdReset: boolean) => {
      if (pwdReset) return "passwordChange" as const;
      if (!emailVerified) return "unconfirmed" as const;
      return "confirmed" as const;
    };

    const columns: ColumnDef<User>[] = [
      {
        accessorKey: "id",
        id: "id",
        header: t("users.columns.id"),
      },
      {
        accessorKey: "image",
        id: "image",
        header: () => null,
        cell: ({ row }) => (
          <>
            <Avatar className="size-9">
              <AvatarImage
                src={row.original.image || undefined}
                className="object-cover"
              />
              <AvatarFallback className="text-xs">
                {row.original.firstName?.charAt(0).toUpperCase()}
                {row.original.lastName?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </>
        ),
      },
      {
        accessorKey: "name",
        id: "name",
        header: t("users.columns.name"),
        cell: ({ row }) =>
          `${row.original.firstName} ${row.original.lastName}`,
      },
      {
        accessorKey: "firstName",
        id: "firstName",
        header: ({ column }) => (
          <SortableHeader column={column} title={t("users.columns.firstName")} />
        ),
        cell: ({ row }) => (
          <TextFieldUpdate
            current={row.original.firstName}
            prop="firstName"
            user={row.original}
          />
        ),
      },
      {
        accessorKey: "middleName",
        id: "middleName",
        header: ({ column }) => (
          <SortableHeader
            column={column}
            title={t("users.columns.middleName")}
          />
        ),
        cell: ({ row }) => (
          <TextFieldUpdate
            current={row.original.middleName}
            prop="middleName"
            user={row.original}
          />
        ),
      },
      {
        accessorKey: "lastName",
        id: "lastName",
        header: ({ column }) => (
          <SortableHeader column={column} title={t("users.columns.lastName")} />
        ),
        cell: ({ row }) => (
          <TextFieldUpdate
            current={row.original.lastName}
            prop="lastName"
            user={row.original}
          />
        ),
      },
      {
        accessorKey: "lastName2",
        id: "lastName2",
        header: ({ column }) => (
          <SortableHeader
            column={column}
            title={t("users.columns.lastName2")}
          />
        ),
        cell: ({ row }) => (
          <TextFieldUpdate
            current={row.original.lastName2}
            prop="lastName2"
            user={row.original}
          />
        ),
      },
      {
        accessorKey: "email",
        id: "email",
        header: t("users.columns.email"),
        // Read-only on purpose: changing the login requires re-verification
        // (see user-update-guard.ts). Copy only.
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <span className="truncate">{row.original.email}</span>
            <CopyButton text={row.original.email} />
          </div>
        ),
      },
      {
        accessorKey: "status",
        id: "status",
        header: t("users.columns.status"),
        cell: ({ row }) => {
          const tone = statusOf(
            row.original.emailVerified,
            row.original.pwdReset,
          );
          return (
            <StatusBadge label={t(`users.status.${tone}`)} tone={tone} />
          );
        },
      },
      {
        accessorKey: "roles",
        id: "roles",
        header: t("users.columns.roles"),
        cell: ({ row }) => (
          <BaseDialogMultiSelect
            useCatalogFn={useRoles}
            itemLabel={t("users.rolesLabel")}
            value={row.original.roles.map((role) => role.id)}
            onChangeAction={async (ids) => {
              await updateUser({
                id: row.original.id,
                data: {
                  roles: {
                    set: ids.map((id) => ({
                      id: Number(id),
                    })),
                  },
                },
              });
            }}
          />
        ),
      },
      {
        accessorKey: "organization",
        id: "organization",
        header: t("users.columns.organization"),
        cell: ({ row }) => (
          <GenericSelect
            useCatalogFn={useOrganizationsCatalog}
            itemLabel={t("users.organizationLabel")}
            value={row.original.memberships[0]?.organization.id}
            onChangeAction={async (ids) => {
              const result = await updateUser({
                id: row.original.id,
                data: {
                  memberships: {
                    create: {
                      organizationId: ids as string,
                    },
                  },
                },
              });
              return result;
            }}
          />
        ),
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: () => (
          <div className="min-w-max">{t("users.columns.createdAt")}</div>
        ),
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        accessorKey: "updatedAt",
        id: "updatedAt",
        header: () => (
          <div className="min-w-max">{t("users.columns.updatedAt")}</div>
        ),
        cell: ({ row }) => formatDateTime(row.original.updatedAt),
      },
      {
        id: "actions",
        header: t("users.columns.actions"),
        cell: ({ row }) => <DataTableRowActions row={row} />,
      },
    ];

    return columns;
  }, [t, dateLocale]);
}
