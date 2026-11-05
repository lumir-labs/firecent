"use client";

import { DataTable } from "./data-table";
import { useUsersColumns } from "./columns";
import type { User } from "@/lib/actions/users";

export function UsersTable({ data }: { data: User[] }) {
  const columns = useUsersColumns();
  return <DataTable columns={columns} data={data} />;
}
