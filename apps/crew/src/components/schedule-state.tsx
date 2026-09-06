import { ActivityIndicator, Text } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { PrimaryButton } from "@/components/primary-button";
import { Card, sharedStyles } from "@/components/screen";
import type { ScheduleReadError } from "@/services/crew-schedule";
import { colors } from "@/theme";

export function ScheduleState({ status, error, retry }: {
  status: "loading" | "ready" | "error";
  error: ScheduleReadError | null;
  retry(): void;
}) {
  const auth = useAuth();
  if (status === "ready") return null;
  if (status === "loading") return (
    <Card>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your schedule" />
      <Text style={sharedStyles.cardText}>Checking your published schedule…</Text>
    </Card>
  );
  return (
    <Card>
      <Text style={sharedStyles.cardTitle} accessibilityRole="alert">
        {error?.kind === "session" ? "Please sign in again" : "Schedule unavailable"}
      </Text>
      <Text style={sharedStyles.cardText}>{error?.message}</Text>
      <PrimaryButton label={error?.kind === "session" ? "Sign in again" : "Try again"}
        onPress={error?.kind === "session" ? () => void auth.signOut() : retry} />
      {error?.kind === "access" ? <PrimaryButton label="Check account" onPress={() => void auth.retry()} variant="secondary" /> : null}
      {auth.error ? <Text accessibilityRole="alert" style={sharedStyles.cardText}>{auth.error}</Text> : null}
    </Card>
  );
}
