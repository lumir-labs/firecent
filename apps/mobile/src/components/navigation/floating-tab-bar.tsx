import { useEffect, useState, type RefObject } from "react";
import { BlurView, type BlurMethod } from "expo-blur";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type View as RNView,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  House,
  Search,
  Plus,
  Heart,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";

import { authClient } from "@/lib/auth-client";
import { useThemePreference } from "@/lib/theme-provider";
import { useThemeColors } from "@/lib/theme-colors";
import { withAlpha } from "@/lib/utils";

/**
 * Real blur on Android?
 */
export const ANDROID_REAL_BLUR = true;

type FloatingTabBarProps = {
  blurTarget?: RefObject<RNView | null>;
  onPressCta?: () => void;
};

const BAR_RADIUS = 36;
const BAR_HEIGHT = 55;

export function FloatingTabBar({
  blurTarget,
  onPressCta,
}: FloatingTabBarProps) {
  const { data: session } = authClient.useSession();
  const { resolved } = useThemePreference();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const [targetReady, setTargetReady] = useState(false);
  const wantsAndroidBlur =
    Platform.OS === "android" && ANDROID_REAL_BLUR && !!blurTarget;

  useEffect(() => {
    if (!wantsAndroidBlur || targetReady) return;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (blurTarget?.current != null) setTargetReady(true);
      else if (tries > 20) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [wantsAndroidBlur, targetReady, blurTarget]);

  const isDark = resolved === "dark";
  const palette = useThemeColors();
  const tint = isDark ? "dark" : "light";
  const fallbackBg = withAlpha(palette.card, isDark ? 0xd9 / 255 : 0xb3 / 255);

  const user = session?.user;

  const background = (() => {
    if (Platform.OS === "android") {
      if (!wantsAndroidBlur || !targetReady) {
        return (
          <View
            style={[StyleSheet.absoluteFill, styles.rounded]}
            pointerEvents="none"
          >
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: fallbackBg }]}
            />
          </View>
        );
      }
      const method: BlurMethod = "dimezisBlurViewSdk31Plus";
      return (
        <BlurView
          intensity={60}
          tint={tint}
          blurTarget={blurTarget}
          blurMethod={method}
          style={[StyleSheet.absoluteFill, styles.rounded]}
          pointerEvents="none"
        />
      );
    }
    return (
      <BlurView
        intensity={60}
        tint={tint}
        style={[StyleSheet.absoluteFill, styles.rounded]}
        pointerEvents="none"
      />
    );
  })();

  const isHomeActive = pathname === "/" || pathname === "/index";
  const isSearchActive = pathname.startsWith("/search");
  const isFavoritesActive = pathname.startsWith("/favorites");
  const isProfileActive = pathname.startsWith("/profile");

  const mutedBubbleBg = isDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.08)";

  const renderNavTab = ({
    key,
    href,
    icon: Icon,
    active,
    accessibilityLabel,
  }: {
    key: string;
    href: string;
    icon: LucideIcon;
    active: boolean;
    accessibilityLabel: string;
  }) => {
    return (
      <Pressable
        key={key}
        accessibilityRole="tab"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: active }}
        onPress={() => router.navigate(href as any)}
        className="flex-1 items-center justify-center h-full active:opacity-70"
      >
        <View
          style={[
            styles.iconWrapper,
            active && { backgroundColor: mutedBubbleBg },
          ]}
        >
          <Icon
            color={palette.foreground}
            size={22}
            strokeWidth={active ? 2.5 : 2}
          />
        </View>
      </Pressable>
    );
  };

  const handleCtaPress = () => {
    if (onPressCta) {
      onPressCta();
    }
    // No default action: the central CTA is a product slot (wired
    // via `onPressCta`). Do not link experiment routes here.
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          bottom: insets.bottom + 16,
          borderWidth: 0,
          borderTopWidth: 0,
        },
      ]}
    >
      {background}
      <View
        className="flex-1 flex-row items-center justify-between px-0"
        pointerEvents="box-none"
      >
        {/* 1. Home */}
        {renderNavTab({
          key: "home",
          href: "/",
          icon: House,
          active: isHomeActive,
          accessibilityLabel: "Home",
        })}

        {/* 2. Search */}
        {renderNavTab({
          key: "search",
          href: "/search",
          icon: Search,
          active: isSearchActive,
          accessibilityLabel: "Search",
        })}

        {/* 3. Central CTA Button */}
        <View className="flex-1 items-center justify-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create"
            onPress={handleCtaPress}
            style={({ pressed }) => [
              styles.ctaButton,
              {
                backgroundColor: palette.primary,
                transform: [{ scale: pressed ? 0.93 : 1 }],
              },
            ]}
          >
            <Plus color="#ffffff" size={24} strokeWidth={2.75} />
          </Pressable>
        </View>

        {/* 4. Heart / Favorites */}
        {renderNavTab({
          key: "favorites",
          href: "/favorites",
          icon: Heart,
          active: isFavoritesActive,
          accessibilityLabel: "Favorites",
        })}

        {/* 5. Profile: User Avatar with muted circle on active */}
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Profile"
          accessibilityState={{ selected: isProfileActive }}
          onPress={() => router.navigate("/profile")}
          className="flex-1 items-center justify-center h-full active:opacity-70"
        >
          <View
            style={[
              styles.avatarContainer,
              isProfileActive && styles.avatarContainerActive,
              isProfileActive && { backgroundColor: mutedBubbleBg },
            ]}
          >
            {user?.image ? (
              <Image
                source={{ uri: user.image }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <UserRound
                color={isProfileActive ? palette.primary : palette.foreground}
                size={22}
              />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 32,
    right: 32,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    borderWidth: 1,
    backgroundColor: "transparent",
    elevation: 2,
  },
  rounded: {
    borderRadius: BAR_RADIUS,
    overflow: "hidden",
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    elevation: 5,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarContainerActive: {
    borderRadius: 22,
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
});
