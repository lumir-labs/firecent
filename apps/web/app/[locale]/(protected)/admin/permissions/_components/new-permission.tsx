import BaseCreate from "@/components/base/base-create";
import { getTranslations } from "next-intl/server";

import { createPermission } from "@/lib/actions/permissions";
import { useRoles } from "@/hooks/use-roles";

export default async function NewPermission() {
  const tAdmin = await getTranslations("Admin");
  return (
    <BaseCreate
      dialogTitle={tAdmin("permissions.newPermission.title")}
      dialogDescription={tAdmin("permissions.newPermission.description")}
      fieldConfig={[
        {
          name: "name",
          label: tAdmin("permissions.newPermission.permissionLabel"),
          type: "text",
          placeholder: tAdmin("permissions.newPermission.permissionPlaceholder"),
        },
        {
          name: "label",
          label: tAdmin("permissions.newPermission.nameLabel"),
          type: "text",
          placeholder: tAdmin("permissions.newPermission.namePlaceholder"),
        },
        {
          name: "description",
          label: tAdmin("permissions.newPermission.descriptionLabel"),
          required: false,
          type: "textarea",
          placeholder: tAdmin(
            "permissions.newPermission.descriptionPlaceholder",
          ),
        },
        {
          name: "roles_ids",
          label: tAdmin("permissions.newPermission.rolesLabel"),
          type: "multi-select",
          useOptionsFn: useRoles,
        },
      ]}
      createFn={createPermission}
    />
  );
}
