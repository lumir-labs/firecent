"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";
import { DEFAULT_LOGIN_REDIRECT } from "@/routes";
import { authClient } from "@/lib/auth-client";
import { Link } from "@/i18n/navigation";
import { useMagicLinkCooldown } from "@/hooks/use-magic-link-cooldown";
import {
  formatMagicLinkWait,
  getMagicLinkNextWait,
  getMagicLinkRetryAfter,
} from "@app/lib/magic-link";

export function ResetForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const t = useTranslations("Auth");
  const tNav = useTranslations("Nav");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || DEFAULT_LOGIN_REDIRECT;

  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cooldown = useMagicLinkCooldown((saved) => {
    setEmail(saved.email);
    setIsSent(saved.sent);
  });

  const requestMagicLink = async () => {
    const target = email.trim();
    setIsSending(true);
    setErrorMessage(null);

    const { data, error } = await authClient.signIn.magicLink({
      email: target,
      callbackURL: callbackUrl,
    });

    setIsSending(false);

    const retryAfter = getMagicLinkRetryAfter(error);
    if (retryAfter !== null) {
      cooldown.start(target, retryAfter, isSent);
      setErrorMessage(t("magicLinkCooldown"));
      return;
    }
    if (error) {
      setErrorMessage(error.message ?? t("magicLinkError"));
      return;
    }

    const nextWait = getMagicLinkNextWait(data);
    if (nextWait !== null) cooldown.start(target, nextWait, true);
    setIsSent(true);
  };

  const sendMagicLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void requestMagicLink();
  };

  const secondsLeft = cooldown.secondsFor(email);
  const timeLeft = formatMagicLinkWait(secondsLeft);

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={sendMagicLink}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {t("loginDescription")}
          </p>
        </div>
        {isSent ? (
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              {t("magicLinkSent", { email })}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={isSending || secondsLeft > 0}
              onClick={() => void requestMagicLink()}
            >
              {isSending
                ? t("magicLinkSending")
                : secondsLeft > 0
                  ? t("magicLinkResendIn", { time: timeLeft })
                  : t("magicLinkResend")}
            </Button>
            {errorMessage ? (
              <p className="text-center text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
            <FieldDescription className="text-center">
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => {
                  setIsSent(false);
                  setErrorMessage(null);
                }}
              >
                {t("useAnotherEmail")}
              </button>
            </FieldDescription>
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSending}
              />
              {errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : null}
            </Field>
            <Field>
              <Button
                type="submit"
                disabled={isSending || email.trim() === "" || secondsLeft > 0}
              >
                {isSending
                  ? t("magicLinkSending")
                  : secondsLeft > 0
                    ? t("magicLinkRetryIn", { time: timeLeft })
                    : t("loginButton")}
              </Button>
            </Field>
          </>
        )}
        <Field>
          <FieldDescription className="text-center">
            {t("magicLinkHint")}
          </FieldDescription>
          <FieldDescription className="text-center">
            <Link href="/auth/login" className="underline underline-offset-4">
              {tNav("back")}
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
