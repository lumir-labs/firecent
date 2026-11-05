"use client";

import { useTranslations } from "next-intl";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/common/data-table-view-options";
import { X } from "lucide-react";
import NewUser from "./new-role";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  setGlobalFilterAction: (value: string) => void;
}

export function DataTableToolbar<TData>({
  table,
  setGlobalFilterAction,
}: DataTableToolbarProps<TData>) {
  const t = useTranslations("Common");
  const isFiltered = table.getState().globalFilter.length > 0;

  return (
    <div className="w-full flex gap-2 items-center flex-wrap justify-between">
      <div className="w-full flex flex-1 items-center space-x-2">
        <Input
          placeholder={t("table.filter")}
          value={(table.getState().globalFilter as string) ?? ""}
          onChange={(event) => setGlobalFilterAction(event.target.value)}
          className="h-8 w-full lg:w-80 min-w-40"
        />
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => setGlobalFilterAction("")}
            className="h-8 px-2 lg:px-3"
          >
            {t("table.clear")}
            <X className="size-4 ml-1" />
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <NewUser />
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
