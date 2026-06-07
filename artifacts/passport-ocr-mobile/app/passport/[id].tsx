import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPassportQueryKey,
  getGetXpatWorkPermitQueryKey,
  type Passport,
  useDeletePassport,
  useGetPassport,
  useGetXpatWorkPermit,
  useUpdatePassport,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useColors } from "@/hooks/useColors";

// ─── Status definitions ───────────────────────────────────────────────────────

export type PassportStatus =
  | "processing"
  | "failed"
  | "completed"
  | "applied"
  | "approved"
  | "ticket_issued"
  | "arrived"
  | "handed_over"
  | "returned_from_worksite"
  | "incomplete"
  | "cancelled"
  | "terminated"
  | "lost"
  | "employed";

export const STATUS_META: Record<
  PassportStatus,
  { label: string; color: string; icon: React.ComponentProps<typeof Feather>["name"] }
> = {
  processing:              { label: "Processing",               color: "#6b7280", icon: "loader" },
  failed:                  { label: "Failed",                   color: "#ef4444", icon: "alert-octagon" },
  completed:               { label: "Completed",                color: "#10b981", icon: "check-circle" },
  applied:                 { label: "Applied",                  color: "#3b82f6", icon: "file-text" },
  approved:                { label: "Approved",                 color: "#8b5cf6", icon: "check-square" },
  ticket_issued:           { label: "Ticket Issued",            color: "#f59e0b", icon: "credit-card" },
  arrived:                 { label: "Arrived",                  color: "#14b8a6", icon: "map-pin" },
  handed_over:             { label: "Handed Over",              color: "#06b6d4", icon: "user-check" },
  returned_from_worksite:  { label: "Returned from Worksite",   color: "#f97316", icon: "corner-up-left" },
  incomplete:              { label: "Incomplete",               color: "#d97706", icon: "alert-triangle" },
  cancelled:               { label: "Cancelled",                color: "#9ca3af", icon: "x-circle" },
  terminated:              { label: "Terminated",               color: "#dc2626", icon: "slash" },
  lost:                    { label: "Lost",                     color: "#7c3aed", icon: "help-circle" },
  employed:                { label: "Employed",                 color: "#059669", icon: "briefcase" },
};

const ALL_STATUSES = Object.keys(STATUS_META) as PassportStatus[];

// ─── Field definitions ────────────────────────────────────────────────────────

type EditableField =
  | "fullName"
  | "passportNumber"
  | "dateOfBirth"
  | "dateOfIssue"
  | "dateOfExpiry"
  | "nationality"
  | "address"
  | "agent"
  | "workPermitNumber";

const PASSPORT_FIELDS: { key: EditableField; label: string; multiline?: boolean; hint?: string }[] = [
  { key: "fullName",        label: "Full name" },
  { key: "passportNumber",  label: "Passport number" },
  { key: "dateOfBirth",     label: "Date of birth",   hint: "YYYY-MM-DD" },
  { key: "dateOfIssue",     label: "Date of issue",   hint: "YYYY-MM-DD" },
  { key: "dateOfExpiry",    label: "Date of expiry",  hint: "YYYY-MM-DD" },
  { key: "nationality",     label: "Nationality" },
  { key: "address",         label: "Address",         multiline: true },
  { key: "agent",           label: "Agent" },
  { key: "workPermitNumber", label: "Work permit number" },
];

type FormState = Record<EditableField, string>;

const EMPTY_FORM: FormState = {
  fullName: "",
  passportNumber: "",
  dateOfBirth: "",
  dateOfIssue: "",
  dateOfExpiry: "",
  nationality: "",
  address: "",
  agent: "",
  workPermitNumber: "",
};

function toForm(p: Passport): FormState {
  return {
    fullName:         p.fullName          ?? "",
    passportNumber:   p.passportNumber    ?? "",
    dateOfBirth:      p.dateOfBirth       ?? "",
    dateOfIssue:      p.dateOfIssue       ?? "",
    dateOfExpiry:     p.dateOfExpiry      ?? "",
    nationality:      p.nationality       ?? "",
    address:          p.address           ?? "",
    agent:            p.agent             ?? "",
    workPermitNumber: p.workPermitNumber  ?? "",
  };
}

// ─── Status picker modal ──────────────────────────────────────────────────────

