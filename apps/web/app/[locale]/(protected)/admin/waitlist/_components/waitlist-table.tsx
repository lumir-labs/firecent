"use client";

import { DataTable } from "./data-table";
import { useWaitlistColumns } from "./columns";
import type { WaitlistEntry } from "@/lib/actions/waitlist";

export function WaitlistTable({ data }: { data: WaitlistEntry[] }) {
  const columns = useWaitlistColumns();
  return <DataTable columns={columns} data={data} />;
}
