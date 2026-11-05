"use client";

import BaseCreate from "@/components/base/base-create";
import { useTranslations } from "next-intl";

import { createRole } from "@/lib/actions/roles";

export default function NewRole() {
  const tAdmin = useTranslations("Admin");
  return (
    <BaseCreate
      dialogTitle={tAdmin("roles.newRole.title")}
      dialogDescription={tAdmin("roles.newRole.description")}
      fieldConfig={[
        {
          name: "name",
          label: tAdmin("roles.newRole.roleLabel"),
          type: "text",
          placeholder: tAdmin("roles.newRole.rolePlaceholder"),
        },
        {
          name: "label",
          label: tAdmin("roles.newRole.nameLabel"),
          type: "text",
          placeholder: tAdmin("roles.newRole.namePlaceholder"),
        },
      ]}
      createFn={createRole}
    />
  );
}
