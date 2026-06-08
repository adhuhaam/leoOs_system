import { Feather } from "@expo/vector-icons";
import {
  getListClientsQueryKey,
  useCreateClient,
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
  { key: "name", label: "Client name", required: true },
  { key: "contactPerson", label: "Contact person" },
  { key: "phone", label: "Phone", keyboard: "phone-pad" },
  { key: "email", label: "Email", keyboard: "email-address" },
  { key: "address", label: "Address", multiline: true },
  { key: "tin", label: "Tax ID (TIN)" },
  { key: "notes", label: "Notes", multiline: true },
];

type FormState = {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  tin: string;
  notes: string;
};

const EMPTY: FormState = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  tin: "",
  notes: "",
};

export default function NewClientScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const createMutation = useCreateClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Required", "Client name is required.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name.trim(),
          contactPerson: form.contactPerson.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          tin: form.tin.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
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
          title: "New Client",
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
              Create client
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
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  saveBtn: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
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
});
