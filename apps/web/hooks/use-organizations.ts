"use client";

import { useQuery } from "@tanstack/react-query";
import { UseCatalogFnResult } from "@/lib/general-types";
import { listOrganizations } from "@/lib/actions/organization";

export function useOrganizations(): UseCatalogFnResult {
  const query = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await listOrganizations();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
  return {
    data:
      query.data?.map((organization) => ({
        id: organization.id,
        label: organization.name,
      })) || [],
    error: query.error,
    isLoading: query.isLoading,
  };
}

export function useOrganizationsCatalog(): UseCatalogFnResult {
  const query = useQuery({
    // Same key as useOrganizations: a single shared fetch.
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await listOrganizations();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
  return {
    data:
      query.data?.map((organization) => ({
        id: organization.id,
        label: organization.name,
      })) || [],
    error: query.error,
    isLoading: query.isLoading,
  };
}
