"use client";

import type { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const t = useTranslations("Common");
  const selected = table.getFilteredSelectedRowModel().rows.length;
  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();
  return (
    <div className="flex items-center justify-between px-2 pt-4 gap-2 flex-wrap">
      {selected > 0 ? (
        <div className="flex-1 text-sm text-muted-foreground">
          {t("pagination.selectedRows", {
            selected: String(selected),
            total: String(total),
          })}
        </div>
      ) : (
        <div className="flex-1 text-sm text-muted-foreground">
          {t("pagination.rows", { total: String(total) })}
        </div>
      )}
      <div className="flex items-center space-x-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-max">
          <p className="text-sm font-medium">{t("pagination.rowsPerPage")}</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-5 min-w-max">
          <div className="flex items-center justify-center text-sm font-medium">
            {t("pagination.page")} {pageIndex} {t("pagination.of")}{" "}
            {pageCount}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t("pagination.firstPage")}</span>
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">{t("pagination.previousPage")}</span>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t("pagination.nextPage")}</span>
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">{t("pagination.lastPage")}</span>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
