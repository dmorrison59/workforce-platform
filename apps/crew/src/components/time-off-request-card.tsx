import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { Card, sharedStyles } from "@/components/screen";
import {
  canCancelTimeOff, formatDecisionDate, formatTimeOffRange, timeOffStatus,
} from "@/lib/time-off-presentation";
import { colors, spacing } from "@/theme";
import type { CrewTimeOffRequest } from "@/types/time-off";

export function TimeOffRequestCard({ request, timeZone, allowCancel, cancelling, actionsDisabled, onCancel }: {
  request: CrewTimeOffRequest;
  timeZone: string;
  allowCancel: boolean;
  cancelling: boolean;
  actionsDisabled: boolean;
  onCancel(request: CrewTimeOffRequest): void;
}) {
  const status = timeOffStatus[request.status];
  const decisionDate = request.status === "approved" || request.status === "denied"
    ? formatDecisionDate(request.reviewed_at, timeZone) : null;
  return <Card>
    <View style={styles.heading}>
      <Text style={sharedStyles.cardTitle}>{formatTimeOffRange(request.start_date, request.end_date)}</Text>
      <Text style={[styles.status, styles[request.status]]}>{status.label}</Text>
    </View>
    <Text style={styles.detail}>{status.detail}{decisionDate ? ` · ${decisionDate}` : ""}</Text>
    {request.reason ? <View style={styles.section}>
      <Text style={styles.label}>Reason</Text>
      <Text style={sharedStyles.cardText}>{request.reason}</Text>
    </View> : null}
    {request.manager_note && (request.status === "approved" || request.status === "denied") ? <View style={styles.section}>
      <Text style={styles.label}>Manager note</Text>
      <Text style={sharedStyles.cardText}>{request.manager_note}</Text>
    </View> : null}
    {allowCancel && canCancelTimeOff(request) ? <PrimaryButton label="Cancel Request" variant="secondary"
      loading={cancelling} disabled={actionsDisabled} onPress={() => onCancel(request)} /> : null}
  </Card>;
}

const styles = StyleSheet.create({
  heading: { alignItems: "flex-start", gap: spacing.sm },
  status: { borderRadius: 20, fontSize: 13, fontWeight: "800", overflow: "hidden", paddingHorizontal: spacing.sm, paddingVertical: 6 },
  pending: { backgroundColor: "#FFF2CC", color: "#795A00" },
  approved: { backgroundColor: colors.surfaceMuted, color: colors.primary },
  denied: { backgroundColor: colors.dangerBackground, color: colors.danger },
  cancelled: { backgroundColor: colors.surfaceMuted, color: colors.textMuted },
  detail: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  section: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
});
