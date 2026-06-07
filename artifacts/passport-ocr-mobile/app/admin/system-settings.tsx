import { Feather } from "@expo/vector-icons";
import {
  useGetSystemSettings,
  useUpdateSystemSettings,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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

export default function SystemSettingsScreen() {
  const colors = useColors();
  const { data: settings, isLoading } = useGetSystemSettings();
  const updateMutation = useUpdateSystemSettings();

  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleClientIdIos, setGoogleClientIdIos] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      // We don't pre-fill clientIds from API since they're credentials
      // (the API doesn't expose them in system settings GET)
    }
  }, [settings]);

  async function onSave() {
    setSaving(true);
    try {
      // Only send fields that have values — empty strings are NOT sent so
      // existing keys on the server are preserved rather than overwritten with null.
      const payload: Record<string, string | null> = {};
      if (googleClientId.trim()) payload.googleClientId = googleClientId.trim();
      if (googleClientSecret.trim()) payload.googleClientSecret = googleClientSecret.trim();
      if (googleClientIdIos.trim()) payload.googleClientIdIos = googleClientIdIos.trim();

      await updateMutation.mutateAsync({
        data: payload as Record<string, unknown>,
      });
      Alert.alert("Saved", "Google OAuth credentials have been updated.");
      setGoogleClientSecret("");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>System Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Status */}
              <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>
                    Google Sign-In
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: settings?.hasGoogleSignIn ? "#DCFCE7" : "#FEF2F2" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: settings?.hasGoogleSignIn ? "#16A34A" : "#DC2626" },
                      ]}
                    >
                      {settings?.hasGoogleSignIn ? "Configured" : "Not configured"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Google OAuth */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Google OAuth 2.0
                </Text>
                <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
                  Set the Google OAuth client IDs to enable Google Sign-In on mobile. Leave blank
                  to keep existing values.
                </Text>

                <Field label="Web / Android Client ID" colors={colors}>
                  <TextInput
                    value={googleClientId}
                    onChangeText={setGoogleClientId}
                    placeholder="14635124833-xxxx.apps.googleusercontent.com"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  />
                </Field>

                <Field label="iOS Client ID" colors={colors}>
                  <TextInput
                    value={googleClientIdIos}
                    onChangeText={setGoogleClientIdIos}
                    placeholder="14635124833-xxxx.apps.googleusercontent.com"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  />
                </Field>

                <Field label="Client Secret (optional for Android/iOS)" colors={colors}>
                  <TextInput
                    value={googleClientSecret}
                    onChangeText={setGoogleClientSecret}
                    placeholder="Leave blank to keep existing"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  />
                </Field>
              </View>

              <Pressable
                onPress={onSave}
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: saving ? 0.5 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                    Save Settings
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.3 }}
      >
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  content: { padding: 20, gap: 20, paddingBottom: 40 },

  statusCard: { borderRadius: 14, padding: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  section: { gap: 16 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sectionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },

  saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
