import { StyleSheet } from "react-native";

/**
 * Layout/typography only. COLORS live in `className` with the semantic
 * tokens (bg-background, text-foreground, border-border, bg-primary...) so
 * the system theme applies without recalculating styles.
 */
export default StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 24,
  },
  hero: { alignItems: "center", gap: 8 },
  logo: { width: 88, height: 88, resizeMode: "contain" },
  sentBlock: { alignItems: "center", gap: 12, paddingVertical: 8 },
  input: {
    width: "100%",
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  separator: { fontSize: 13, fontFamily: "Inter_400Regular" },
  error: { textAlign: "center" },
  legal: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
