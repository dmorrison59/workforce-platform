import { Redirect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { LoadingScreen } from "@/components/loading-screen";
import { PrimaryButton } from "@/components/primary-button";
import { colors, spacing } from "@/theme";

export default function IndexRoute() {
  const auth = useAuth();

  if (auth.status === "loading") return <LoadingScreen />;
  if (auth.status === "signedOut") return <Redirect href="/sign-in" />;
  if (auth.status === "ready" && auth.crewContext) {
    return <Redirect href="/(crew)/today" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>YardClock Crew</Text>
        <Text style={styles.title}>We couldn’t open your crew account</Text>
        <Text style={styles.message}>{auth.error ?? "Your employee access is not ready yet."}</Text>
        <PrimaryButton label="Try again" onPress={() => void auth.retry()} />
        {auth.session ? (
          <PrimaryButton label="Sign out" onPress={() => void auth.signOut()} variant="secondary" />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "800",
  },
  message: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
});
