import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/providers/query-provider";

export function useAuditNotifications(enabled: boolean = true) {
  return useQuery({
    queryKey: ["audit-notifications"],
    queryFn: async () => {
      return 0;
    },
    enabled, // Only run the query when enabled
    staleTime: 10 * 60 * 1000, // 10 minutes - data considered fresh for longer
    // refetchInterval removed - manual invalidation is better
  });
}

export function useTaskNotifications(enabled: boolean = true) {
  return useQuery({
    queryKey: ["task-notifications"],
    queryFn: async () => {
      return 0;
    },
    enabled, // Only run the query when enabled
    staleTime: 10 * 60 * 1000, // 10 minutes - data considered fresh for longer
    // refetchInterval removed - manual invalidation is better
  });
}

export function invalidateTaskNotifications() {
  queryClient.invalidateQueries({ queryKey: ["task-notifications"] });
}

// Hook to manage all sidebar notifications
export function useSidebarNotifications(permissions: string[]) {
  const hasAuditPermission = permissions.includes("audit_menu");
  const hasTaskPermission = permissions.includes("projects_menu");

  const auditNotifications = useAuditNotifications(hasAuditPermission);
  const taskNotifications = useTaskNotifications(hasTaskPermission);

  return {
    audit: {
      count: auditNotifications.data,
      isLoading: auditNotifications.isLoading,
      error: auditNotifications.error,
    },
    project: {
      count: taskNotifications.data,
      isLoading: taskNotifications.isLoading,
      error: taskNotifications.error,
    },
  };
}
// Hook to manually invalidate notifications
export function useInvalidateNotifications() {
  const queryClient = useQueryClient();

  return {
    // Invalidate audit notifications
    invalidateAuditNotifications: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-notifications"] });
    },

    // Invalidate all notifications
    invalidateAllNotifications: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-notifications"] });
      // Add more notification types here when available
    },

    // Immediate refetch of audit notifications
    refetchAuditNotifications: () => {
      queryClient.refetchQueries({ queryKey: ["audit-notifications"] });
    },
  };
}
