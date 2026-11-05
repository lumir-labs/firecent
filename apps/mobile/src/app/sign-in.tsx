import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import Constants from "expo-constants";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { router } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n-provider";
import { useThemePreference } from "@/lib/theme-provider";
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import styles from "./sign-in.styles";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/ui/icon";
import { GoogleIcon } from "@/components/common/google-icon";
import {
  Mail,
  MailCheck,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { hasPendingTwoFactorChallenge } from "@/lib/cookies";
import {
  isInvalidTwoFactorCookieError,
  isValidBackupCode,
  isValidTotpCode,
} from "@/lib/two-factor";

// Single source: app.json name. Never hardcode the brand here.
const APP_NAME = Constants.expoConfig?.name ?? "Stackgoat";

const LOGO_LIGHT = require("../../assets/images/logo-mark.png");
const LOGO_DARK = require("../../assets/images/logo-mark-dark.png");

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export default function SignIn() {
  const { t } = useI18n();
  const { resolved } = useThemePreference();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2FA TOTP step (mirror of the web `login-form.tsx`): after the
  // magic-link is verified, the backend creates NO session when the user
  // has 2FA enabled — only a `two_factor` challenge (10 min). The code
  // below completes the login with `verifyTotp`/`verifyBackupCode`.
  const [needs2FA, setNeeds2FA] = useState(false);
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [challengeExpired, setChallengeExpired] = useState(false);

  // Remounts (returning from the authenticator app, process death, or the
  // root layout dropping the Stack while a foreground refetch resolves)
  // must not silently reset to the email form: the challenge cookie
  // survives in SecureStore (10-min TTL, deleted on successful verify), so
  // restore the TOTP step from it.
  useEffect(() => {
    let cancelled = false;
    authClient
      .getCookie()
      .then((cookie) => {
        if (!cancelled && hasPendingTwoFactorChallenge(cookie)) {
          setNeeds2FA(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onMagicLink() {
    setSending(true);
    setError(null);
    try {
      const { error } = await authClient.signIn.magicLink({
        email: email.trim(),
        // The backend redirects to the native scheme (see trustedOrigins on the web).
        callbackURL: "/(tabs)",
      });
      if (error) {
        setError(error.message ?? t("Auth.magicLinkError"));
      } else {
        setSent(true);
      }
    } catch (e) {
      console.error("Magic link error", e);
      setError(t("Auth.magicLinkError"));
    } finally {
      setSending(false);
    }
  }

  async function onVerify2FA() {
    const trimmed = code.trim();
    const valid = useBackupCode
      ? isValidBackupCode(trimmed)
      : isValidTotpCode(trimmed);
    if (!valid) {
      setError(t("Auth.twoFactor.invalidCode"));
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const { error } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: trimmed })
        : await authClient.twoFactor.verifyTotp({ code: trimmed });
      if (error) {
        if (isInvalidTwoFactorCookieError(error)) {
          setChallengeExpired(true);
          return;
        }
        setError(error.message ?? t("Auth.twoFactor.invalidCode"));
        return;
      }
      router.replace("/(tabs)");
    } catch (e) {
      console.error("2FA verify error", e);
      setError(t("Auth.twoFactor.invalidCode"));
    } finally {
      setVerifying(false);
    }
  }

  function backToEmail() {
    setNeeds2FA(false);
    setChallengeExpired(false);
    setCode("");
    setUseBackupCode(false);
    setError(null);
  }

  async function onGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response) && response.data.idToken) {
        const { data, error } = await authClient.signIn.social({
          provider: "google",
          idToken: { token: response.data.idToken },
        });
        if (error) {
          setError(error.message ?? t("Auth.magicLinkError"));
        } else if (
          (data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect
        ) {
          // 2FA enabled: no session was created, only a 10-min challenge
          // (backend `signInTwoFactorHook`). Same TOTP step as the
          // magic-link flow.
          setNeeds2FA(true);
        } else {
          router.replace("/(tabs)");
        }
      } else {
        setError(t("Auth.magicLinkError"));
      }
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled: not an error
      } else if (code === statusCodes.IN_PROGRESS) {
        setError(t("Auth.magicLinkError"));
      } else if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError(t("Auth.magicLinkError"));
      } else {
        // Typical: DEVELOPER_ERROR = missing Android OAuth client (SHA-1) in Google Cloud
        console.error("Google error", e);
        setError(
          `Google error (${code ?? "unknown"}). Check the SHA-1 in Google Cloud.`,
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  function resetEmailForm() {
    setSent(false);
    setEmail("");
    setError(null);
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand */}
            <View style={styles.hero}>
              <Image
                source={resolved === "dark" ? LOGO_DARK : LOGO_LIGHT}
                style={styles.logo}
                accessibilityLabel={APP_NAME}
              />
              <Text className="text-3xl font-inter-bold text-foreground">
                {APP_NAME}
              </Text>
              <Text className="text-center font-sans text-base text-muted-foreground">
                {t("Auth.loginDescription")}
              </Text>
            </View>

            {/* Auth card */}
            <View className="w-full">
              {challengeExpired ? (
                <View style={styles.sentBlock}>
                  <Text className="text-center font-sans text-base text-muted-foreground">
                    {t("Auth.twoFactor.expiredChallenge")}
                  </Text>
                  <Button variant="outline" onPress={backToEmail}>
                    <Text>{t("Auth.twoFactor.backToEmail")}</Text>
                  </Button>
                </View>
              ) : needs2FA ? (
                <View className="w-full gap-3">
                  <View style={styles.hero}>
                    <View className="rounded-full bg-primary/10 p-3">
                      <Icon icon={ShieldCheck} size={24} />
                    </View>
                    <Text className="text-center font-inter-bold text-xl text-foreground">
                      {t("Auth.twoFactor.stepTitle")}
                    </Text>
                    <Text className="text-center font-sans text-sm text-muted-foreground">
                      {t("Auth.twoFactor.stepDescription")}
                    </Text>
                  </View>
                  <Input
                    style={styles.input}
                    className="border-border bg-background text-foreground"
                    placeholder={
                      useBackupCode
                        ? t("Auth.twoFactor.backupCodeLabel")
                        : t("Auth.twoFactor.codeLabel")
                    }
                    placeholderTextColorClassName="accent-muted-foreground"
                    keyboardType={useBackupCode ? "default" : "number-pad"}
                    autoCapitalize="none"
                    autoComplete="one-time-code"
                    returnKeyType="send"
                    onSubmitEditing={onVerify2FA}
                    value={code}
                    onChangeText={setCode}
                    editable={!verifying}
                  />
                  <Button
                    onPress={onVerify2FA}
                    disabled={verifying || code.trim() === ""}
                    className="w-full"
                  >
                    {verifying ? (
                      <ActivityIndicator
                        size="small"
                        colorClassName="accent-primary-foreground"
                      />
                    ) : (
                      <Text>{t("Auth.twoFactor.verifyButton")}</Text>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onPress={() => {
                      setUseBackupCode((v) => !v);
                      setCode("");
                      setError(null);
                    }}
                    className="w-full"
                  >
                    <Text>
                      {useBackupCode
                        ? t("Auth.twoFactor.useTotpInstead")
                        : t("Auth.twoFactor.useBackupCode")}
                    </Text>
                  </Button>
                  <Button variant="outline" onPress={backToEmail}>
                    <Text>{t("Auth.twoFactor.backToEmail")}</Text>
                  </Button>
                </View>
              ) : sent ? (
                <View style={styles.sentBlock}>
                  <View className="rounded-full bg-primary/10 p-3">
                    <Icon icon={MailCheck} size={24} />
                  </View>
                  <Text className="text-center font-sans text-base text-foreground">
                    {t("Auth.magicLinkSent", { email })}
                  </Text>
                  <Button
                    variant="outline"
                    onPress={() => setNeeds2FA(true)}
                    accessibilityRole="button"
                  >
                    <Text>{t("Auth.twoFactor.stepTitle")}</Text>
                  </Button>
                  <Button
                    variant="outline"
                    onPress={resetEmailForm}
                    accessibilityRole="button"
                  >
                    <Text>{t("Auth.useAnotherEmail")}</Text>
                  </Button>
                </View>
              ) : (
                <>
                  <Input
                    style={styles.input}
                    className="border-border bg-background text-foreground mb-3"
                    placeholder={t("Auth.email")}
                    placeholderTextColorClassName="accent-muted-foreground"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="send"
                    onSubmitEditing={onMagicLink}
                    value={email}
                    onChangeText={setEmail}
                    editable={!sending}
                  />
                  <Button
                    onPress={onMagicLink}
                    disabled={sending || email.trim() === ""}
                    className="w-full"
                  >
                    {sending ? (
                      <ActivityIndicator
                        size="small"
                        colorClassName="accent-primary-foreground"
                      />
                    ) : (
                      <>
                        <Icon icon={Mail} size={20} />
                        <Text>{t("Auth.loginButton")}</Text>
                      </>
                    )}
                  </Button>
                  <View className="flex-row items-center gap-2 my-3">
                    <Separator />
                    <Text
                      style={styles.separator}
                      className="text-muted-foreground"
                    >
                      {t("Auth.orContinueWith")}
                    </Text>
                    <Separator />
                  </View>
                </>
              )}
              {!needs2FA && !challengeExpired ? (
                <Button
                  variant={"outline"}
                  onPress={onGoogle}
                  disabled={googleLoading}
                  className="w-full"
                >
                  {googleLoading ? (
                    <ActivityIndicator
                      size="small"
                      colorClassName="accent-foreground"
                    />
                  ) : (
                    <>
                      <GoogleIcon size={20} />
                      <Text>{t("Auth.loginWithGoogle")}</Text>
                    </>
                  )}
                </Button>
              ) : null}
              {error && (
                <View
                  className="mt-3 flex-row items-center gap-2 rounded-xl border border-destructive/50 px-3 py-2.5"
                  accessibilityRole="alert"
                >
                  <Icon icon={TriangleAlert} size={18} />
                  <Text className="flex-1 font-sans text-sm text-destructive">
                    {error}
                  </Text>
                </View>
              )}
            </View>

            {/* Legal */}
            <Text style={styles.legal} className="text-muted-foreground">
              {t("Auth.magicLinkHint")}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
