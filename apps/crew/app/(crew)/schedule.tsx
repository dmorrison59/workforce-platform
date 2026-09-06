import { useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { PrimaryButton } from "@/components/primary-button";
import { ScheduleState } from "@/components/schedule-state";
import { Card, Screen, sharedStyles } from "@/components/screen";
import { ShiftCard } from "@/components/shift-card";
import { useCrewSchedule, useScheduleClock } from "@/hooks/use-crew-schedule";
import { addDays, formatWeekDay, weekGroups, weekHeading, weekStartFor, weekWindow } from "@/lib/schedule-presentation";
import { spacing } from "@/theme";

export default function ScheduleRoute() {
  const context = useAuth().crewContext!;
  const timeZone = context.organization.timezone;
  const now = useScheduleClock();
  const currentWeek = weekStartFor(now, timeZone);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const week = selectedWeek ?? currentWeek;
  const schedule = useCrewSchedule(context, weekWindow(week, timeZone));
  const groups = weekGroups(schedule.shifts, week, timeZone);

  return (
    <Screen eyebrow={context.organization.name} title="My Schedule"
      description={`Your published work · ${timeZone.replace(/_/g, " ")}`}
      refreshControl={<RefreshControl refreshing={schedule.refreshing} onRefresh={schedule.refresh} />}>
      <Text style={sharedStyles.cardTitle}>{weekHeading(week)}</Text>
      <View style={styles.navigation}>
        <View style={styles.button}><PrimaryButton label="← Previous" accessibilityLabel="Previous week" variant="secondary" onPress={() => setSelectedWeek(addDays(week, -7))} /></View>
        <View style={styles.button}><PrimaryButton label="Next →" accessibilityLabel="Next week" variant="secondary" onPress={() => setSelectedWeek(addDays(week, 7))} /></View>
      </View>
      {week !== currentWeek ? <PrimaryButton label="Back to this week" variant="secondary" onPress={() => setSelectedWeek(null)} /> : null}
      <ScheduleState status={schedule.status} error={schedule.error} retry={schedule.retry} />
      {schedule.status === "ready" && !schedule.shifts.length ? (
        <Card><Text style={sharedStyles.cardTitle}>No shifts this week.</Text><Text style={sharedStyles.cardText}>There’s no published work assigned to you for these dates.</Text></Card>
      ) : null}
      {schedule.status === "ready" && schedule.shifts.length ? groups.map((group) => (
        <View key={group.day} style={styles.day}>
          <Text accessibilityRole="header" style={sharedStyles.cardTitle}>{formatWeekDay(group.day)}</Text>
          {group.shifts.length ? group.shifts.map((shift) => <ShiftCard key={shift.id} shift={shift} day={group.day} timeZone={timeZone} />)
            : <Text style={sharedStyles.cardText}>No work scheduled</Text>}
        </View>
      )) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  navigation: { flexDirection: "row", gap: spacing.sm },
  button: { flex: 1 },
  day: { gap: spacing.sm, marginTop: spacing.sm },
});
