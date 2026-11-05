"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CopyButton from "@/components/common/copy-button";
import { authClient } from "@/lib/auth-client";
import { QRCodeSVG } from "qrcode.react";

type EnableResult = {
  totpURI?: string;
  backupCodes?: string[];
};

/**
 * 2FA (TOTP) management from the profile.
 * Enable → the plugin returns `totpURI` + `backupCodes` ONCE → the
 * user scans it with their authenticator (copy/paste the otpauth) and
 * verifies the code to confirm. Backup codes are shown only once.
 * Disable requires a fresh TOTP (or backup) code first — no one-click
 * disable from an open session (v1.1 hardening; passwordless app, so
 * there is no password to ask for instead).
 */
export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const tPortal = useTranslations("Portal");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<EnableResult | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await authClient.twoFactor.enable({
        method: "totp",
      });
      if (error || !data) {
        setError(error?.message ?? tCommon("unknownError"));
        return;
      }
      const totp = data as { method: string; totpURI?: string; backupCodes?: string[] };
      if (!totp.totpURI) {
        setError(tCommon("unknownError"));
        return;
      }
      setPending({
        totpURI: totp.totpURI,
        backupCodes: totp.backupCodes ?? [],
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: code.trim(),
      });
      if (error) {
        setError(error.message ?? tCommon("unknownError"));
        return;
      }
      setPending(null);
      setCode("");
      toast.success(tPortal("twoFactor.enabledOk"), { richColors: true });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleDisable() {
    // First click only arms the confirmation: the fresh code is asked
    // in the UI below (no one-click disable from an open session).
    setConfirmingDisable(true);
    setCode("");
    setError(null);
  }

  function handleCancelDisable() {
    setConfirmingDisable(false);
    setCode("");
    setError(null);
  }

  async function handleConfirmDisable() {
    const trimmed = code.trim();
    if (trimmed === "") return;
    setBusy(true);
    setError(null);
    try {
      // Re-auth: prove possession of the authenticator (or a backup
      // code) before tearing 2FA down. TOTP first; backup codes are
      // accepted as fallback for users who lost the device.
      const totp = await authClient.twoFactor.verifyTotp({ code: trimmed });
      if (totp.error) {
        const backup = await authClient.twoFactor.verifyBackupCode({
          code: trimmed,
        });
        if (backup.error) {
          setError(
            totp.error.message ?? backup.error.message ?? tCommon("unknownError"),
          );
          return;
        }
      }
      const { error } = await authClient.twoFactor.disable({
        // Passwordless: there is no password to require; the body is empty but
        // the typed endpoint expects the object.
        password: undefined,
      });
      if (error) {
        setError(error.message ?? tCommon("unknownError"));
        return;
      }
      setConfirmingDisable(false);
      setCode("");
      toast.success(tPortal("twoFactor.disabledOk"), { richColors: true });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          {tPortal("twoFactor.title")}
          <Badge variant={enabled ? "secondary" : "outline"}>
            {enabled
              ? tPortal("twoFactor.statusOn")
              : tPortal("twoFactor.statusOff")}
          </Badge>
        </CardTitle>
        <CardDescription>{tPortal("twoFactor.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pending ? (
          <div className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-col items-center gap-1.5">
              <Label>{tPortal("twoFactor.uriLabel")}</Label>
              {/* QR rendered 100% client-side: the TOTP secret must never
                  leave the browser (no third-party QR APIs). */}
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={pending.totpURI ?? ""} size={192} />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {tPortal("twoFactor.uriHint")}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tPortal("twoFactor.manualLabel")}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">
                  {pending.totpURI}
                </code>
                <CopyButton text={pending.totpURI ?? ""} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{tPortal("twoFactor.backupLabel")}</Label>
              <div className="flex flex-col gap-1.5">
                {(pending.backupCodes ?? []).map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">
                      {c}
                    </code>
                    <CopyButton text={c} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {tPortal("twoFactor.backupHint")}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="twofa-verify">
                {tPortal("twoFactor.verifyLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="twofa-verify"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={busy}
                />
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={busy || code.trim() === ""}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {tCommon("save")}
                </Button>
              </div>
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>
        ) : enabled ? (
          confirmingDisable ? (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
              <Label htmlFor="twofa-disable">
                {tPortal("twoFactor.verifyLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="twofa-disable"
                  inputMode="text"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={busy}
                />
                <Button
                  type="button"
                  onClick={handleConfirmDisable}
                  disabled={busy || code.trim() === ""}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldOff className="size-4" />
                  )}
                  {tPortal("twoFactor.disable")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelDisable}
                  disabled={busy}
                >
                  {tCommon("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleDisable}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldOff className="size-4" />
              )}
              {tPortal("twoFactor.disable")}
            </Button>
          )
        ) : (
          <Button type="button" onClick={handleEnable} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {tPortal("twoFactor.enable")}
          </Button>
        )}
        {error && !pending ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
