import { z } from "zod";

export const permissionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  label: z.string().min(1, "Label is required"),
  description: z.string().optional(),
  roles_ids: z.array(z.number().int().positive()).optional(),
});
export type PermissionInput = z.infer<typeof permissionSchema>;
