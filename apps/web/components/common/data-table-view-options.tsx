"use client";

import type { HeaderContext, Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Settings2 } from "lucide-react";
import { isValidElement } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  const t = useTranslations("Common");
  function extractTextFromReactNode(
    node: React.ReactNode & { props?: { children: React.ReactNode } },
  ): string {
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (!node || !isValidElement(node)) return "";

    const children = node.props?.children;
    if (typeof children === "string") return children;
    if (Array.isArray(children)) {
      return children.map(extractTextFromReactNode).join("");
    }
    return extractTextFromReactNode(children as string);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="ml-auto h-8">
            <Settings2 className="size-4 mr-1" />
            {t("table.view")}
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="w-max max-h-[70vh] overflow-y-auto no-scrollbar"
      >
        <DropdownMenuLabel>{t("table.columns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table.getAllColumns().map((column) => {
          let value = "";

          if (typeof column.columnDef.header === "function") {
            const headerNode = column.columnDef.header({
              column,
            } as unknown as HeaderContext<TData, unknown>);
            value =
              extractTextFromReactNode(headerNode).trim() !== ""
                ? extractTextFromReactNode(headerNode)
                : column.id.replace(/[-,_]/g, " ");
          } else if (typeof column.columnDef.header === "string") {
            value =
              column.columnDef.header.trim() !== ""
                ? column.columnDef.header
                : column.id.replace(/[-,_]/g, " ");
          } else {
            value = column.id.replace(/[-,_]/g, " ");
          }

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize min-w-max"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              <span className="capitalize">{value}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
