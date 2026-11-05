"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, KeyRound, Loader2, Plus, RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CopyButton from "@/components/common/copy-button";
import {
  createOrgApiKey,
  revokeOrgApiKey,
  rotateOrgApiKey,
  type OrgApiKey,
} from "@/lib/actions/api-keys";
import { MCP_ORG_READ, MCP_MEMBERS_READ } from "@app/api/constants";

type ApiKeysTableProps = {
  data: OrgApiKey[];
  canCreate: boolean;
  canManage: boolean;
};

type ConfirmState = {
  mode: "revoke" | "rotate";
  key: OrgApiKey;
} | null;

function keyStatus(key: OrgApiKey): "revoked" | "expired" | "active" {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function ApiKeysTable({ data, canCreate, canManage }: ApiKeysTableProps) {
  const tPortal = useTranslations("Portal");
  const tCommon = useTranslations("Common");
  const [keys, setKeys] = useState<OrgApiKey[]>(data);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [expires, setExpires] = useState("");
  const [scopes, setScopes] = useState<string[]>([
    MCP_ORG_READ,
    MCP_MEMBERS_READ,
  ]);
  const [saving, setSaving] = useState(false);
  // Newly created secret: it lives only in this state. Closing the dialog
  // discards it and there is no way to see it again (show once, §5.4).
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string>("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createOrgApiKey({
        name: name.trim(),
        expiresAt: expires ? new Date(expires).toISOString() : null,
        scopes,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? tCommon("unknownError"), {
          richColors: true,
        });
        return;
      }
      setKeys((prev) => [result.data!.key, ...prev]);
      setCreatedSecret(result.data.secret);
      setCreatedName(result.data.key.name);
      setCreateOpen(false);
      setName("");
      setExpires("");
      setScopes([MCP_ORG_READ, MCP_MEMBERS_READ]);
      toast.success(tPortal("apiKeys.createdOk"), { richColors: true });
    } catch {
      toast.error(tCommon("unknownError"), { richColors: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    const target = confirm.key;
    setBusyId(target.id);
    try {
      if (confirm.mode === "revoke") {
        const result = await revokeOrgApiKey(target.id);
        if (result.error) {
          toast.error(result.error, { richColors: true });
          return;
        }
        setKeys((prev) =>
          prev.map((key) =>
            key.id === target.id ? { ...key, revokedAt: new Date() } : key,
          ),
        );
        toast.success(tPortal("apiKeys.revokedOk"), { richColors: true });
      } else {
        const result = await rotateOrgApiKey(target.id);
        if (result.error || !result.data) {
          toast.error(result.error ?? tCommon("unknownError"), {
            richColors: true,
          });
          return;
        }
        setKeys((prev) => [
          result.data!.key,
          ...prev.map((key) =>
            key.id === target.id ? { ...key, revokedAt: new Date() } : key,
          ),
        ]);
        setCreatedSecret(result.data.secret);
        setCreatedName(result.data.key.name);
        toast.success(tPortal("apiKeys.rotatedOk"), { richColors: true });
      }
      setConfirm(null);
    } catch {
      toast.error(tCommon("unknownError"), { richColors: true });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canCreate ? (
        <div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {tPortal("apiKeys.create")}
          </Button>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tPortal("apiKeys.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tPortal("apiKeys.colName")}</TableHead>
                <TableHead>{tPortal("apiKeys.colPrefix")}</TableHead>
                <TableHead>{tPortal("apiKeys.colExpires")}</TableHead>
                <TableHead>{tPortal("apiKeys.colLastUsed")}</TableHead>
                <TableHead>{tPortal("apiKeys.colStatus")}</TableHead>
                {canManage ? (
                  <TableHead className="text-right">
                    {tPortal("apiKeys.colActions")}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => {
                const status = keyStatus(key);
                const busy = busyId === key.id;
                return (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">
                      {key.name}
                      {key.scopes.length === 0 && status === "active" ? (
                        <span className="mt-1 block text-xs text-destructive">
                          {tPortal("apiKeys.noScopes")}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {key.prefix}
                        </code>
                        <CopyButton text={key.prefix} />
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {key.expiresAt ? (
                        formatDate(key.expiresAt)
                      ) : (
                        <span className="text-xs">
                          {tPortal("apiKeys.noExpiration")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(key.lastUsedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          status === "active" ? "secondary" : "destructive"
                        }
                      >
                        {status === "active"
                          ? tPortal("apiKeys.statusActive")
                          : status === "revoked"
                            ? tPortal("apiKeys.statusRevoked")
                            : tPortal("apiKeys.statusExpired")}
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <span className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || status !== "active"}
                            onClick={() =>
                              setConfirm({ mode: "rotate", key })
                            }
                            title={tPortal("apiKeys.rotate")}
                          >
                            {busy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || status === "revoked"}
                            onClick={() =>
                              setConfirm({ mode: "revoke", key })
                            }
                            title={tPortal("apiKeys.revoke")}
                          >
                            {busy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Ban className="size-3.5 text-destructive" />
                            )}
                          </Button>
                        </span>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create key dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              {tPortal("apiKeys.create")}
            </DialogTitle>
            <DialogDescription>{tPortal("apiKeys.desc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apikey-name">{tPortal("apiKeys.name")}</Label>
              <Input
                id="apikey-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tPortal("apiKeys.namePlaceholder")}
                required
                maxLength={100}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apikey-expires">
                {tPortal("apiKeys.expiresAt")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({tPortal("apiKeys.expiresOptional")})
                </span>
              </Label>
              <Input
                id="apikey-expires"
                type="datetime-local"
                value={expires}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tPortal("apiKeys.scopesLabel")}</Label>
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={scopes.includes(MCP_ORG_READ)}
                    onCheckedChange={(checked) => {
                      setScopes((prev) =>
                        checked
                          ? Array.from(new Set([...prev, MCP_ORG_READ]))
                          : prev.filter((s) => s !== MCP_ORG_READ),
                      );
                    }}
                  />
                  {tPortal("apiKeys.scopeOrgRead")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={scopes.includes(MCP_MEMBERS_READ)}
                    onCheckedChange={(checked) => {
                      setScopes((prev) =>
                        checked
                          ? Array.from(new Set([...prev, MCP_MEMBERS_READ]))
                          : prev.filter((s) => s !== MCP_MEMBERS_READ),
                      );
                    }}
                  />
                  {tPortal("apiKeys.scopeMembersRead")}
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {tPortal("apiKeys.scopeHint")}
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {saving
                  ? tPortal("apiKeys.creating")
                  : tPortal("apiKeys.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Secret: shown only ONCE; closing discards it from state */}
      <Dialog
        open={createdSecret !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedSecret(null);
            setCreatedName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tPortal("apiKeys.createdTitle")}</DialogTitle>
            <DialogDescription>
              {tPortal("apiKeys.createdDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
            <code className="flex-1 break-all font-mono text-xs">
              {createdSecret}
            </code>
            {createdSecret ? <CopyButton text={createdSecret} /> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {createdName} · {tPortal("apiKeys.createdDesc")}
          </p>
        </DialogContent>
      </Dialog>

      {/* Confirmar revocar / rotar */}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.mode === "rotate"
                ? tPortal("apiKeys.rotate")
                : tPortal("apiKeys.revokeConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tPortal("apiKeys.revokeConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {tPortal("apiKeys.cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={busyId !== null}
            >
              {busyId !== null ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {confirm?.mode === "rotate"
                ? tPortal("apiKeys.rotate")
                : tPortal("apiKeys.revokeConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
