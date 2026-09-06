import { StyleSheet, Text, View } from "react-native";

import { Card, Screen, sharedStyles } from "@/components/screen";
import { colors, spacing } from "@/theme";

interface PlaceholderScreenProps {
  title: string;
  description: string;
  nextMessage: string;
}

export function PlaceholderScreen({ title, description, nextMessage }: PlaceholderScreenProps) {
  return (
    <Screen eyebrow="YardClock Crew" title={title} description={description}>
      <Card>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>COMING SOON</Text>
        </View>
        <Text style={sharedStyles.cardTitle}>This area is ready</Text>
        <Text style={sharedStyles.cardText}>{nextMessage}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
