import { useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { sharedStyles } from "@/components/screen";
import { directionsUrls, locationAddress, optionalText, shiftTimeLabel } from "@/lib/schedule-presentation";
import type { CrewShift } from "@/services/crew-schedule";
import { colors, spacing } from "@/theme";

export function ShiftCard({ shift, day, timeZone, prominent = false, label }: {
  shift: CrewShift; day: string; timeZone: string; prominent?: boolean; label?: string;
}) {
  const [opening, setOpening] = useState(false);
  const address = locationAddress(shift.location);
  const name = optionalText(shift.location?.name, 160) ?? "Location details unavailable";
  const details = [optionalText(shift.department?.name, 160), optionalText(shift.role?.name, 160)].filter(Boolean);
  const notes = optionalText(shift.notes, 2000);
  const openDirections = async () => {
    if (!address || opening) return;
    setOpening(true);
    const urls = directionsUrls(address, Platform.OS);
    try {
      try { await Linking.openURL(urls.native); }
      catch { await Linking.openURL(urls.fallback); }
    } catch {
      Alert.alert("Maps couldn’t open", "Please try again, or use the address shown on your shift.");
    } finally { setOpening(false); }
  };

  return (
    <View style={[styles.card, prominent && styles.prominent]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.time}>{shiftTimeLabel(shift.start_at, day, timeZone)}</Text>
      <Text style={sharedStyles.cardText}>Until {shiftTimeLabel(shift.end_at, day, timeZone)}</Text>
      <Text style={styles.site}>{name}</Text>
      {details.length ? <Text style={sharedStyles.cardText}>{details.join(" · ")}</Text> : null}
      <Text selectable style={sharedStyles.cardText}>{address ?? "Address unavailable — check with your manager."}</Text>
      {address ? <PrimaryButton label="Directions" accessibilityLabel={`Directions to ${name}`} loading={opening} onPress={() => void openDirections()} /> : null}
      {notes ? <View style={styles.notes}><Text style={styles.label}>Shift notes</Text><Text style={sharedStyles.cardText}>{notes}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: spacing.lg, gap: spacing.sm },
  prominent: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.surfaceMuted },
  label: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  time: { color: colors.text, fontSize: 32, fontWeight: "800", letterSpacing: -0.6 },
  site: { color: colors.text, fontSize: 23, fontWeight: "700", marginTop: spacing.xs },
  notes: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs },
});