function StatusPicker({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: PassportStatus;
  onSelect: (s: PassportStatus) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
        <View style={[styles.pickerHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Set status</Text>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {ALL_STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const selected = s === current;
            return (
              <Pressable
                key={s}
                onPress={() => { onSelect(s); onClose(); }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  {
                    borderColor: colors.border,
                    backgroundColor: selected
                      ? `${meta.color}18`
                      : pressed ? colors.secondary : "transparent",
                  },
                ]}
              >
                <Feather name={meta.icon} size={18} color={meta.color} />
                <Text style={[styles.pickerLabel, { color: meta.color, fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium" }]}>
                  {meta.label}
                </Text>
                {selected && <Feather name="check" size={16} color={meta.color} style={{ marginLeft: "auto" }} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Info row (read-only) ─────────────────────────────────────────────────────

function InfoRow({ label, value, color }: { label: string; value?: string | null; color?: string }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: color ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

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
  const [status, setStatus] = useState<PassportStatus>("processing");
  const [statusDirty, setStatusDirty] = useState(false);
  const [fieldsDirty, setFieldsDirty] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const dirty = fieldsDirty || statusDirty;

  useEffect(() => {
    if (data) {
      if (!fieldsDirty) setForm(toForm(data));
      if (!statusDirty) setStatus((data.status as PassportStatus) ?? "processing");
    }
  }, [data, fieldsDirty, statusDirty]);

  // ── Xpat work permit data ──
  const wp  = data?.workPermitNumber ?? "";
  const pp  = data?.passportNumber   ?? "";
  const hasXpat = wp.length > 0 && pp.length > 0;

  const xpatParams = { workPermitNumber: wp, passportNumber: pp };
  const { data: xpat, isLoading: xpatLoading } = useGetXpatWorkPermit(xpatParams, {
    query: {
      enabled: hasXpat,
      staleTime: 5 * 60_000,
      queryKey: getGetXpatWorkPermitQueryKey(xpatParams),
    },
  });

  const currentStatusMeta = useMemo(() => STATUS_META[status] ?? STATUS_META.processing, [status]);

  function setField(key: EditableField, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldsDirty(true);
  }

  async function handleSave() {
    if (!data || !dirty) return;
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          fullName:         form.fullName         || undefined,
          passportNumber:   form.passportNumber   || undefined,
          dateOfBirth:      form.dateOfBirth      || undefined,
          dateOfIssue:      form.dateOfIssue      || undefined,
          dateOfExpiry:     form.dateOfExpiry     || undefined,
          nationality:      form.nationality      || undefined,
          address:          form.address          || undefined,
          agent:            form.agent            || undefined,
          workPermitNumber: form.workPermitNumber  || undefined,
          status:           statusDirty ? status  : undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/passports"] });
      setFieldsDirty(false);
      setStatusDirty(false);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Saved", "Employee record updated.");
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  function handleDelete() {
    Alert.alert("Delete record?", "This will permanently remove this employee record.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id });
            await queryClient.invalidateQueries({ queryKey: ["/api/passports"] });
            if (Platform.OS !== "web") {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            router.back();
          } catch (err) {
            Alert.alert("Delete failed", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  }

  // ── Loading / error states ──
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          {error instanceof Error ? error.message : "Record not found"}
        </Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Status card (tappable) ── */}
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={({ pressed }) => [
            styles.statusCard,
            {
              backgroundColor: `${currentStatusMeta.color}12`,
              borderColor: `${currentStatusMeta.color}40`,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name={currentStatusMeta.icon} size={22} color={currentStatusMeta.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: currentStatusMeta.color }]}>
              {currentStatusMeta.label}
            </Text>
            {data.errorMessage && status === "failed" ? (
              <Text style={[styles.statusDetail, { color: colors.mutedForeground }]}>
                {data.errorMessage}
              </Text>
            ) : data.originalFilename ? (
              <Text style={[styles.statusDetail, { color: colors.mutedForeground }]}>
                {data.originalFilename}
              </Text>
            ) : null}
          </View>
          <Feather name="chevron-down" size={16} color={currentStatusMeta.color} />
        </Pressable>

        {/* ── Xpat section (read-only employer data) ── */}
        {(hasXpat || xpatLoading) && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              IMMIGRATION DATA (XPAT)
            </Text>
            {xpatLoading && !xpat ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
            ) : xpat ? (
              <>
                <InfoRow label="Employer"        value={xpat.employerName} />
                <InfoRow label="WP State"        value={xpat.workPermitStateName} />
                <InfoRow label="WP Expiry"       value={xpat.workPermitExpiry} />
                <InfoRow
                  label="WP Valid"
                  value={xpat.isValid ?? undefined}
                  color={
                    xpat.isValid === "true"  ? "#10b981" :
                    xpat.isValid === "false" ? "#ef4444" : undefined
                  }
                />
                <InfoRow label="Occupation"      value={xpat.occupationName} />
                <InfoRow label="Nationality"     value={xpat.nationality} />
              </>
            ) : (
              <Text style={[styles.noXpat, { color: colors.mutedForeground }]}>
                No Xpat data found for this permit.
              </Text>
            )}
          </View>
        )}

        {/* ── Passport / employee fields ── */}
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>EMPLOYEE DETAILS</Text>

        {PASSPORT_FIELDS.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {field.label.toUpperCase()}
              {field.hint ? <Text style={styles.fieldHint}> · {field.hint}</Text> : null}
            </Text>
            <TextInput
              value={form[field.key]}
              onChangeText={(v) => setField(field.key, v)}
              placeholder={
                status === "processing" ? "Extracting…" : `Enter ${field.label.toLowerCase()}`
              }
              placeholderTextColor={colors.mutedForeground}
              multiline={field.multiline}
              autoCapitalize={field.key === "passportNumber" || field.key === "workPermitNumber" ? "characters" : "words"}
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

        {/* ── Save button ── */}
        <Pressable
          onPress={handleSave}
          disabled={!dirty || updateMutation.isPending}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: colors.primary,
              opacity: !dirty || updateMutation.isPending ? 0.4 : pressed ? 0.85 : 1,
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

        {/* ── Delete button ── */}
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
          <Text style={[styles.destructiveText, { color: colors.destructive }]}>Delete record</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <StatusPicker
        visible={pickerVisible}
        current={status}
        onSelect={(s) => { setStatus(s); setStatusDirty(true); }}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },

  // Status
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  statusLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusDetail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Xpat section
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  sectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  infoValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 2, textAlign: "right" },
  noXpat: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 4 },

  // Fields
  groupLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginTop: 6 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  fieldHint: { fontSize: 10, fontFamily: "Inter_400Regular", letterSpacing: 0 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },

  // Buttons
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

  // Status picker modal
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: {
    maxHeight: "75%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    gap: 4,
  },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  pickerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 12 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  pickerLabel: { fontSize: 14 },

  // Shared
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
