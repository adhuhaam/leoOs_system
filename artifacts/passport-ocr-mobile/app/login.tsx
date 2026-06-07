import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function onSubmit() {
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    try {
      await login(password.trim());
      router.replace("/");
    } catch (err) {
      Alert.alert(
        "Sign in failed",
        err instanceof Error ? err.message : "Invalid credentials.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = password.trim().length > 0 && !submitting;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo + wordmark */}
          <View style={styles.header}>
            <View style={[styles.logoWrap, { backgroundColor: colors.primary }]}>
              <Feather name="shield" size={30} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.wordmark, { color: colors.foreground }]}>
              LEO OS
            </Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Sign in to your account
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Email
              </Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="mail" size={17} color={colors.mutedForeground} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  style={[styles.input, { color: colors.foreground }]}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Password
              </Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="lock" size={17} color={colors.mutedForeground} />
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                  style={[styles.input, { color: colors.foreground }]}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={17}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>

            {/* Sign in button */}
            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: !canSubmit ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                  Sign in
                </Text>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
                or
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Google button (placeholder — wired in RBAC task) */}
            <Pressable
              style={({ pressed }) => [
                styles.googleBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
              onPress={() =>
                Alert.alert(
                  "Coming soon",
                  "Google Sign-In will be available once roles are configured by your admin.",
                )
              }
            >
              <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
                Continue with Google
              </Text>
            </Pressable>
          </View>

          {/* Sign up link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Don't have an account?{" "}
            </Text>
            <Pressable onPress={() => router.push("/signup")}>
              <Text style={[styles.footerLink, { color: colors.foreground }]}>
                Create account
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 28, justifyContent: "center", gap: 8 },

  header: { alignItems: "center", marginBottom: 36, gap: 12 },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  wordmark: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular" },

  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },

  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },

  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
  googleBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28, flexWrap: "wrap" },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
