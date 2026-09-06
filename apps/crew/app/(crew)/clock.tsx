import { useState } from "react";
import { ActivityIndicator, Alert, Linking, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { PrimaryButton } from "@/components/primary-button";
import { Card, Screen, sharedStyles } from "@/components/screen";
import { useCrewSchedule, useScheduleClock } from "@/hooks/use-crew-schedule";
import { elapsedTime } from "@/lib/clock-presentation";
import { formatShiftTime, orgDayWindow, shiftTimeLabel, todayWork } from "@/lib/schedule-presentation";
import { useCrewClock } from "@/state/clock-context";
import { colors, spacing } from "@/theme";

export default function ClockRoute() {
  const auth = useAuth();
  const employee = auth.crewContext!;
  const timeZone = employee.organization.timezone;
  const now = useScheduleClock();
  const clock = useCrewClock();
  const context = clock.context;
  const day = orgDayWindow(timeZone, now);
  const schedule = useCrewSchedule(employee, day);
  const work = todayWork(schedule.shifts, timeZone, now);
  const relevant = work.shifts.find((shift) => shift.id === work.immediateId);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const jobs = context?.jobs ?? [];
  const job = jobs.find((item) => item.id === selectedJob) ?? (jobs.length === 1 ? jobs[0] : null);
  const locations = context?.locations ?? [];
  const candidateLocation = selectedLocation ?? (context?.fieldRequired ? job?.location_id : relevant?.location_id)
    ?? (locations.length === 1 ? locations[0].id : null);
  const locationId = locations.some((location) => location.id === candidateLocation) ? candidateLocation : null;
  const active = context?.activeEntry;
  const busy = ["loading", "locating", "submitting"].includes(clock.phase);
  const selectionReady = !!locationId && (!context?.fieldRequired || (!!job && context.canUseField));
  const gpsRequired = (clock.pending ? clock.pending.kind === "in" : !active) && !!context?.fieldRequired;
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone }).format(now);
  const refresh = () => { void clock.refresh(); schedule.refresh(); };
  const openSettings = () => void Linking.openSettings().catch(() => Alert.alert("Settings unavailable", "Open your device settings and allow YardClock location access."));

  return <Screen eyebrow={employee.organization.name} title="Clock"
    description={`${date} · ${formatShiftTime(now.toISOString(), timeZone)}`}
    refreshControl={<RefreshControl refreshing={clock.phase === "loading"} onRefresh={refresh} />}>
    {clock.phase === "error" ? <Card>
      <Text accessibilityRole="alert" style={sharedStyles.cardTitle}>Clock needs checking</Text>
      <Text style={sharedStyles.cardText}>{clock.error?.message}</Text>
      <PrimaryButton label="Refresh clock status" onPress={() => void clock.refresh()} />
      {clock.error?.kind === "session" ? <PrimaryButton label="Sign in again" variant="secondary" onPress={() => void auth.signOut()} /> : null}
    </Card> : null}
    {clock.phase === "loading" ? <Card><ActivityIndicator color={colors.primary} /><Text style={sharedStyles.cardText}>Checking your current time entry…</Text></Card> : null}
    {context && clock.phase !== "loading" && clock.phase !== "error" ? <>
      <Card>
        <Text style={styles.status}>{active ? "Clocked In" : "Not Clocked In"}</Text>
        {active ? <>
          <Text style={styles.elapsed}>{elapsedTime(active, now)}</Text>
          <Text style={sharedStyles.cardText}>Clocked in {shiftTimeLabel(active.clock_in_at, day.day, timeZone)}</Text>
          <Text style={sharedStyles.cardTitle}>{active.location_name ?? "Location details unavailable"}</Text>
          {context.hasOpenBreak ? <Text accessibilityRole="alert" style={sharedStyles.cardText}>You have an active break. End it in YardClock on the web before clocking out.</Text> : null}
        </> : <>
          {context.fieldRequired ? <>
            <Text style={sharedStyles.cardTitle}>Assigned field job</Text>
            <Text style={sharedStyles.cardText}>Your workplace requires its existing job-site location check.</Text>
            {jobs.map((item) => <PrimaryButton key={item.id} label={`${job?.id === item.id ? "✓ " : ""}${item.name}`}
              accessibilityState={{ selected: job?.id === item.id }} disabled={busy || !!clock.pending}
              variant="secondary" onPress={() => { setSelectedJob(item.id); setSelectedLocation(null); }} />)}
          </> : relevant ? <>
            <Text style={sharedStyles.cardTitle}>{relevant.location?.name ?? "Scheduled work"}</Text>
            <Text style={sharedStyles.cardText}>Scheduled {shiftTimeLabel(relevant.start_at, day.day, timeZone)} – {shiftTimeLabel(relevant.end_at, day.day, timeZone)}</Text>
          </> : <Text style={sharedStyles.cardText}>{schedule.status === "loading" ? "Checking today’s schedule…" : "No current or upcoming shift loaded. You can record unscheduled time at an available location."}</Text>}
          <Text style={sharedStyles.cardTitle}>Time-entry location</Text>
          {locations.map((location) => <PrimaryButton key={location.id} label={`${locationId === location.id ? "✓ " : ""}${location.name}`}
            accessibilityState={{ selected: locationId === location.id }} variant="secondary"
            disabled={busy || !!clock.pending} onPress={() => setSelectedLocation(location.id)} />)}
          {!locations.length ? <Text style={sharedStyles.cardText}>No available location. Ask your manager for help.</Text> : null}
        </>}
        {!context.canUse ? <Text style={sharedStyles.cardText}>Clock actions are not enabled for this account.</Text> : null}
        {clock.pending ? <>
          <Text accessibilityRole="alert" style={sharedStyles.cardText}>A previous punch has not been confirmed. Retry uses the same request ID.</Text>
          <PrimaryButton label={`Retry Clock ${clock.pending.kind === "in" ? "In" : "Out"}`} loading={busy} onPress={() => void clock.retry()} />
        </> : !clock.locationIssue ? <PrimaryButton
          label={active ? "Clock Out" : "Clock In"} loading={busy}
          disabled={!context.canUse || !!context.hasOpenBreak || (!active && !selectionReady)}
          onPress={() => void clock.begin({ locationId, jobId: context.fieldRequired ? job?.id ?? null : null,
            shiftId: !context.fieldRequired && relevant?.location_id === locationId ? relevant.id : null })} /> : null}
        {clock.phase === "locating" ? <Text style={sharedStyles.cardText}>Getting a one-time location reading…</Text> : null}
        {clock.phase === "submitting" ? <Text style={sharedStyles.cardText}>Confirming your punch. Please wait…</Text> : null}
      </Card>
      {clock.locationIssue ? <Card>
        <Text accessibilityRole="alert" style={sharedStyles.cardTitle}>Location unavailable</Text>
        <Text style={sharedStyles.cardText}>{clock.locationIssue.message}</Text>
        <PrimaryButton label="Try location again" onPress={() => void clock.retry()} />
        {["restricted", "unavailable"].includes(clock.locationIssue.kind) ? <PrimaryButton label="Open device settings" variant="secondary" onPress={openSettings} /> : null}
        {gpsRequired ? <Text style={sharedStyles.cardText}>Your workplace requires location for this field clock-in.</Text>
          : <PrimaryButton label="Continue without location" variant="secondary" onPress={() => void clock.retry(true)} />}
      </Card> : null}
    </> : null}
    {clock.notice ? <Card><Text accessibilityRole="alert" style={sharedStyles.cardText}>{clock.notice}</Text></Card> : null}
    <View style={styles.privacy}>
      <Text style={sharedStyles.cardText}>Location is requested only when you tap a punch action. There is no continuous or background tracking.</Text>
      <Text style={sharedStyles.cardText}>Times shown in {timeZone.replace(/_/g, " ")}. Elapsed time is not a timesheet total.</Text>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  status: { color: colors.primary, fontSize: 25, fontWeight: "800" },
  elapsed: { color: colors.text, fontSize: 32, fontWeight: "800" },
  privacy: { gap: spacing.sm },
});
