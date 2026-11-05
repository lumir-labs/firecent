"use client";

import BaseCreate from "@/components/base/base-create";
import { useTranslations } from "next-intl";
import { createWaitlistEntry } from "@/lib/actions/waitlist";

export default function CreateWaitlistEntry() {
  const tAdmin = useTranslations("Admin");
  return (
    <BaseCreate
      dialogTitle={tAdmin("waitlist.create.title")}
      dialogDescription={tAdmin("waitlist.create.description")}
      successMessage={tAdmin("waitlist.create.success")}
      fieldConfig={[
        {
          name: "email",
          label: tAdmin("waitlist.create.emailLabel"),
          type: "email",
          placeholder: tAdmin("waitlist.create.emailPlaceholder"),
          required: true,
        },
      ]}
      createFn={(data) => createWaitlistEntry(data.email as string)}
    />
  );
}
