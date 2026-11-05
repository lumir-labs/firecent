"use client";

import { useTranslations } from "next-intl";
import BaseCreate from "@/components/base/base-create";
import { useRoles } from "@/hooks/use-roles";
import { createPermission } from "@/lib/actions/permissions";

// Define the specific type for this form
type PermissionFormData = {
  name: string;
  label: string;
  description: string;
  roles?: string[];
};

export default function CreatePermission() {
  const tAdmin = useTranslations("Admin");
  return (
    <BaseCreate<PermissionFormData>
      fieldConfig={[
        {
          name: "name",
          label: tAdmin("permissions.create.nameLabel"),
          type: "text" as const,
          required: true,
          placeholder: tAdmin("permissions.create.namePlaceholder"),
        },
        {
          name: "label",
          label: tAdmin("permissions.create.labelLabel"),
          type: "text" as const,
          required: true,
          placeholder: tAdmin("permissions.create.labelPlaceholder"),
        },
        {
          name: "description",
          label: tAdmin("permissions.create.descriptionLabel"),
          type: "textarea" as const,
          required: true,
          placeholder: tAdmin("permissions.create.descriptionPlaceholder"),
        },
        {
          name: "roles",
          label: tAdmin("permissions.create.rolesLabel"),
          type: "multi-select" as const,
          required: false,
          useOptionsFn: useRoles,
        },
      ]}
      createFn={async (data) => {
        console.log(data);
        return await createPermission({
          name: data.name,
          label: data.label,
          description: data.description,
          roles_ids: data.roles?.map((role) => Number(role)) || [],
        });
      }}
      itemLabel={tAdmin("permissions.create.itemLabel")}
      dialogTitle={tAdmin("permissions.create.title")}
      dialogDescription={tAdmin("permissions.create.description")}
      successMessage={tAdmin("permissions.create.success")}
      errorMessage={tAdmin("permissions.create.error")}
    />
  );
}
