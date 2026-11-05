"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnProfile } from "@/lib/actions/profile";

type ProfileFormProps = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  lastName2: string | null;
};

export function ProfileForm({
  firstName,
  middleName,
  lastName,
  lastName2,
}: ProfileFormProps) {
  const tPortal = useTranslations("Portal");
  const tCommon = useTranslations("Common");
  const [form, setForm] = useState({
    firstName: firstName ?? "",
    middleName: middleName ?? "",
    lastName: lastName ?? "",
    lastName2: lastName2 ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await updateOwnProfile({
        firstName: form.firstName || null,
        middleName: form.middleName || null,
        lastName: form.lastName || null,
        lastName2: form.lastName2 || null,
      });
      if ("error" in result && result.error) {
        toast.error(result.error, { richColors: true });
        return;
      }
      toast.success(tPortal("profileUpdated"), { richColors: true });
    } catch {
      toast.error(tCommon("unknownError"), { richColors: true });
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { key: "firstName", label: tPortal("firstName") },
    { key: "middleName", label: tPortal("middleName") },
    { key: "lastName", label: tPortal("lastName") },
    { key: "lastName2", label: tPortal("lastName2") },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label htmlFor={`profile-${key}`}>{label}</Label>
            <Input
              id={`profile-${key}`}
              value={form[key]}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
