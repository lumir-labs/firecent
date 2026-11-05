import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTheme } from "expo-router";
import { Bell, User } from "lucide-react-native";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n-provider";
import { dayGreetingKey } from "@app/lib/messages";

export default function Header() {
  const { data: session } = authClient.useSession();
  const { t } = useI18n();
  // useTheme reads the root ThemeProvider: this way the icons (which need a
  // string color, no className allowed) follow the system theme.
  const { colors } = useTheme();
  const user = session?.user;

  return (
    <View className="w-full flex-row items-center justify-between">
      {/* Avatar + greeting */}
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
          {user?.image ? (
            <Image source={{ uri: user.image }} className="h-full w-full" />
          ) : (
            <User size={24} color={colors.text} />
          )}
        </View>
        <View>
          <Text className="font-sans text-sm text-muted-foreground">
            {t(dayGreetingKey())}
          </Text>
          <Text className="font-sans text-lg font-inter-bold text-foreground">
            {user?.name ?? t("Home.guest")}
          </Text>
        </View>
      </View>

      {/* Notifications */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        className="h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
      >
        <Bell size={22} color={colors.text} />
        <View className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />
      </Pressable>
    </View>
  );
}
