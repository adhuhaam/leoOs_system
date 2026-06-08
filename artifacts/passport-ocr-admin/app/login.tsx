import { Feather } from "@/components/Icon";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri, useAuthRequest, useAutoDiscovery } from "expo-auth-session";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

WebBrowser.maybeCompleteAuthSession();

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export default function LoginScreen() {
  const colors = useColors();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/api/settings/google-client-ids`)
      .then((r) => r.json())
      .then((data: { googleClientId?: string | null }) => {
        if (data.googleClientId) {
          setGoogleClientId(data.googleClientId);
          setGoogleConfigured(true);
        }
      })
      .catch(() => {
        /* silently ignore — Google Sign-In won't show */
      });
  }, []);

  const discovery = useAutoDiscovery("https://accounts.google.com");

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: googleClientId ?? "",
      redirectUri: makeRedirectUri({ scheme: "com.leo.os" }),
      scopes: ["openid", "profile", "email"],
      responseType: "id_token",
      extraParams: {
        access_type: "online",
        prompt: "consent",
      },
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === "success" && response.params.id_token) {
      const idToken = response.params.id_token;
      setSubmitting(true);
      setError(null);
      loginWithGoogle(idToken)
        .then(() => {
          router.replace("/");
        })
        .catch((err) => {
          const status = (err as { status?: number })?.status;
          if (status === 202) {
            Alert.alert("Account created", "Your account is pending admin approval.");
          } else if (status === 403) {
            setError("Your account is pending approval. Please contact an admin.");
          } else if (status === 400) {
            setError("Google Sign-In is not configured on this server.");
          } else {
            setError("Google sign-in failed. Please try again.");
          }
        })
        .finally(() => {
          setSubmitting(false);
        });
    }
  }, [response]);

  const canGoogle = googleConfigured && request != null;

  async function onSubmit() {
    if (!email.trim() || !password.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password.trim());
      router.replace("/");
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 403) {
        setError("Your account is pending approval. Please contact an admin.");
      } else if (status === 401) {
        setError("Invalid email or password.");
      } else {
        setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !submitting;

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
            <Text style={[styles.wordmark, { color: colors.foreground }]}>LEO ADMIN</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Sign in to your account
            </Text>
          </View>

          {/* Inline error banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
              <Feather name="alert-circle" size={15} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>EMAIL</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="mail" size={17} color={colors.mutedForeground} />
                <TextInput
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
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
              <Text style={[styles.label, { color: colors.mutedForeground }]}>PASSWORD</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="lock" size={17} color={colors.mutedForeground} />
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
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
                { backgroundColor: colors.primary, opacity: !canSubmit ? 0.45 : pressed ? 0.82 : 1 },
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
          </View>

          {/* Google Sign-In */}
          {googleConfigured && (
            <View style={styles.googleWrap}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>
          )}

          {googleConfigured && (
            <Pressable
              onPress={() => {
                if (canGoogle) {
                  promptAsync();
                }
              }}
              disabled={!canGoogle}
              style={({ pressed }) => [
                styles.googleBtn,
                { borderColor: colors.border, opacity: !canGoogle ? 0.5 : pressed ? 0.8 : 1 },
              ]}
            >
              <Image
                source={require("../assets/images/icon.png")}
                style={{ width: 20, height: 20, borderRadius: 10 }}
              />
              <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
                Sign in with Google
              </Text>
            </Pressable>
          )}

          {/* Sign up link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Don't have an account?{" "}
            </Text>
            <Pressable onPress={() => router.push("/signup")}>
              <Text style={[styles.footerLink, { color: colors.foreground }]}>Create account</Text>
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
  wordmark: { fontSize: 30, letterSpacing: -0.5 },
  tagline: { fontSize: 15, },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
    lineHeight: 18,
  },

  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 12, letterSpacing: 0.3 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },

  primaryBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 4 },
  primaryBtnText: { fontSize: 16, },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28, flexWrap: "wrap" },
  footerText: { fontSize: 14, },
  footerLink: { fontSize: 14, },

  googleWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 4 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 4,
  },
  googleBtnText: { fontSize: 16, fontWeight: "600" },
});
