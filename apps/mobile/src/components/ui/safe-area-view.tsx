import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

/**
 * `SafeAreaView` from `react-native-safe-area-context` with `className` support.
 *
 * Uniwind patches Metro's resolver **only** for the `react-native` module
 * (`uniwind/src/bundler/adapters/metro/resolvers.ts`), so third-party
 * components do not receive `className` and the prop is silently ignored.
 * `withUniwind` wraps the component and maps `className` → `style`
 * (`uniwind/src/hoc/types.ts`: `StyleToClass` auto-maps `style` and `xStyle`).
 *
 * Used with `withUniwind(...)` instead of `useSafeAreaInsets()` + `style` to
 * keep the class ergonomics and the original `edges`/`mode` contract.
 *
 * Usage:
 * ```tsx
 * <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
 * ```
 */
export const SafeAreaView = withUniwind(RNSafeAreaView);
