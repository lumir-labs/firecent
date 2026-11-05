"use client";

import { useQuery } from "@tanstack/react-query";
import { listRoles } from "@/lib/actions/roles";
import { UseCatalogFnResult } from "@/lib/general-types";

export function useRoles(): UseCatalogFnResult {
  const query = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await listRoles();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
  return {
    data:
      query.data?.map((role) => ({
        id: role.id,
        label: role.label || role.name,
      })) || [],
    error: query.error,
    isLoading: query.isLoading,
  };
}
