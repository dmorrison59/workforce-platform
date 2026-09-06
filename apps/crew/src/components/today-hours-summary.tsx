import { useRouter } from "expo-router";
import { Text } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { Card, sharedStyles } from "@/components/screen";
import { formatDuration, hoursSummary } from "@/lib/hours-presentation";
import { useCurrentCrewHours } from "@/state/hours-context";

export function TodayHoursSummary({ timeZone, now }: { timeZone: string; now: Date }) {
  const hours = useCurrentCrewHours();
  const router = useRouter();
  if (hours.status === "loading") return <Card><Text style={sharedStyles.cardText}>Checking today’s worked time…</Text></Card>;
  if (hours.status === "error" || !hours.data) return <Card>
    <Text style={sharedStyles.cardText}>Today’s hours are unavailable right now.</Text>
    <PrimaryButton label="Try hours again" variant="secondary" onPress={hours.refresh} />
  </Card>;
  const summary = hoursSummary(hours.data, timeZone, now);
  return <Card>
    <Text style={sharedStyles.cardTitle}>Today: {formatDuration(summary.todayMinutes)} worked</Text>
    {summary.openEntry ? <Text style={sharedStyles.cardText}>Your current open entry is included as a provisional total.</Text> : null}
    <PrimaryButton label="Open Hours" variant="secondary" onPress={() => router.navigate("/(crew)/hours")} />
  </Card>;
}
