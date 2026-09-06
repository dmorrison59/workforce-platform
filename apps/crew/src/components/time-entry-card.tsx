import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { sharedStyles } from "@/components/screen";
import {
  breaksFor, entryBreakMinutes, entryGrossMinutes, entryHasOpenBreak, entryStatusLabels,
  entryTimeLabel, entryWorkedMinutes, formatDuration, safeOptionalText,
} from "@/lib/hours-presentation";
import { formatShiftTime } from "@/lib/schedule-presentation";
import { colors, spacing } from "@/theme";
import type { CrewHoursBreak, CrewHoursEntry } from "@/types/hours";

export function TimeEntryCard({ entry, breaks, timeZone, now, locationName, shift }: {
  entry: CrewHoursEntry;
  breaks: CrewHoursBreak[];
  timeZone: string;
  now: Date;
  locationName?: string;
  shift?: { start_at: string; end_at: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const entryBreaks = breaksFor(entry, breaks);
  const breakMinutes = entryBreakMinutes(entry, entryBreaks, now);
  const workedMinutes = entryWorkedMinutes(entry, entryBreaks, now);
  const openBreak = entryHasOpenBreak(entry, entryBreaks);
  const statusLabels = entryStatusLabels(entry);
  const scheduled = shift
    ? `${formatShiftTime(shift.start_at, timeZone)} – ${formatShiftTime(shift.end_at, timeZone)}` : null;

  return <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
    accessibilityLabel={`${entryTimeLabel(entry, timeZone)}. ${expanded ? "Hide" : "Show"} details`}
    onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.heading}>
      <View style={styles.headingText}>
        <Text style={styles.time}>{entryTimeLabel(entry, timeZone)}</Text>
        {breakMinutes > 0 || openBreak ? <Text style={sharedStyles.cardText}>
          Break: {formatDuration(breakMinutes)}{openBreak ? " · Active" : ""}
        </Text> : null}
        <Text style={entry.status === "open" ? styles.current : sharedStyles.cardText}>
          {entry.status === "open" ? "Current" : "Worked"}: {formatDuration(workedMinutes)}
        </Text>
      </View>
      <Text style={styles.disclosure}>{expanded ? "−" : "+"}</Text>
    </View>
    <View style={styles.badges}>
      {statusLabels.map((label) => <Text key={label} style={[styles.badge, label === "Approved" && styles.approved]}>{label}</Text>)}
    </View>
    {expanded ? <View style={styles.details}>
      <Text style={styles.detailTitle}>Entry details</Text>
      <Text style={sharedStyles.cardText}>Gross: {formatDuration(entryGrossMinutes(entry, now))}</Text>
      <Text style={sharedStyles.cardText}>Breaks: {formatDuration(breakMinutes)}</Text>
      <Text style={sharedStyles.cardText}>Net worked: {formatDuration(workedMinutes)}</Text>
      <Text style={sharedStyles.cardText}>Location: {safeOptionalText(locationName, "Details unavailable")}</Text>
      <Text style={sharedStyles.cardText}>Scheduled shift: {scheduled ?? "Not linked"}</Text>
      <Text style={sharedStyles.cardText}>Clock In Location: {entry.clock_in_captured_at ? "Recorded" : "Not recorded"}</Text>
      <Text style={sharedStyles.cardText}>Clock Out Location: {entry.clock_out_captured_at ? "Recorded" : entry.status === "open" ? "Pending" : "Not recorded"}</Text>
      {entry.status === "open" ? <Text style={styles.notice}>Current time is provisional. The final total is set when this entry closes.</Text> : null}
    </View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  pressed: { backgroundColor: colors.surfaceMuted },
  heading: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  headingText: { flex: 1, gap: spacing.xs },
  time: { color: colors.text, fontSize: 20, fontWeight: "800" },
  current: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  disclosure: { color: colors.primary, fontSize: 26, fontWeight: "500", lineHeight: 26 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  badge: { backgroundColor: colors.surfaceMuted, borderRadius: 20, color: colors.textMuted, fontSize: 12, fontWeight: "800", overflow: "hidden", paddingHorizontal: spacing.sm, paddingVertical: 5 },
  approved: { backgroundColor: colors.primary, color: colors.white },
  details: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, marginTop: spacing.xs, paddingTop: spacing.sm },
  detailTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  notice: { color: colors.textMuted, fontSize: 13, fontStyle: "italic", lineHeight: 19, marginTop: spacing.xs },
});
