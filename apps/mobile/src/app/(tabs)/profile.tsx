import { useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { useTheme, router } from "expo-router";
import {
  Check,
  ChevronRight,
  Component,
  Contrast,
  Globe,
  LogOut,
  Monitor,
  Moon,
  Pencil,
  Sun,
  type LucideIcon,
} from "lucide-react-native";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/lib/i18n-provider";
import { useThemePreference, type ThemePreference } from "@/lib/theme-provider";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { semanticTokens } from "@app/lib/tokens/semantic";
import { type Locale } from "@app/lib/messages";

type Sheet = "language" | "theme" | "editName" | null;

export default function Profile() {
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme, resolved } = useThemePreference();
  const { colors } = useTheme();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState<{
    firstName?: string;
    middleName?: string;
    lastName?: string;
    lastName2?: string;
  }>({});

  // Own profile via tRPC (`users` router, data shared web↔mobile).
  const profile = trpc.users.getOwn.useQuery();
  const updateOwn = trpc.users.updateOwn.useMutation({
    onSuccess: () => {
      profile.refetch();
      refetchSession();
      setSheet(null);
    },
  });

  const user = session?.user;
  // Row grays (icon + chevron) from the single source of tokens, instead
  // of hardcoding hex per theme as Icon/Button do.
  const muted = semanticTokens[resolved]["muted-foreground"];
  // expo-router's `useTheme` types colors as ColorValue; at runtime they
  // are hex: normalized to string for the lucide icons.
  const primary = String(colors.primary);

  // Language autonym (convention: a language is named in itself).
  const languageValue = locale === "es" ? "Español" : "English";
  const themeValue =
    theme === "light"
      ? t("Common.theme.light")
      : theme === "dark"
        ? t("Common.theme.dark")
        : t("Common.theme.system");
  // Magic-link users are born with name "" (not nullish): use || so the
  // first+last composition also applies with an empty name.
  const displayName =
    profile.data?.name ||
    [profile.data?.firstName, profile.data?.lastName].filter(Boolean).join(" ");

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 130,
          gap: 20,
        }}
      >
        <Text variant="h4" className="text-center">
          {t("Profile.title")}
        </Text>

        {/* User card: photo + name + email. Name editable via
            tRPC `users.updateOwn` (router shared with the web). */}
        <View className="flex-row items-center gap-4 rounded-2xl bg-card p-4">
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-muted">
            {user?.image ? (
              <Image source={{ uri: user.image }} className="h-full w-full" />
            ) : (
              <Text className="text-xl font-inter-bold text-foreground">
                {displayName?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text
              numberOfLines={1}
              className="text-base font-inter-semibold text-foreground"
            >
              {displayName || user?.name || t("Home.guest")}
            </Text>
            <Text numberOfLines={1} variant="muted">
              {user?.email ?? t("Profile.noSession")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              // Reset the draft with current values on OPEN: prevents a
              // previously canceled edit from being sent on the next save.
              setDraft({
                firstName: profile.data?.firstName ?? "",
                middleName: profile.data?.middleName ?? "",
                lastName: profile.data?.lastName ?? "",
                lastName2: profile.data?.lastName2 ?? "",
              });
              setSheet("editName");
            }}
            className="rounded-full bg-muted p-2.5"
          >
            <Icon icon={Pencil} size={16} color={muted} />
          </Pressable>
        </View>

        {/* General section */}
        <View className="gap-2">
          <Text variant="muted" className="px-1">
            {t("Profile.general")}
          </Text>
          <View className="rounded-2xl bg-card">
            <SettingsRow
              icon={Globe}
              iconColor={muted}
              label={t("Profile.language")}
              value={languageValue}
              onPress={() => setSheet("language")}
            />
            <View className="mx-4 h-px bg-border" />
            <SettingsRow
              icon={Contrast}
              iconColor={muted}
              label={t("Profile.theme")}
              value={themeValue}
              onPress={() => setSheet("theme")}
            />
          </View>
        </View>

        {/* Debug section: UI catalog (ui-kit is a documented product
            screen, not an experiment). */}
        <View className="gap-2">
          <Text variant="muted" className="px-1">
            {t("Profile.debug")}
          </Text>
          <View className="rounded-2xl bg-card">
            <SettingsRow
              icon={Component}
              iconColor={muted}
              label={t("Profile.uiKit")}
              value=""
              onPress={() => router.push("/ui-kit")}
            />
          </View>
        </View>

        <Button
          variant="destructive"
          className="w-full"
          onPress={() => authClient.signOut()}
        >
          <Icon icon={LogOut} />
          <Text>{t("Profile.signOut")}</Text>
        </Button>
      </ScrollView>

      {/* Language sheet */}
      <Drawer
        open={sheet === "language"}
        onOpenChange={(o) => {
          if (!o) setSheet(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {t("Profile.language")}
            </DrawerTitle>
          </DrawerHeader>
          {(["es", "en"] as Locale[]).map((l) => (
            <OptionRow
              key={l}
              label={l === "es" ? "Español" : "English"}
              selected={locale === l}
              checkColor={primary}
              onPress={() => {
                setLocale(l);
                setSheet(null);
              }}
            />
          ))}
        </DrawerContent>
      </Drawer>

      {/* Theme sheet */}
      <Drawer
        open={sheet === "theme"}
        onOpenChange={(o) => {
          if (!o) setSheet(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {t("Profile.theme")}
            </DrawerTitle>
          </DrawerHeader>
          {(
            [
              { value: "light", label: t("Common.theme.light"), icon: Sun },
              { value: "dark", label: t("Common.theme.dark"), icon: Moon },
              {
                value: "system",
                label: t("Common.theme.system"),
                icon: Monitor,
              },
            ] as { value: ThemePreference; label: string; icon: LucideIcon }[]
          ).map((opt) => (
            <OptionRow
              key={opt.value}
              label={opt.label}
              icon={opt.icon}
              iconColor={muted}
              selected={theme === opt.value}
              checkColor={primary}
              onPress={() => {
                setTheme(opt.value);
                setSheet(null);
              }}
            />
          ))}
        </DrawerContent>
      </Drawer>
      {/* Name edit sheet: tRPC users.updateOwn (strict server-side
          whitelist — email/roles impossible from here). */}
      <Drawer
        open={sheet === "editName"}
        onOpenChange={(o) => {
          if (!o) setSheet(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">
              {t("Profile.editName")}
            </DrawerTitle>
          </DrawerHeader>
          <View className="gap-3 px-4 pb-6">
            <EditField
              label={t("Profile.firstName")}
              value={profile.data?.firstName ?? ""}
              onChangeText={(v) =>
                setDraft((d) => ({ ...d, firstName: v }))
              }
            />
            <EditField
              label={t("Profile.middleName")}
              value={profile.data?.middleName ?? ""}
              onChangeText={(v) =>
                setDraft((d) => ({ ...d, middleName: v }))
              }
            />
            <EditField
              label={t("Profile.lastName")}
              value={profile.data?.lastName ?? ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, lastName: v }))}
            />
            <EditField
              label={t("Profile.lastName2")}
              value={profile.data?.lastName2 ?? ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, lastName2: v }))}
            />
            {updateOwn.isError ? (
              <Text variant="muted" className="text-center">
                {t("Common.error")}
              </Text>
            ) : null}
            <Button
              variant="default"
              className="w-full"
              disabled={updateOwn.isPending}
              onPress={() =>
                updateOwn.mutate({
                  firstName: draft.firstName || undefined,
                  middleName: draft.middleName || undefined,
                  lastName: draft.lastName || undefined,
                  lastName2: draft.lastName2 || undefined,
                })
              }
            >
              <Text>
                {updateOwn.isPending
                  ? t("Profile.saving")
                  : t("Profile.save")}
              </Text>
            </Button>
          </View>
        </DrawerContent>
      </Drawer>
    </SafeAreaView>
  );
}

function EditField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View className="gap-1">
      <Text variant="muted">{label}</Text>
      <Input value={value} onChangeText={onChangeText} />
    </View>
  );
}

function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
}: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
    >
      <Icon icon={icon} size={20} color={iconColor} />
      <Text className="flex-1 text-[15px] font-inter-medium text-foreground">
        {label}
      </Text>
      <Text numberOfLines={1} variant="muted">
        {value}
      </Text>
      <ChevronRight size={18} color={iconColor} />
    </Pressable>
  );
}

function OptionRow({
  label,
  icon,
  iconColor,
  selected,
  checkColor,
  onPress,
}: {
  label: string;
  icon?: LucideIcon;
  iconColor?: string;
  selected: boolean;
  checkColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-2xl px-4 py-3.5 active:opacity-70 ${
        selected ? "bg-muted" : ""
      }`}
    >
      {icon && <Icon icon={icon} size={18} color={iconColor} />}
      <Text className="flex-1 text-[15px] font-inter-medium text-foreground">
        {label}
      </Text>
      {selected ? (
        <Check size={20} color={checkColor} />
      ) : (
        <View className="w-5" />
      )}
    </Pressable>
  );
}
