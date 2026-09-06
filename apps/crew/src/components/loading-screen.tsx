import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme";

export function LoadingScreen({ label = "Opening YardClock…" }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    padding: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: 16,
  },
});
