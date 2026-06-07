import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCompaniesQueryKey,
  type Company,
  useListCompanies,
  useUpdateCompany,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useColors } from "@/hooks/useColors";

type EditableField =
  | "name"
  | "address"
  | "email"
  | "phone"
  | "country"
  | "registrationNumber"
  | "signatoryName"
  | "signatoryDesignation";

const FIELDS: { key: EditableField; label: string; multiline?: boolean; keyboard?: "email-address" | "phone-pad" }[] = [
  { key: "name", label: "Company name" },
  { key: "address", label: "Address", multiline: true },
  { key: "email", label: "Email", keyboard: "email-address" },
  { key: "phone", label: "Phone", keyboard: "phone-pad" },
  { key: "country", label: "Country" },
  { key: "registrationNumber", label: "Registration number" },
  { key: "signatoryName", label: "Signatory name" },
  { key: "signatoryDesignation", label: "Signatory designation" },
];

type FormState = Record<EditableField, string>;

const EMPTY_FORM: FormState = {
  name: "",
  address: "",
  email: "",
  phone: "",
  country: "",
  registrationNumber: "",
  signatoryName: "",
  signatoryDesignation: "",
};

function toForm(c: Company): FormState {
  return {
    name: c.name ?? "",
    address: c.address ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    country: c.country ?? "",
    registrationNumber: c.registrationNumber ?? "",
    signatoryName: c.signatoryName ?? "",
    signatoryDesignation: c.signatoryDesignation ?? "",
  };
}

export default function CompanyEditScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const companyId = Number(rawId);

  const { data: companies = [], isLoading, isError, refetch } = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey() },
  });

  const company = useMemo(
    () => (companies as Company[]).find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  );

  const updateMutation = useUpdateCompany();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (company && !dirty) setForm(toForm(company));
  }, [company, dirty]);

  function setField(key: EditableField, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!company || !dirty) return;
    if (!form.name.trim()) {
      Alert.alert("Required", "Company name is required.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: companyId,
        data: {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          country: form.country.trim() || undefined,
          registrationNumber: form.registrationNumber.trim() || undefined,
          signatoryName: form.signatoryName.trim() || undefined,
          signatoryDesignation: form.signatoryDesignation.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      setDirty(false);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Saved", "Company updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Company" }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !company) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Company" }} />
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Company not found</Text>
        <Pressable
          onPress={() => refetch()}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: company.name ?? "Company" }} />

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            {field.label.toUpperCase()}
          </Text>
          <TextInput
            value={form[field.key]}
            onChangeText={(v) => setField(field.key, v)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.mutedForeground}
            multiline={field.multiline}
            keyboardType={field.keyboard ?? "default"}
            autoCapitalize={field.keyboard === "email-address" ? "none" : "words"}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                color: colors.foreground,
                borderColor: colors.border,
                minHeight: field.multiline ? 80 : 48,
                textAlignVertical: field.multiline ? "top" : "center",
              },
            ]}
          />
        </View>
      ))}

      <Pressable
        onPress={handleSave}
        disabled={!dirty || updateMutation.isPending}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: colors.primary,
            opacity: !dirty || updateMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {updateMutation.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="save" size={18} color={colors.primaryForeground} />
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Save changes
            </Text>
          </>
        )}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  primaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
