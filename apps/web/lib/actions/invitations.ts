"use server";

import { headers } from "next/headers";
import { db } from "@app/db";
import { auth } from "../auth";
import { validatePermission } from "./permissions";
import { getSessionOrganization } from "./organization";
import { p } from "@app/api/permissions";
import { isDuplicateMemberError, parseInviteInput } from "./invitation-helpers";

export type OrgInvitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const body = (error as { body?: { message?: unknown } }).body;
    if (typeof body?.message === "string" && body.message) return body.message;
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

/**
 * Invites an email to the session org. Requires `organization-members:create`.
 * Pre-checks existing membership to return a friendly error instead of a 500.
 */
export async function inviteMember(input: {
  email: string;
  role: string;
}): Promise<{
  data?: { id: string };
  error?: string;
  duplicateMember?: boolean;
}> {
  const parsed = parseInviteInput(input);
  if (!parsed.ok) {
    return { error: "Invalid email or role" };
  }
  const { hasPermission, session } = await validatePermission(
    p.organizationMembers.create,
  );
  if (!hasPermission || !session) {
    return { error: "You don't have permission to invite members" };
  }
  const org = await getSessionOrganization();
  if (!org?.OrganizationId) {
    return { error: "No valid organization found" };
  }
  const callerMember = await db.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: org.OrganizationId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });
  if (!callerMember) {
    return { error: "You are not a member of this organization" };
  }
  if (callerMember.role === "member" && parsed.data.role !== "member") {
    return { error: "Members can only invite other members" };
  }
  if (callerMember.role === "admin" && parsed.data.role === "owner") {
    return { error: "Only organization owners can invite new owners" };
  }
  const existingUser = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existingUser) {
    const alreadyMember = await db.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: org.OrganizationId,
          userId: existingUser.id,
        },
      },
      select: { id: true },
    });
    if (alreadyMember) {
      return {
        error: "That email is already a member of the organization",
        duplicateMember: true,
      };
    }
  }
  try {
    const invitation = await auth.api.createInvitation({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId: org.OrganizationId,
      },
    });
    return { data: { id: invitation.id } };
  } catch (error) {
    if (isDuplicateMemberError(error)) {
      return {
        error: "That email is already a member of the organization",
        duplicateMember: true,
      };
    }
    return { error: apiErrorMessage(error, "Error sending the invitation") };
  }
}

export async function listInvitations(): Promise<{
  data?: OrgInvitation[];
  error?: string;
}> {
  const { hasPermission } = await validatePermission(
    p.organizationMembers.list,
  );
  if (!hasPermission) {
    return { data: [], error: "You don't have permission to view invitations" };
  }
  const org = await getSessionOrganization();
  if (!org?.OrganizationId) {
    return { data: [], error: "No valid organization found" };
  }
  try {
    const invitations = await auth.api.listInvitations({
      headers: await headers(),
      query: { organizationId: org.OrganizationId },
    });
    return {
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: new Date(inv.expiresAt),
        createdAt: new Date(inv.createdAt),
      })),
    };
  } catch (error) {
    return {
      data: [],
      error: apiErrorMessage(error, "Error listing invitations"),
    };
  }
}

export async function cancelInvitation(
  invitationId: string,
): Promise<{ success?: string; error?: string }> {
  const { hasPermission } = await validatePermission(
    p.organizationMembers.delete,
  );
  if (!hasPermission) {
    return { error: "You don't have permission to cancel invitations" };
  }
  const org = await getSessionOrganization();
  if (!org?.OrganizationId) {
    return { error: "No valid organization found" };
  }
  const invitation = await db.invitation.findUnique({
    where: { id: invitationId },
    select: { organizationId: true },
  });
  if (!invitation || invitation.organizationId !== org.OrganizationId) {
    return { error: "Invitation not found in this organization" };
  }
  try {
    await auth.api.cancelInvitation({
      headers: await headers(),
      body: { invitationId },
    });
    return { success: "Invitation canceled" };
  } catch (error) {
    return { error: apiErrorMessage(error, "Error canceling the invitation") };
  }
}

/**
 * Accepts one's own invitation. Only requires a session: the plugin
 * validates that the invitation matches the caller's email and is still valid.
 */
export async function acceptInvitation(
  invitationId: string,
): Promise<{ success?: string; error?: string }> {
  try {
    await auth.api.acceptInvitation({
      headers: await headers(),
      body: { invitationId },
    });
    return { success: "Invitation accepted" };
  } catch (error) {
    return { error: apiErrorMessage(error, "Error accepting the invitation") };
  }
}
