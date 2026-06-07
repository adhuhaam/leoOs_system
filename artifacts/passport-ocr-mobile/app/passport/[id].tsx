import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPassportQueryKey,
  type Passport,
  useDeletePassport,
  useGetPassport,
  useUpdatePassport,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
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
  | "fullName"
  | "passportNumber"
  | "dateOfBirth"
  | "dateOfIssue"
  | "dateOfExpiry"
  | "address"
  | "nationality";

const FIELDS: { key: EditableField; label: string; multiline?: boolean }[] = [
  { key: "fullName", label: "Full name" },
  { key: "passportNumber", label: "Passport number" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "dateOfIssue", label: "Date of issue" },
  { key: "dateOfExpiry", label: "Date of expiry" },
  { key: "nationality", label: "Nationality" },
  { key: "address", label: "Address", multiline: true },
];

type FormState = Record<EditableField, string>;

const EMPTY_FORM: FormState = {
  fullName: "",
  passportNumber: "",
  dateOfBirth: "",
  dateOfIssue: "",
  dateOfExpiry: "",
  address: "",
  nationality: "",
};

function toForm(p: Passport): FormState {
  return {
    fullName: p.fullName ?? "",
    passportNumber: p.passportNumber ?? "",
    dateOfBirth: p.dateOfBirth ?? "",
    dateOfIssue: p.dateOfIssue ?? "",
    dateOfExpiry: p.dateOfExpiry ?? "",
    address: p.address ?? "",
    nationality: p.nationality ?? "",
  };
}

export default function PassportDetailScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);

  const { data, isLoading, isError, error, refetch } = useGetPassport(id, {
    query: {
      enabled: !Number.isNaN(id),
      queryKey: getGetPassportQueryKey(id),
      refetchInterval: (q) => {
        const p = q.state.data as Passport | undefined;
        return p?.status === "processing" ? 2000 : false;
      },
    },
  });

  const updateMutation = useUpdatePassport();
  const deleteMutation = useDeletePassport();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data && !dirty) setForm(toForm(data));
  }, [data, dirty]);

  const status = data?.status ?? "processing";
  const statusMeta = useMemo(() => {
    if (status === "completed")
      return { color: colors.primary, label: "Completed", icon: "check-circle" as const };
    if (status === "failed")
      return { color: colors.destructive, label: "Failed", icon: "alert-octagon" as const };
    return { color: colors.mutedForeground, label: "Processing…", icon: "loader" as const };
  }, [status, colors]);

  function setField(key: EditableField, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!data || !dirty) return;
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          fullName: form.fullName || undefined,
          passportNumber: form.passportNumber || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          dateOfIssue: form.dateOfIssue || undefined,
          dateOfExpiry: form.dateOfExpiry || undefined,
          address: form.address || undefined,
          nationality: form.nationality || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/passports"] });
      setDirty(false);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Saved", "Passport updated.");
    } catch (err) {
      Alert.alert(
        "Save failed",
        err instanceof Error ? err.message : "Please try again.",
      );
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete passport?",
      "This will permanently remove this record.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id });
              await queryClient.invalidateQueries({
                queryKey: ["/api/passports"],
              });
              if (Platform.OS !== "web") {
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
              }
              router.back();
            } catch (err) {
              Alert.alert(
                "Delete failed",
                err instanceof Error ? err.message : "Please try again.",
              );
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          {error instanceof Error ? error.message : "Passport not found"}
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
            Retry
          </Text>
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
      <View
        style={[
          styles.statusCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name={statusMeta.icon} size={20} color={statusMeta.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusLabel, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
          {status === "failed" && data.errorMessage ? (
            <Text style={[styles.statusDetail, { color: colors.mutedForeground }]}>
              {data.errorMessage}
            </Text>
          ) : data.originalFilename ? (
            <Text style={[styles.statusDetail, { color: colors.mutedForeground }]}>
              {data.originalFilename}
            </Text>
          ) : null}
        </View>
      </View>

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            {field.label.toUpperCase()}
          </Text>
          <TextInput
            value={form[field.key]}
            onChangeText={(v) => setField(field.key, v)}
            placeholder={
              status === "processing" ? "Extracting…" : `Enter ${field.label.toLowerCase()}`
            }
            placeholderTextColor={colors.mutedForeground}
            multiline={field.multiline}
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
            <Text
              style={[styles.primaryBtnText, { color: colors.primaryForeground }]}
            >
              Save changes
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={handleDelete}
        disabled={deleteMutation.isPending}
        style={({ pressed }) => [
          styles.destructiveBtn,
          {
            borderColor: colors.destructive,
            opacity: deleteMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="trash-2" size={18} color={colors.destructive} />
        <Text style={[styles.destructiveText, { color: colors.destructive }]}>
          Delete passport
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  statusLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusDetail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
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
  destructiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  destructiveText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
