"use client";

import { DataTable } from "./data-table";
import { useOrganizationsColumns } from "./columns";
import type { Organization } from "@/lib/actions/organization";

export function OrganizationsTable({ data }: { data: Organization[] }) {
  const columns = useOrganizationsColumns();
  return <DataTable columns={columns} data={data} />;
}
