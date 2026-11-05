"use server";

import type { PermissionKey } from "@app/api/permissions";
import { getSessionOrganization } from "./organization";
import { validatePermission } from "./permissions";
import type { Session } from "../auth";

type ValidateSuccess = {
  success: true;
  session: Session | null;
  orgId: string;
};

type ValidateError = {
  success: false;
  error: string;
};

export type ValidateResult = ValidateSuccess | ValidateError;

export async function validate(
  permission: PermissionKey,
): Promise<ValidateResult> {
  const { hasPermission, session } = await validatePermission(permission);

  if (!hasPermission || !session) {
    return {
      success: false,
      error: "You don't have permission to perform this action",
    };
  }

  const org = await getSessionOrganization();
  if (!org?.OrganizationId || org.error) {
    return { success: false, error: "No valid organization found" };
  }

  return {
    success: true,
    session,
    orgId: org.OrganizationId,
  };
}
