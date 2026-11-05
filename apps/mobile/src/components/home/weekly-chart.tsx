import { View } from "react-native";
import { Bar, CartesianChart } from "victory-native";
import { LinearGradient, vec } from "@shopify/react-native-skia";
import { useThemePreference } from "@/lib/theme-provider";
import { semanticTokens } from "@app/lib/tokens/semantic";
import { Text } from "@/components/ui/text";
import { useI18n } from "@/lib/i18n-provider";
import { WEEK_ACTIVITY, WEEK_TOTAL } from "@/lib/demo-week";

/**
 * Weekly activity card (victory-native + Skia, recipe from the official
 * "Basic Bar Chart" guide). Demo data only — `WEEK_ACTIVITY` is fixed
 * placeholder values, NOT backend metrics.
 *
 * Deliberately NO axisOptions/Skia font loading: axis tick labels need
 * `useFont()` with a bundled TTF, which is the documented next step when
 * the domain has real series. Day initials render as a plain RN row below.
 */
export function WeeklyChart() {
  const { t } = useI18n();
  const { resolved } = useThemePreference();
  const palette = semanticTokens[resolved];
  const initials = t("Home.weekInitials").split(" ");

  return (
    <View className="gap-3 rounded-2xl bg-card p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base font-inter-semibold text-foreground">
          {t("Home.thisWeek")}
        </Text>
        <Text variant="muted">
          {t("Home.activeDays", { count: WEEK_TOTAL })}
        </Text>
      </View>
      <View style={{ height: 180 }}>
        <CartesianChart
          data={WEEK_ACTIVITY}
          xKey="day"
          yKeys={["value"]}
          domainPadding={{ left: 24, right: 24, top: 16 }}
        >
          {({ points, chartBounds }) => (
            <Bar
              chartBounds={chartBounds}
              points={points.value}
              color={palette.primary}
              roundedCorners={{ topLeft: 6, topRight: 6 }}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, 220)}
                colors={[palette.primary, `${palette.primary}55`]}
              />
            </Bar>
          )}
        </CartesianChart>
      </View>
      <View className="flex-row justify-between px-1">
        {initials.map((initial, i) => (
          <Text key={i} variant="muted" className="w-6 text-center">
            {initial}
          </Text>
        ))}
      </View>
    </View>
  );
}
