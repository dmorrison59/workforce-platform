import { RefreshControl, Text } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { PrimaryButton } from "@/components/primary-button";
import { ScheduleState } from "@/components/schedule-state";
import { Card, Screen, sharedStyles } from "@/components/screen";
import { ShiftCard } from "@/components/shift-card";
import { ClockStatus } from "@/components/clock-status";
import { useCrewSchedule, useScheduleClock } from "@/hooks/use-crew-schedule";
import { greeting, orgDayWindow, todayWork } from "@/lib/schedule-presentation";

export default function TodayRoute() {
  const auth = useAuth();
  const context = auth.crewContext!;
  const now = useScheduleClock();
  const timeZone = context.organization.timezone;
  const schedule = useCrewSchedule(context, orgDayWindow(timeZone, now));
  const work = todayWork(schedule.shifts, timeZone, now);

  return (
    <Screen eyebrow={context.organization.name}
      title={`${greeting(timeZone, now)}, ${context.employee.first_name}`}
      description={`Your day, at a glance · ${timeZone.replace(/_/g, " ")}`}
      refreshControl={<RefreshControl refreshing={schedule.refreshing} onRefresh={schedule.refresh} />}>
      <ClockStatus timeZone={timeZone} />
      <ScheduleState status={schedule.status} error={schedule.error} retry={schedule.retry} />
      {schedule.status === "ready" && !work.shifts.length ? (
        <Card><Text style={sharedStyles.cardTitle}>No work scheduled today.</Text>
          <Text style={sharedStyles.cardText}>Your published shifts will appear here. Check Schedule for the rest of your week.</Text></Card>
      ) : null}
      {schedule.status === "ready" && work.shifts.length ? (
        <Text style={sharedStyles.cardTitle}>{work.immediateId ? "Today’s work" : "Today’s scheduled work has ended"}</Text>
      ) : null}
      {work.shifts.map((shift) => (
        <ShiftCard key={shift.id} shift={shift} day={work.day} timeZone={timeZone}
          prominent={work.immediateId === shift.id}
          label={work.immediateId === shift.id ? (Date.parse(shift.start_at) <= now.getTime() ? "Scheduled now" : "Up next") : undefined} />
      ))}
      <Text style={sharedStyles.cardText}>Signed in as {context.role.name}</Text>
      {auth.error ? <Text accessibilityRole="alert" style={sharedStyles.cardText}>{auth.error}</Text> : null}
      <PrimaryButton label="Sign out" onPress={() => void auth.signOut()} variant="secondary" />
    </Screen>
  );
}
