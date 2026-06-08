import { Feather } from "@/components/Icon";
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

import {
  getGetSystemSettingsQueryKey,
  useGetSystemSettings,
  useUpdateSystemSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

type Draft = {
  appName: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyRegistrationNumber: string;
  openaiApiKey: string;
};

const EMPTY: Draft = {
  appName: "",
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  companyRegistrationNumber: "",
  openaiApiKey: "",
};

export default function SystemSettingsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const isSuperuser = user?.role === "superuser";

  const { data, isLoading } = useGetSystemSettings({
    query: {
      queryKey: getGetSystemSettingsQueryKey(),
      enabled: isSuperuser,
      staleTime: 30_000,
    },
  });

  const updateMutation = useUpdateSystemSettings();

  useEffect(() => {
    if (!data) return;
    const s = data as {
      appName?: string | null;
      companyName?: string | null;
      companyAddress?: string | null;
      companyPhone?: string | null;
      companyEmail?: string | null;
      companyWebsite?: string | null;
      companyRegistrationNumber?: string | null;
      hasOpenAiApiKey?: boolean;
    };
    setDraft({
      appName: s.appName ?? "",
      companyName: s.companyName ?? "",
      companyAddress: s.companyAddress ?? "",
      companyPhone: s.companyPhone ?? "",
      companyEmail: s.companyEmail ?? "",
      companyWebsite: s.companyWebsite ?? "",
      companyRegistrationNumber: s.companyRegistrationNumber ?? "",
      openaiApiKey: "",
    });
    setDirty(false);
  }, [data]);

  function set(field: keyof Draft) {
    return (v: string) => {
      setDraft((d) => ({ ...d, [field]: v }));
      setDirty(true);
    };
  }

  async function save() {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        appName: draft.appName.trim() || "LEO OS",
        companyName: draft.companyName.trim() || null,
        companyAddress: draft.companyAddress.trim() || null,
        companyPhone: draft.companyPhone.trim() || null,
        companyEmail: draft.companyEmail.trim() || null,
        companyWebsite: draft.companyWebsite.trim() || null,
        companyRegistrationNumber: draft.companyRegistrationNumber.trim() || null,
      };
      if (draft.openaiApiKey.trim()) {
        patch.openaiApiKey = draft.openaiApiKey.trim();
      }
      await updateMutation.mutateAsync({ data: patch });
      await qc.invalidateQueries({ queryKey: getGetSystemSettingsQueryKey() });
      setDirty(false);
      setDraft((d) => ({ ...d, openaiApiKey: "" }));
    } catch {
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperuser) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>System Settings</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}>
          <Feather name="lock" size={32} color={colors.mutedForeground} />
          <Text style={[styles.restrictedText, { color: colors.mutedForeground }]}>
            Superuser access only
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>System Settings</Text>
          <Pressable
            onPress={save}
            disabled={!dirty || saving}
            hitSlop={10}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.saveBtn,
                  { color: dirty ? colors.primary : colors.mutedForeground },
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Section label="APPLICATION" colors={colors}>
              <Field
                label="App Name"
                value={draft.appName}
                onChangeText={set("appName")}
                placeholder="LEO OS"
                colors={colors}
              />
            </Section>

            <Section label="ORGANISATION" colors={colors}>
              <Field
                label="Company Name"
                value={draft.companyName}
                onChangeText={set("companyName")}
                placeholder="Your company name"
                colors={colors}
              />
              <Field
                label="Address"
                value={draft.companyAddress}
                onChangeText={set("companyAddress")}
                placeholder="Street, City, Country"
                multiline
                colors={colors}
              />
              <Field
                label="Phone"
                value={draft.companyPhone}
                onChangeText={set("companyPhone")}
                placeholder="+960 xxx-xxxx"
                keyboardType="phone-pad"
                colors={colors}
              />
              <Field
                label="Email"
                value={draft.companyEmail}
                onChangeText={set("companyEmail")}
                placeholder="info@company.com"
                keyboardType="email-address"
                colors={colors}
              />
              <Field
                label="Website"
                value={draft.companyWebsite}
                onChangeText={set("companyWebsite")}
                placeholder="https://company.com"
                keyboardType="url"
                colors={colors}
              />
              <Field
                label="Registration Number"
                value={draft.companyRegistrationNumber}
                onChangeText={set("companyRegistrationNumber")}
                placeholder="e.g. C-12345"
                colors={colors}
                last
              />
            </Section>

            <Section label="AI / API" colors={colors}>
              <Field
                label="OpenAI API Key"
                value={draft.openaiApiKey}
                onChangeText={set("openaiApiKey")}
                placeholder={
                  (data as { hasOpenAiApiKey?: boolean })?.hasOpenAiApiKey
                    ? "••••••••••••  (set — enter new key to replace)"
                    : "sk-... (optional, overrides built-in AI)"
                }
                autoCapitalize="none"
                colors={colors}
                last
              />
            </Section>

            {dirty && (
              <Pressable
                onPress={save}
                disabled={saving}
                style={[styles.saveBar, { backgroundColor: colors.primary }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBarText}>Save Changes</Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
        {children}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  colors,
  last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "url";
  autoCapitalize?: "none" | "sentences" | "words";
  colors: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.fieldWrap,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          { color: colors.foreground },
          multiline && styles.fieldMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
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
  headerTitle: { fontSize: 17, },
  saveBtn: { fontSize: 15, },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  restrictedText: { fontSize: 15, },
  body: { padding: 20, gap: 4, paddingBottom: 40 },
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  sectionCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldLabel: { fontSize: 11, marginBottom: 4 },
  fieldInput: { fontSize: 15, minHeight: 24 },
  fieldMultiline: { minHeight: 64, textAlignVertical: "top" },
  saveBar: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBarText: { fontSize: 15, color: "#fff" },
});
