import { Feather } from "@/components/Icon";
import {
  getListCompaniesQueryKey,
  useCreateCompany,
} from "@workspace/api-client-react";
import { router, Stack } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

type Field = {
  key: keyof FormState;
  label: string;
  required?: boolean;
  multiline?: boolean;
  keyboard?: "email-address" | "phone-pad";
};

const FIELDS: Field[] = [
  { key: "name", label: "Company name", required: true },
  { key: "address", label: "Address", multiline: true },
  { key: "email", label: "Email", keyboard: "email-address" },
  { key: "phone", label: "Phone", keyboard: "phone-pad" },
  { key: "country", label: "Country" },
  { key: "registrationNumber", label: "Registration number" },
  { key: "signatoryName", label: "Signatory name" },
  { key: "signatoryDesignation", label: "Signatory designation" },
  { key: "bankName", label: "Bank name" },
  { key: "bankAccountHolder", label: "Account holder" },
  { key: "bankAccountNumber", label: "Account number" },
  { key: "bankSwiftCode", label: "SWIFT / BIC code" },
];

type FormState = {
  name: string;
  address: string;
  email: string;
  phone: string;
  country: string;
  registrationNumber: string;
  signatoryName: string;
  signatoryDesignation: string;
  bankName: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankSwiftCode: string;
};

const EMPTY: FormState = {
  name: "",
  address: "",
  email: "",
  phone: "",
  country: "",
  registrationNumber: "",
  signatoryName: "",
  signatoryDesignation: "",
  bankName: "",
  bankAccountHolder: "",
  bankAccountNumber: "",
  bankSwiftCode: "",
};

export default function NewCompanyScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const createMutation = useCreateCompany();
  const [form, setForm] = useState<FormState>(EMPTY);

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Required", "Company name is required.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          country: form.country.trim() || undefined,
          registrationNumber: form.registrationNumber.trim() || undefined,
          signatoryName: form.signatoryName.trim() || undefined,
          signatoryDesignation: form.signatoryDesignation.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
          bankAccountHolder: form.bankAccountHolder.trim() || undefined,
          bankAccountNumber: form.bankAccountNumber.trim() || undefined,
          bankSwiftCode: form.bankSwiftCode.trim() || undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      router.back();
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: "New Company",
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={createMutation.isPending}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              {createMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
              )}
            </Pressable>
          ),
        }}
      />

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            {field.label.toUpperCase()}
            {field.required && <Text style={{ color: colors.destructive }}> *</Text>}
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
        disabled={createMutation.isPending}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: colors.primary,
            opacity: createMutation.isPending ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Create company
            </Text>
          </>
        )}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 11, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  saveBtn: { fontSize: 16, },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  primaryBtnText: { fontSize: 15, },
});
