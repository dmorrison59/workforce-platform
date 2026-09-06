import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { LoadingScreen } from "@/components/loading-screen";
import { PrimaryButton } from "@/components/primary-button";
import { colors, spacing } from "@/theme";

export default function SignInRoute() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  if (auth.status === "loading") return <LoadingScreen label="Signing you in…" />;
  if (auth.status === "ready") return <Redirect href="/(crew)/today" />;
  if (auth.status === "error") return <Redirect href="/" />;

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>YardClock Crew</Text>
          <Text style={styles.title}>Your workday, at a glance.</Text>
          <Text style={styles.description}>Sign in with the YardClock account your manager invited.</Text>
        </View>

        <View style={styles.form}>
          {auth.error ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{auth.error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={(value) => {
                auth.clearError();
                setEmail(value);
              }}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordInput}>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="current-password"
                onChangeText={(value) => {
                  auth.clearError();
                  setPassword(value);
                }}
                onSubmitEditing={() => {
                  if (canSubmit) void auth.signIn(email, password);
                }}
                placeholder="Your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!passwordVisible}
                style={[styles.input, styles.passwordTextInput]}
                textContentType="password"
                value={password}
              />
              <Pressable
                accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setPasswordVisible((visible) => !visible)}
                style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}
              >
                <Text style={styles.passwordToggleText}>{passwordVisible ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>
          </View>

          <PrimaryButton
            disabled={!canSubmit}
            label="Sign in"
            onPress={() => void auth.signIn(email, password)}
          />
          <Text style={styles.help}>Need access? Ask your YardClock manager to invite your employee email.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  intro: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 42,
  },
  description: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  passwordInput: {
    justifyContent: "center",
    position: "relative",
  },
  passwordTextInput: {
    paddingRight: 76,
  },
  passwordToggle: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 56,
    paddingHorizontal: spacing.sm,
    position: "absolute",
    right: spacing.xs,
  },
  passwordTogglePressed: {
    backgroundColor: colors.surfaceMuted,
  },
  passwordToggleText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  errorBox: {
    backgroundColor: colors.dangerBackground,
    borderRadius: 12,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  help: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
