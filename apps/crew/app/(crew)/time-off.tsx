import { useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { PrimaryButton } from "@/components/primary-button";
import { Card, Screen, sharedStyles } from "@/components/screen";
import { TimeOffRequestCard } from "@/components/time-off-request-card";
import { TimeOffRequestForm } from "@/components/time-off-request-form";
import {
  cancellationPrompt, groupTimeOffRequests, organizationToday, timeOffActionState,
} from "@/lib/time-off-presentation";
import { useCrewTimeOff } from "@/state/time-off-context";
import { colors, spacing } from "@/theme";
import type { CrewTimeOffRequest } from "@/types/time-off";

export default function TimeOffRoute() {
  const auth = useAuth();
  const context = auth.crewContext!;
  const timeOff = useCrewTimeOff();
  const [requesting, setRequesting] = useState(false);
  const today = organizationToday(new Date(), context.organization.timezone);
  const groups = groupTimeOffRequests(timeOff.requests ?? [], today);
  const canView = context.permissions["timeoff.view_self"];
  const canRequest = context.permissions["timeoff.request"];
  const actionState = timeOffActionState(timeOff.submitting, timeOff.cancellingId);

  const confirmCancellation = (request: CrewTimeOffRequest) => {
    Alert.alert("Cancel request?", cancellationPrompt(request), [
      { text: "Keep Request", style: "cancel" },
      { text: "Cancel Request", style: "destructive", onPress: () => { void timeOff.cancel(request); } },
    ]);
  };

  if (!canView) return <Screen eyebrow={context.organization.name} title="Time Off">
    <Card>
      <Text accessibilityRole="alert" style={sharedStyles.cardTitle}>Time Off isn’t available</Text>
      <Text style={sharedStyles.cardText}>Your account does not currently have permission to view employee time-off requests. Ask your manager for help.</Text>
    </Card>
  </Screen>;

  return <Screen eyebrow={context.organization.name} title="Time Off"
    description="Request full days away and follow your manager’s decision."
    refreshControl={!requesting ? <RefreshControl refreshing={timeOff.refreshing} onRefresh={timeOff.refresh} /> : undefined}>
    {requesting ? <TimeOffRequestForm timeZone={context.organization.timezone}
      submitting={actionState.submissionLoading} backendError={timeOff.actionError?.message ?? null}
      onClose={() => { timeOff.clearFeedback(); setRequesting(false); }} onSubmit={timeOff.submit} /> : <>
      {timeOff.notice ? <Card><Text accessibilityRole="alert" style={styles.success}>{timeOff.notice}</Text></Card> : null}
      {timeOff.actionError ? <Card>
        <Text accessibilityRole="alert" style={styles.error}>{timeOff.actionError.message}</Text>
        <PrimaryButton label="Dismiss" variant="secondary" onPress={timeOff.clearFeedback} />
      </Card> : null}
      {canRequest ? <PrimaryButton label="Request Time Off" disabled={actionState.actionsDisabled}
        onPress={() => { timeOff.clearFeedback(); setRequesting(true); }} /> : <Card>
        <Text style={sharedStyles.cardText}>You can view requests, but your account cannot submit or cancel them.</Text>
      </Card>}

      {timeOff.status === "loading" ? <Card>
        <ActivityIndicator color={colors.primary} />
        <Text style={sharedStyles.cardText}>Loading your requests…</Text>
      </Card> : null}
      {timeOff.status === "error" ? <Card>
        <Text accessibilityRole="alert" style={sharedStyles.cardTitle}>Requests couldn’t load</Text>
        <Text style={sharedStyles.cardText}>{timeOff.error?.message}</Text>
        <PrimaryButton label="Try again" onPress={timeOff.refresh} />
        {timeOff.error?.kind === "session" ? <PrimaryButton label="Sign in again" variant="secondary" onPress={() => void auth.signOut()} /> : null}
      </Card> : null}
      {timeOff.status === "ready" && timeOff.requests ? <>
        {!timeOff.requests.length ? <Card>
          <Text style={sharedStyles.cardTitle}>No requests yet</Text>
          <Text style={sharedStyles.cardText}>Your submitted time-off requests and manager decisions will appear here.</Text>
        </Card> : null}
        {groups.upcoming.length ? <RequestSection title="Upcoming requests" requests={groups.upcoming}
          timeZone={context.organization.timezone} canRequest={canRequest}
          submitting={timeOff.submitting} cancellingId={timeOff.cancellingId} onCancel={confirmCancellation} /> : null}
        {groups.history.length ? <RequestSection title="Request history" requests={groups.history}
          timeZone={context.organization.timezone} canRequest={canRequest}
          submitting={timeOff.submitting} cancellingId={timeOff.cancellingId} onCancel={confirmCancellation} /> : null}
      </> : null}
    </>}
  </Screen>;
}

function RequestSection({ title, requests, timeZone, canRequest, submitting, cancellingId, onCancel }: {
  title: string;
  requests: CrewTimeOffRequest[];
  timeZone: string;
  canRequest: boolean;
  submitting: boolean;
  cancellingId: string | null;
  onCancel(request: CrewTimeOffRequest): void;
}) {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
    {requests.map((request) => {
      const action = timeOffActionState(submitting, cancellingId, request.id);
      return <TimeOffRequestCard key={request.id} request={request} timeZone={timeZone}
        allowCancel={canRequest} cancelling={action.cancellationLoading}
        actionsDisabled={action.actionsDisabled} onCancel={onCancel} />;
    })}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: "800" },
  success: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 15, fontWeight: "700", lineHeight: 22 },
});
