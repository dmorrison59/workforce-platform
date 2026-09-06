import { useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { PrimaryButton } from "@/components/primary-button";
import { Card, Screen, sharedStyles } from "@/components/screen";
import { TimeEntryCard } from "@/components/time-entry-card";
import { dayHeading, formatDuration, hoursDayGroups, hoursSummary } from "@/lib/hours-presentation";
import { addDays, formatShiftTime, weekHeading, weekStartFor } from "@/lib/schedule-presentation";
import { useScheduleClock } from "@/hooks/use-crew-schedule";
import { useCrewHoursWeek, useCurrentCrewHours } from "@/state/hours-context";
import { colors, spacing } from "@/theme";

export default function HoursRoute() {
  const auth = useAuth();
  const context = auth.crewContext!;
  const now = useScheduleClock();
  const timeZone = context.organization.timezone;
  const currentWeek = weekStartFor(now, timeZone);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const week = selectedWeek ?? currentWeek;
  const current = useCurrentCrewHours();
  const historical = useCrewHoursWeek(context, week, week !== currentWeek);
  const hours = week === currentWeek ? current : historical;
  const summary = hours.data ? hoursSummary(hours.data, timeZone, now) : null;
  const groups = hours.data ? hoursDayGroups(hours.data, timeZone, now) : [];

  return <Screen eyebrow={context.organization.name} title="Hours"
    description={`Your timesheet · ${timeZone.replace(/_/g, " ")}`}
    refreshControl={<RefreshControl refreshing={hours.refreshing} onRefresh={hours.refresh} />}>
    <Text style={sharedStyles.cardTitle}>{week === currentWeek ? "This Week" : weekHeading(week)}</Text>
    <Text style={sharedStyles.cardText}>{weekHeading(week)}</Text>
    <View style={styles.navigation}>
      <View style={styles.button}><PrimaryButton label="← Previous" accessibilityLabel="Previous week" variant="secondary" onPress={() => setSelectedWeek(addDays(week, -7))} /></View>
      <View style={styles.button}><PrimaryButton label="Next →" accessibilityLabel="Next week" variant="secondary" onPress={() => setSelectedWeek(addDays(week, 7))} /></View>
    </View>
    {week !== currentWeek ? <PrimaryButton label="Back to this week" variant="secondary" onPress={() => setSelectedWeek(null)} /> : null}

    {hours.status === "loading" ? <Card><ActivityIndicator color={colors.primary} /><Text style={sharedStyles.cardText}>Loading your hours…</Text></Card> : null}
    {hours.status === "error" ? <Card>
      <Text accessibilityRole="alert" style={sharedStyles.cardTitle}>Hours couldn’t load</Text>
      <Text style={sharedStyles.cardText}>{hours.error?.message}</Text>
      <PrimaryButton label="Try again" onPress={hours.refresh} />
      {hours.error?.kind === "session" ? <PrimaryButton label="Sign in again" variant="secondary" onPress={() => void auth.signOut()} /> : null}
    </Card> : null}

    {hours.status === "ready" && hours.data && summary ? <>
      <Card>
        <View style={styles.summaryRow}>
          <View style={styles.metric}><Text style={styles.metricLabel}>This Week</Text><Text style={styles.metricValue}>{formatDuration(summary.totalMinutes)}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>Today</Text><Text style={styles.metricValue}>{week === currentWeek ? formatDuration(summary.todayMinutes) : "—"}</Text></View>
        </View>
        <View style={styles.openStatus}>
          <Text style={summary.openEntry ? styles.openTitle : sharedStyles.cardTitle}>{summary.openEntry ? "Clocked In" : "No Open Entry"}</Text>
          {summary.openEntry ? <Text style={sharedStyles.cardText}>{formatShiftTime(summary.openEntry.clock_in_at, timeZone)} · Current total is provisional</Text> : null}
        </View>
      </Card>
      {!hours.data.entries.length ? <Card>
        <Text style={sharedStyles.cardTitle}>No hours this week.</Text>
        <Text style={sharedStyles.cardText}>Clocked time for this period will appear here.</Text>
      </Card> : null}
      {groups.map((group) => <View key={group.day} style={styles.day}>
        <View style={styles.dayHeading}>
          <Text accessibilityRole="header" style={sharedStyles.cardTitle}>{dayHeading(group.day)}</Text>
          <Text style={styles.dailyTotal}>{formatDuration(group.totalMinutes)}</Text>
        </View>
        {group.entries.map((entry) => <TimeEntryCard key={entry.id} entry={entry} breaks={hours.data!.breaks}
          timeZone={timeZone} now={now} locationName={hours.data!.locationNames[entry.location_id]}
          shift={entry.shift_id ? hours.data!.shifts[entry.shift_id] : undefined} />)}
      </View>)}
      <Text style={styles.footnote}>Entries are grouped by the organization-local date they began. Open totals update on this screen without writing to YardClock.</Text>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  navigation: { flexDirection: "row", gap: spacing.sm },
  button: { flex: 1 },
  summaryRow: { flexDirection: "row", gap: spacing.lg },
  metric: { flex: 1, gap: spacing.xs },
  metricLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  metricValue: { color: colors.text, fontSize: 28, fontWeight: "800" },
  openStatus: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm },
  openTitle: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  day: { gap: spacing.sm, marginTop: spacing.sm },
  dayHeading: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  dailyTotal: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  footnote: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
});
