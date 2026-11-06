import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PortalHost } from "@rn-primitives/portal";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

import "@/global.css";
import { authClient } from "@/lib/auth-client";
import { isAuthenticatedSession } from "@/lib/auth-guard";
import { I18nProvider } from "@/lib/i18n-provider";
import { ThemeProvider as AppThemeProvider, useThemePreference } from "@/lib/theme-provider";
import { useNavigationTheme } from "@/lib/navigation-theme";
import { TRPCProvider } from "@/lib/trpc";

// Prevents a flash of the default background before the first frame;
// `hideAsync` is called from the root View's onLayout, once fonts and
// session are resolved.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <I18nProvider>
      <AppThemeProvider>
        <TRPCProvider>
          <RootNavigator />
        </TRPCProvider>
      </AppThemeProvider>
    </I18nProvider>
  );
}

function RootNavigator() {
  // EFFECTIVE theme (user's choice in Profile > Theme, or system).
  // `useThemePreference` calls `Uniwind.setTheme`, which is what moves the
  // `@variant light/dark` vars in tokens/tokens.css.
  const { resolved } = useThemePreference();
  const scheme = resolved;
  const navigationTheme = useNavigationTheme(scheme);
  // No `require()`: the package exposes each weight as a module.
  // The keys (Inter_400Regular, …) are the `fontFamily`s available at
  // runtime (Expo Go / web). In native dev builds, the `expo-font`
  // config plugin (app.json) maps these same files to the single family
  // "Inter" per weight, so `font-semibold`/`font-bold` work.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const { data: session, error, isPending } = authClient.useSession();

  // Switching apps and coming back fires a foreground session refetch,
  // which sets `isPending` back to true while there is still no session.
  // The spinner must only cover the FIRST resolution: flipping to it again
  // would unmount the Stack and drop in-progress state (e.g. the sign-in
  // 2FA step while the user is in the authenticator app).
  const [sessionBooted, setSessionBooted] = useState(false);

  useEffect(() => {
    if (!isPending) setSessionBooted(true);
  }, [isPending]);

  // The splash depends ONLY on fonts. The session does NOT: if the backend is
  // unreachable from the device, `isPending` hangs and the splash would
  // never hide. The loading screen is painted by the UI, not the native splash.
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {
        // hideAsync can fail if already hidden; not an error
      });
    }
  }, [fontsReady]);

  useEffect(() => {
    if (fontError) {
      console.warn("Inter failed to load, falling back to system font", fontError);
    }
  }, [fontError]);

  useEffect(() => {
    // Background of the NATIVE root view (what shows behind everything,
    // including scroll bounce). Without this, the window's default white
    // remains even when the system is in dark mode. Pure JS: no rebuild needed.
    SystemUI.setBackgroundColorAsync(
      navigationTheme.colors.background,
    ).catch(() => {
      // no-op on platforms without support
    });
  }, [navigationTheme.colors.background]);

  if (!fontsReady) {
    return <View className="flex-1 bg-background" />;
  }

  const isAuthenticated = isAuthenticatedSession(session, error);

  return (
    // ThemeProvider paints the React Navigation chrome (tab bar, each
    // screen's background, headers, tints) according to the system theme;
    // the `View` with bg-background covers the gap behind the navigator.
    <ThemeProvider value={navigationTheme}>
      {/* Required by react-native-gesture-handler (drawers, swipe...). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-background">
        {/* Explicit per effective theme: with a manual theme, "auto" would
            follow the system and end up inverted. */}
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        {!sessionBooted ? (
          // Session resolving for the first time (or unreachable backend):
          // spinner visible inside the app instead of an eternal native
          // splash. Refetches never return here, so screens keep their state.
          <View className="flex-1 items-center justify-center bg-background">
            <ActivityIndicator />
          </View>
        ) : (
          <Stack>
            <Stack.Protected guard={isAuthenticated}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="ui-kit" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={!isAuthenticated}>
              <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            </Stack.Protected>
          </Stack>
        )}
        </View>
        {/* Host for the portals (@rn-primitives/portal): dropdowns, etc. */}
        <PortalHost />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
