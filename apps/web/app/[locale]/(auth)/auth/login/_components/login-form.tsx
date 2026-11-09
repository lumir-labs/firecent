"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  RefreshCw,
  KeyRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { DEFAULT_LOGIN_REDIRECT } from "@/routes";
import { authClient } from "@/lib/auth-client";
import { Link } from "@/i18n/navigation";
import { useMagicLinkCooldown } from "@/hooks/use-magic-link-cooldown";
import {
  formatMagicLinkWait,
  getMagicLinkNextWait,
  getMagicLinkRetryAfter,
} from "@app/lib/magic-link";

function GoogleColorIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

const STORAGE_KEY_EMAIL = "firecent_remembered_email";
const STORAGE_KEY_REMEMBER = "firecent_remember_me";

export function LoginForm({
  pendingTwoFactor = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { pendingTwoFactor?: boolean }) {
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || DEFAULT_LOGIN_REDIRECT;

  const needsTwoFactor =
    callbackUrl.includes("twoFactorRedirect=true") || pendingTwoFactor;

  const [email, setEmail] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [code, setCode] = React.useState("");
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  const [challengeExpired, setChallengeExpired] = React.useState(false);
  const [backToEmail, setBackToEmail] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  // Magic-link backoff: survives refresh, bringing back the email and the
  // "sent" screen while it runs (the server would reject a new link anyway).
  const cooldown = useMagicLinkCooldown((saved) => {
    setEmail(saved.email);
    setIsSent(saved.sent);
  });

  // Restore remembered email on mount
  React.useEffect(() => {
    try {
      const storedRemember = localStorage.getItem(STORAGE_KEY_REMEMBER);
      if (storedRemember !== null) {
        setRememberMe(storedRemember === "true");
      }
      const savedEmail = localStorage.getItem(STORAGE_KEY_EMAIL);
      if (savedEmail) {
        setEmail(savedEmail);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const persistRememberMe = (currentEmail: string) => {
    try {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY_REMEMBER, "true");
        if (currentEmail) {
          localStorage.setItem(STORAGE_KEY_EMAIL, currentEmail.trim());
        }
      } else {
        localStorage.setItem(STORAGE_KEY_REMEMBER, "false");
        localStorage.removeItem(STORAGE_KEY_EMAIL);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const showTwoFactorStep = needsTwoFactor && !backToEmail;

  const signInGoogle = async () => {
    persistRememberMe(email);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackUrl,
    });
  };

  const requestMagicLink = async () => {
    const target = email.trim();
    if (!target) return;

    setIsSending(true);
    setErrorMessage(null);
    persistRememberMe(target);

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

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      const cleanUrl = callbackUrl.replace(/[?&]twoFactorRedirect=true/, "");
      const target =
        cleanUrl && cleanUrl !== "" ? cleanUrl : DEFAULT_LOGIN_REDIRECT;
      const { error } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
        : await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (error) {
        if (error.code === "INVALID_TWO_FACTOR_COOKIE") {
          setChallengeExpired(true);
          return;
        }
        setErrorMessage(error.message ?? t("twoFactor.invalidCode"));
        return;
      }
      router.replace(target);
      router.refresh();
    } finally {
      setIsVerifying(false);
    }
  }

  // 2FA Expired challenge view
  if (showTwoFactorStep && challengeExpired) {
    return (
      <div className={cn("flex flex-col gap-4 text-center", className)}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("twoFactor.expiredChallenge")}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setBackToEmail(true);
            setChallengeExpired(false);
            setCode("");
            setErrorMessage(null);
          }}
          className="w-full"
        >
          {t("twoFactor.backToEmail")}
        </Button>
      </div>
    );
  }

  // 2FA TOTP / Backup verification step
  if (showTwoFactorStep) {
    return (
      <form
        className={cn("flex flex-col gap-6 w-full", className)}
        onSubmit={verifyCode}
      >
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("twoFactor.stepTitle")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs">
            {t("twoFactor.stepDescription")}
          </p>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="totp-code">
              {useBackupCode
                ? t("twoFactor.backupCodeLabel")
                : t("twoFactor.codeLabel")}
            </FieldLabel>
            <Input
              id="totp-code"
              inputMode={useBackupCode ? "text" : "numeric"}
              autoComplete="one-time-code"
              placeholder={useBackupCode ? "xxxx-xxxx" : "123456"}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isVerifying}
              className="text-center font-mono tracking-widest text-base"
            />
            {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
          </Field>

          <Button
            type="submit"
            variant="gradient"
            disabled={isVerifying || code.trim() === ""}
            className="w-full font-semibold shadow-sm hover:shadow-md transition-all"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>{t("twoFactor.verifying")}</span>
              </>
            ) : (
              <span>{t("twoFactor.verifyButton")}</span>
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              onClick={() => {
                setUseBackupCode((v) => !v);
                setCode("");
                setErrorMessage(null);
              }}
            >
              {useBackupCode
                ? t("twoFactor.useTotpInstead")
                : t("twoFactor.useBackupCode")}
            </button>
          </div>
        </FieldGroup>
      </form>
    );
  }

  // Magic Link Sent Success View
  if (isSent) {
    return (
      <div className={cn("flex flex-col items-center text-center space-y-5 w-full", className)}>
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </div>

        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            ¡Revisa tu correo!
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Enviamos un enlace de acceso a{" "}
            <span className="font-semibold text-foreground underline decoration-primary/40 underline-offset-2">
              {email}
            </span>
            . Haz clic en el enlace para entrar de forma segura sin contraseñas.
          </p>
        </div>

        <div className="pt-2 w-full space-y-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSending || secondsLeft > 0}
            onClick={() => void requestMagicLink()}
            className="w-full text-xs font-medium tabular-nums"
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
            )}
            <span>
              {isSending
                ? t("magicLinkSending")
                : secondsLeft > 0
                  ? t("magicLinkResendIn", { time: timeLeft })
                  : t("magicLinkResend")}
            </span>
          </Button>
          {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            onClick={() => {
              setIsSent(false);
              setErrorMessage(null);
            }}
          >
            {t("useAnotherEmail")}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground/80">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span>{t("securityNotice")}</span>
        </div>
      </div>
    );
  }

  // Default Sign In Form (using InputGroup, Field, Checkbox, and Button from shadcn)
  return (
    <div className={cn("flex flex-col gap-6 w-full", className)} {...props}>
      {/* Brand Logo & Header */}
      <div className="flex flex-col items-center text-center space-y-3.5">
        <Link
          href="/"
          className="inline-flex items-center justify-center transition-transform hover:scale-102"
        >
          <Image
            src="/logo.svg"
            alt="Firecent"
            width={160}
            height={42}
            className="dark:hidden h-8 sm:h-9 w-auto"
            priority
          />
          <Image
            src="/logo_d.svg"
            alt="Firecent"
            width={160}
            height={42}
            className="hidden dark:block h-8 sm:h-9 w-auto"
            priority
          />
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-foreground">
            {t("loginTitle")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
            {t("loginDescription")}
          </p>
        </div>
      </div>

      <form onSubmit={sendMagicLink} className="space-y-4">
        {/* Email Field with InputGroup and Mail Addon */}
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Mail className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              type="email"
              placeholder="tu@email.com"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
            />
          </InputGroup>
          {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        </Field>

        {/* Recordarme Checkbox */}
        <div className="flex items-center gap-2 pt-0.5">
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(!!checked)}
          />
          <FieldLabel
            htmlFor="remember-me"
            className="text-xs text-foreground/80 font-medium cursor-pointer select-none"
          >
            {t("rememberMe")}
          </FieldLabel>
        </div>

        {/* Gradient Submit Button */}
        <Button
          variant="gradient"
          type="submit"
          disabled={isSending || email.trim() === "" || secondsLeft > 0}
          className="w-full font-semibold shadow-sm hover:shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-2"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("magicLinkSending")}</span>
            </>
          ) : secondsLeft > 0 ? (
            <span className="tabular-nums">
              {t("magicLinkRetryIn", { time: timeLeft })}
            </span>
          ) : (
            <>
              <span>{t("loginButton")}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* FieldSeparator from ui/field */}
      <FieldSeparator>{t("orContinueWith")}</FieldSeparator>

      {/* Google OAuth Button */}
      <div>
        <Button
          variant="outline"
          type="button"
          onClick={signInGoogle}
          className="w-full flex items-center justify-center gap-2.5 shadow-2xs transition-all"
        >
          <GoogleColorIcon className="size-4 shrink-0" />
          <span>{t("loginWithGoogle")}</span>
        </Button>
      </div>

      {/* Security & Trust Footer */}
      <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground/75">
        <ShieldCheck className="size-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-[11px] sm:text-xs">{t("securityNotice")}</span>
      </div>
    </div>
  );
}
