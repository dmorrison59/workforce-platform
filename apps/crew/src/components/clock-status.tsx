import { useRouter } from "expo-router";
import { Text } from "react-native";
import { Card, sharedStyles } from "@/components/screen";
import { PrimaryButton } from "@/components/primary-button";
import { formatShiftTime } from "@/lib/schedule-presentation";
import { useCrewClock } from "@/state/clock-context";

export function ClockStatus({ timeZone }: { timeZone: string }) {
  const clock = useCrewClock();
  const router = useRouter();
  const active = clock.context?.activeEntry;
  const label = clock.phase === "loading" ? "Checking clock status…"
    : clock.phase === "locating" ? "Getting punch location…"
      : clock.phase === "submitting" ? "Confirming your punch…"
        : clock.phase === "error" || clock.pending ? "Clock status needs checking"
          : active ? `Clocked In · ${formatShiftTime(active.clock_in_at, timeZone)}` : "Not Clocked In";
  return <Card>
    <Text style={sharedStyles.cardTitle}>{label}</Text>
    <PrimaryButton label="Open Clock" variant="secondary" onPress={() => router.navigate("/(crew)/clock")} />
  </Card>;
}
