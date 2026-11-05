"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, ChevronsUpDown, Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";

export type SwitcherOrg = { id: string; name: string };

/**
 * Active organization switch: `authClient.organization.setActive`
 * (the plugin's endpoint, validates membership server-side) + `router.refresh()`
 * so RSCs re-read `getSessionOrganization()` with the new org.
 */
export function OrgSwitcher({
  orgs,
  activeId,
}: {
  orgs: SwitcherOrg[];
  activeId: string | null;
}) {
  const tNav = useTranslations("Nav");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(activeId ?? undefined);

  if (orgs.length === 0) {
    return (
      <span className="hidden text-xs text-muted-foreground md:inline">
        {tNav("orgSwitcher.empty")}
      </span>
    );
  }
  if (orgs.length === 1) {
    return null;
  }

  async function handleSwitch(next: string) {
    setBusy(true);
    try {
      const { error } = await authClient.organization.setActive({
        organizationId: next,
      });
      if (error) {
        toast.error(error.message || tNav("orgSwitcher.error"), {
          richColors: true,
        });
        setValue(activeId ?? undefined);
        return;
      }
      setValue(next);
      router.refresh();
    } catch {
      toast.error(tNav("orgSwitcher.error"), { richColors: true });
      setValue(activeId ?? undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border bg-card px-2 py-1">
      <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
      <select
        aria-label={tNav("orgSwitcher.label")}
        value={value}
        disabled={busy}
        onChange={(e) => handleSwitch(e.target.value)}
        className="max-w-36 truncate bg-transparent text-xs font-medium outline-none sm:max-w-44"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {busy ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : (
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}
