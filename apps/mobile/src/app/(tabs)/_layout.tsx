import { useRef } from "react";
import { View, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { BlurTargetView } from "expo-blur";
import {
  Heart,
  House,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/lib/i18n-provider";
import { useThemeColors } from "@/lib/theme-colors";
import { FloatingTabBar } from "@/components/navigation/floating-tab-bar";

/**
 * Which tab bar to render.
 *
 * - `true`  = the floating blur bar (holy grail): the native bar stays
 *   hidden and `FloatingTabBar` paints it as a sibling of the `BlurTargetView`.
 * - `false` = a normal expo-router tab bar: icons + labels, theme-aware,
 *   no blur, no central CTA (the CTA is a floating-bar-only product slot).
 *
 * NOTE: this flag is unrelated to the blur-geometry experiment below
 * (RenderThread SIGSEGV) — that one must stay `false`, do not touch it.
 *
 * Blur geometry: proven stable hybrid.
 * - `BlurTargetView` wraps `<Tabs>` with a hidden bar + `FloatingTabBar` as a
 *   SIBLING of the target (see `floating-tab-bar.tsx`). A `BlurView` INSIDE
 *   the target (descendant) is the geometry that crashed: the target's
 *   snapshot would include itself.
 */
export const USE_FLOATING_TAB_BAR = false;

function TabBarIcon({
  icon: Icon,
  color,
}: {
  icon: LucideIcon;
  color: ColorValue;
}) {
  // Lucide wants `string`; expo-router hands `ColorValue` (hex at runtime).
  return <Icon color={String(color)} size={24} strokeWidth={2} />;
}

export default function TabsLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);
  const palette = useThemeColors();

  // ---- STABLE HYBRID: expo-router Tabs + sibling FloatingTabBar ----
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.background,
      }}
    >
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: "transparent" },
            ...(USE_FLOATING_TAB_BAR
              ? {
                  // The navigator bar is hidden; FloatingTabBar (sibling of
                  // the target) paints it with the blur from the mode 3 recipe.
                  tabBarStyle: { display: "none", position: "absolute" },
                }
              : {
                  tabBarActiveTintColor: palette.primary,
                  tabBarInactiveTintColor: palette["muted-foreground"],
                  tabBarStyle: {
                    backgroundColor: palette.card,
                    borderTopColor: palette.border,
                    borderTopWidth: 1,
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom,
                  },
                  tabBarLabelStyle: {
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                  },
                }),
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t("Nav.home"),
              tabBarIcon: ({ color }) => (
                <TabBarIcon icon={House} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="search"
            options={{
              title: t("Search.title"),
              tabBarIcon: ({ color }) => (
                <TabBarIcon icon={Search} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="favorites"
            options={{
              title: t("Favorites.title"),
              tabBarIcon: ({ color }) => (
                <TabBarIcon icon={Heart} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t("Profile.title"),
              tabBarIcon: ({ color }) => (
                <TabBarIcon icon={UserRound} color={color} />
              ),
            }}
          />
        </Tabs>
      </BlurTargetView>
      {USE_FLOATING_TAB_BAR ? (
        <FloatingTabBar blurTarget={blurTargetRef} />
      ) : null}
    </View>
  );
}
