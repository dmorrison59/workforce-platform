import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { Card, sharedStyles } from "@/components/screen";
import { addDays } from "@/lib/schedule-presentation";
import { formatTimeOffRange, organizationToday, validateTimeOffDraft } from "@/lib/time-off-presentation";
import { colors, spacing } from "@/theme";
import type { TimeOffDraft } from "@/types/time-off";

type Step = "dates" | "reason" | "confirm";

function DateInput({ label, value, onChangeText }: {
  label: string; value: string; onChangeText(value: string): void;
}) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false}
      keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={onChangeText}
      placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.input} value={value} />
  </View>;
}

export function TimeOffRequestForm({ timeZone, submitting, backendError, onClose, onSubmit }: {
  timeZone: string;
  submitting: boolean;
  backendError: string | null;
  onClose(): void;
  onSubmit(draft: TimeOffDraft): Promise<boolean>;
}) {
  const today = useMemo(() => organizationToday(new Date(), timeZone), [timeZone]);
  const [step, setStep] = useState<Step>("dates");
  const [draft, setDraft] = useState<TimeOffDraft>({ startDate: today, endDate: today, reason: "" });
  const [validationError, setValidationError] = useState<string | null>(null);

  const continueFromDates = () => {
    const error = validateTimeOffDraft({ ...draft, reason: "" });
    if (error) return setValidationError(error);
    setValidationError(null);
    setStep("reason");
  };
  const continueFromReason = () => {
    const error = validateTimeOffDraft(draft);
    if (error) return setValidationError(error);
    setValidationError(null);
    setStep("confirm");
  };
  const submit = async () => {
    const error = validateTimeOffDraft(draft);
    if (error) return setValidationError(error);
    setValidationError(null);
    if (await onSubmit({ ...draft, reason: draft.reason.trim() })) onClose();
  };

  return <Card>
    <Text style={styles.step}>Step {step === "dates" ? "1 of 3" : step === "reason" ? "2 of 3" : "3 of 3"}</Text>
    <Text accessibilityRole="header" style={styles.title}>
      {step === "dates" ? "Choose full days" : step === "reason" ? "Add a reason" : "Confirm request"}
    </Text>
    {step === "dates" ? <>
      <Text style={sharedStyles.cardText}>Dates use {timeZone.replace(/_/g, " ")}. YardClock currently supports full-day requests.</Text>
      <DateInput label="Start date" value={draft.startDate}
        onChangeText={(startDate) => setDraft((value) => ({ ...value, startDate }))} />
      <View style={styles.quickRow}>
        <View style={styles.quickButton}><PrimaryButton label="Today" variant="secondary" onPress={() => setDraft((value) => ({ ...value, startDate: today, endDate: value.endDate < today ? today : value.endDate }))} /></View>
        <View style={styles.quickButton}><PrimaryButton label="Tomorrow" variant="secondary" onPress={() => {
          const tomorrow = addDays(today, 1);
          setDraft((value) => ({ ...value, startDate: tomorrow, endDate: value.endDate < tomorrow ? tomorrow : value.endDate }));
        }} /></View>
      </View>
      <DateInput label="End date" value={draft.endDate}
        onChangeText={(endDate) => setDraft((value) => ({ ...value, endDate }))} />
      <PrimaryButton label="Use start date" variant="secondary"
        onPress={() => setDraft((value) => ({ ...value, endDate: value.startDate }))} />
      <PrimaryButton label="Continue" onPress={continueFromDates} />
      <PrimaryButton label="Back to requests" variant="secondary" onPress={onClose} />
    </> : null}
    {step === "reason" ? <>
      <Text style={sharedStyles.cardText}>Optional. Share only what your manager needs to review the request.</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Reason (optional)</Text>
        <TextInput accessibilityLabel="Reason (optional)" maxLength={2000} multiline
          onChangeText={(reason) => setDraft((value) => ({ ...value, reason }))}
          placeholder="Vacation, appointment, personal…" placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.textArea]} textAlignVertical="top" value={draft.reason} />
        <Text style={styles.count}>{draft.reason.length} / 2,000</Text>
      </View>
      <PrimaryButton label="Review Request" onPress={continueFromReason} />
      <PrimaryButton label="Back" variant="secondary" onPress={() => { setValidationError(null); setStep("dates"); }} />
    </> : null}
    {step === "confirm" ? <>
      <Text style={styles.range}>{formatTimeOffRange(draft.startDate, draft.endDate)}</Text>
      <View style={styles.summary}>
        <Text style={styles.label}>Reason</Text>
        <Text style={sharedStyles.cardText}>{draft.reason || "No reason provided"}</Text>
      </View>
      <Text style={sharedStyles.cardText}>Your manager will see this as a Pending request. Approved time off continues to feed the existing scheduling warnings.</Text>
      <PrimaryButton label="Submit Request" loading={submitting} disabled={submitting} onPress={() => void submit()} />
      <PrimaryButton label="Back" variant="secondary" disabled={submitting}
        onPress={() => { setValidationError(null); setStep("reason"); }} />
    </> : null}
    {validationError || backendError ? <Text accessibilityRole="alert" style={styles.error}>{validationError ?? backendError}</Text> : null}
  </Card>;
}

const styles = StyleSheet.create({
  step: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  field: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 14, fontWeight: "800" },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, fontSize: 17, minHeight: 50, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  textArea: { minHeight: 112 },
  count: { color: colors.textMuted, fontSize: 12, textAlign: "right" },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quickButton: { flex: 1 },
  range: { color: colors.text, fontSize: 21, fontWeight: "800", lineHeight: 29 },
  summary: { backgroundColor: colors.background, borderRadius: 12, gap: spacing.xs, padding: spacing.md },
  error: { backgroundColor: colors.dangerBackground, borderRadius: 12, color: colors.danger, fontSize: 14, fontWeight: "700", lineHeight: 20, padding: spacing.md },
});
