import type { Prisma } from "@app/db";

type ValidateError = {
  success: false;
  error: string;
};

export type CurrentOrganization = Prisma.OrganizationGetPayload<{
  select: {
    id: true;
    name: true;
    description: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

export type GetCurrentOrganizationResult =
  | {
      success: true;
      data: CurrentOrganization;
    }
  | ValidateError;

export type ListOrganizationsSuccess = {
  success: true;
  data: Partial<
    Prisma.OrganizationGetPayload<{
      select: Partial<Prisma.OrganizationSelect>;
    }>
  >[];
  total: number;
};

export type ListOrganizationsResult = ListOrganizationsSuccess | ValidateError;
