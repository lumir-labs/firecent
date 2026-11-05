"use client";

import BaseCreate from "@/components/base/base-create";
import { useTranslations } from "next-intl";
import { adminCreateOrganization } from "@/lib/actions/organization";

export default function CreateOrganization() {
  const tAdmin = useTranslations("Admin");
  return (
    <BaseCreate
      dialogTitle={tAdmin("organizations.create.title")}
      dialogDescription={tAdmin("organizations.create.description")}
      fieldConfig={[
        {
          name: "name",
          label: tAdmin("organizations.create.nameLabel"),
          type: "text",
          placeholder: tAdmin("organizations.create.namePlaceholder"),
        },
        {
          name: "description",
          label: tAdmin("organizations.create.descriptionLabel"),
          type: "text",
          placeholder: tAdmin("organizations.create.descriptionPlaceholder"),
        },
      ]}
      createFn={(data) =>
        adminCreateOrganization(data.name as string, data.description as string)
      }
    />
  );
}
