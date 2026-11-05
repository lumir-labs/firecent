import * as z from "zod";

// Roles: only editable scalars (never relations like `permissions`).
export const roleCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(64, "Maximum 64 characters")
    .regex(
      /^[a-z0-9_-]+$/,
      "Only lowercase letters, numbers, hyphens and underscores",
    ),
  label: z.string().trim().min(1, "Label is required").max(128),
});
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;

export const roleUpdateSchema = z.object({
  id: z.number().int().positive(),
  prop: z.enum(["name", "label"]),
  value: z.string().trim().min(1, "Value is required").max(128),
});
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;

// Users: strict whitelist (no emailVerified/deletedAt/pwdReset).
export const userCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(64),
  lastName: z.string().trim().min(1, "Last name is required").max(64),
  email: z.email("Invalid email").trim().toLowerCase(),
  roleIds: z.array(z.number().int().positive()).default([]),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  prop: z.enum([
    "firstName",
    "middleName",
    "lastName",
    "lastName2",
    "email",
    "image",
  ]),
  value: z.string().trim().max(256),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const userRolesSchema = z.object({
  id: z.string().min(1),
  roleIds: z.array(z.number().int().positive()),
});
export type UserRolesInput = z.infer<typeof userRolesSchema>;

// Organizations
export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(128),
  description: z.string().trim().max(512).optional(),
});
export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>;

export const organizationUpdateSchema = z.object({
  id: z.string().min(1),
  prop: z.enum(["name", "description"]),
  value: z.string().trim().max(512),
});
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;

// Members: free-form role (each app defines its domain), but not empty.
export const memberRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.string().trim().min(1, "Role is required").max(32),
});
export type MemberRoleInput = z.infer<typeof memberRoleSchema>;

export const memberCreateSchema = z.object({
  email: z.email("Invalid email").trim().toLowerCase(),
  name: z.string().trim().max(128).optional(),
  role: z.string().trim().min(1).max(32).default("member"),
});
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
