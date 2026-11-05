"use client";

import { DataTable } from "./data-table";
import { useRolesColumns } from "./columns";
import type { Role } from "@/lib/actions/roles";

export function RolesTable({ data }: { data: Role[] }) {
  const columns = useRolesColumns();
  return <DataTable columns={columns} data={data} />;
}
