"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteMember } from "@/lib/actions/invitations";
import {
  INVITE_ROLES,
  type InviteRole,
} from "@/lib/actions/invitation-helpers";

export function InviteForm({ onInvited }: { onInvited: () => void }) {
  const tPortal = useTranslations("Portal");
  const tCommon = useTranslations("Common");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await inviteMember({ email: email.trim(), role });
      if (result.error) {
        toast.error(
          result.duplicateMember
            ? tPortal("invites.duplicateMember")
            : result.error,
          { richColors: true },
        );
        return;
      }
      setEmail("");
      setRole("member");
      toast.success(tPortal("invites.sentOk"), { richColors: true });
      onInvited();
    } catch {
      toast.error(tCommon("unknownError"), { richColors: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="invite-email">{tPortal("invites.emailLabel")}</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={256}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-role">{tPortal("invites.roleLabel")}</Label>
        <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
          <SelectTrigger id="invite-role" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={saving || !email.trim()}>
        {saving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {tPortal("invites.send")}
      </Button>
    </form>
  );
}
