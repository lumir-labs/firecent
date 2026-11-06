import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { router } from "expo-router";
import { ChevronRight, Component, UserRound } from "lucide-react-native";
import Header from "@/components/home/header";
import { WeeklyChart } from "@/components/home/weekly-chart";
import { useI18n } from "@/lib/i18n-provider";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { useThemeColors } from "@/lib/theme-colors";

/**
 * Home: greeting header + own account card + weekly chart + shortcuts.
 * No debug widgets: the old API-status/language-switcher row lived here and
 * moved to where it belongs (language lives in Profile, API health is
 * exercised by `bun test` and the `trpc.*.useQuery` calls below).
 */
export default function Home() {
  const { data: session } = authClient.useSession();
  const { t } = useI18n();
  const muted = useThemeColors()["muted-foreground"];
  const profile = trpc.users.getOwn.useQuery();

  const displayName =
    profile.data?.name ||
    [profile.data?.firstName, profile.data?.lastName]
      .filter(Boolean)
      .join(" ") ||
    session?.user?.name ||
    t("Home.guest");
  const email = profile.data?.email ?? session?.user?.email ?? "";

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1"
        style={{ backgroundColor: "transparent" }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 130,
            gap: 16,
          }}
        >
          <Header />

          {/* Account: own data, tap goes to Profile */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/profile")}
            className="flex-row items-center gap-4 rounded-2xl bg-card p-4 active:opacity-70"
          >
            <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
              <Text className="text-lg font-inter-bold text-foreground">
                {displayName.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                numberOfLines={1}
                className="text-base font-inter-semibold text-foreground"
              >
                {displayName}
              </Text>
              <Text numberOfLines={1} variant="muted">
                {email}
              </Text>
            </View>
            <ChevronRight size={18} color={muted} />
          </Pressable>

          <WeeklyChart />

          {/* Shortcuts */}
          <Text variant="muted" className="px-1">
            {t("Home.quickActions")}
          </Text>
          <View className="rounded-2xl bg-card">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/profile")}
              className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
            >
              <Icon icon={UserRound} size={20} color={muted} />
              <Text className="flex-1 text-[15px] font-inter-medium text-foreground">
                {t("Profile.title")}
              </Text>
              <ChevronRight size={18} color={muted} />
            </Pressable>
            <View className="mx-4 h-px bg-border" />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/ui-kit")}
              className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
            >
              <Icon icon={Component} size={20} color={muted} />
              <Text className="flex-1 text-[15px] font-inter-medium text-foreground">
                {t("Profile.uiKit")}
              </Text>
              <ChevronRight size={18} color={muted} />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
