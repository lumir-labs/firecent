"use client";

import { useQuery } from "@tanstack/react-query";
import { listOrganizationMembers } from "@/lib/actions/organization-members";
import { UseCatalogFnResult } from "@/lib/general-types";

export function useOrganizationMembers(): UseCatalogFnResult {
  const query = useQuery({
    queryKey: ["organization-members"],
    queryFn: async () => {
      const res = await listOrganizationMembers();
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    retry: false,
  });

  return {
    data:
      query.data?.map((organizationMember) => ({
        id: organizationMember.user.id,
        label: organizationMember.user.name || organizationMember.user.email,
        imageSrc: organizationMember.user.image,
      })) || [],
    error: query.error,
    isLoading: query.isLoading,
  };
}
