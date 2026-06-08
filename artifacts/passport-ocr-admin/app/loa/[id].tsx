import { Feather } from "@expo/vector-icons";
import {
  getListLoaQueryKey,
  type Loa,
  useDeleteLoa,
  useGetLoa,
  useUpdateLoa,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

function Field({
  label,
  value,
  onChangeText,
  editing,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  editing: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  const colors = useColors();
  if (!editing && !value) return null;
  return (
    <View style={fieldStyles.wrap}>
      <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {editing ? (
        <TextInput
          style={[
            fieldStyles.input,
            multiline && fieldStyles.multilineInput,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor={colors.mutedForeground}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      ) : (
        <Text style={[fieldStyles.value, { color: colors.foreground }]}>{value}</Text>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  value: { fontSize: 15, fontFamily: "Inter_400Regular" },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: { minHeight: 80, textAlignVertical: "top", paddingTop: 10 },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={sectionStyles.wrap}>
      <Text style={[sectionStyles.title, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[sectionStyles.card, { backgroundColor: colors.card, shadowColor: "#000" }]}>
        {children}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 4 },
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
});

type FormState = {
  companyName: string; companyAddress: string; companyEmail: string;
  companyPhone: string; companyCountry: string; companyRegistrationNumber: string;
  candidateName: string; candidateAddress: string; candidateNationality: string;
  candidateDateOfBirth: string; candidatePassportNumber: string; candidateEmergencyContact: string;
  jobTitle: string; workType: string; basicSalary: string;
  salaryPaymentDate: string; workSite: string; dateOfCommence: string;
  jobDescription: string; workingHours: string; workStatus: string; contractDuration: string;
  signatoryName: string; signatoryDesignation: string; signatureDate: string;
};

function loaToForm(loa: Loa): FormState {
  const s = (v: string | null | undefined) => v ?? "";
  return {
    companyName: s(loa.companyName), companyAddress: s(loa.companyAddress),
    companyEmail: s(loa.companyEmail), companyPhone: s(loa.companyPhone),
    companyCountry: s(loa.companyCountry), companyRegistrationNumber: s(loa.companyRegistrationNumber),
    candidateName: s(loa.candidateName), candidateAddress: s(loa.candidateAddress),
    candidateNationality: s(loa.candidateNationality), candidateDateOfBirth: s(loa.candidateDateOfBirth),
    candidatePassportNumber: s(loa.candidatePassportNumber), candidateEmergencyContact: s(loa.candidateEmergencyContact),
    jobTitle: s(loa.jobTitle), workType: s(loa.workType), basicSalary: s(loa.basicSalary),
    salaryPaymentDate: s(loa.salaryPaymentDate), workSite: s(loa.workSite),
    dateOfCommence: s(loa.dateOfCommence), jobDescription: s(loa.jobDescription),
    workingHours: s(loa.workingHours), workStatus: s(loa.workStatus),
    contractDuration: s(loa.contractDuration), signatoryName: s(loa.signatoryName),
    signatoryDesignation: s(loa.signatoryDesignation), signatureDate: s(loa.signatureDate),
  };
}

export default function LoaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loaId = parseInt(id ?? "", 10);
  const colors = useColors();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  const { data, isLoading } = useGetLoa(loaId);
  const loa = data as Loa | undefined;

  useEffect(() => {
    if (loa && !form) setForm(loaToForm(loa));
  }, [loa]);

  const updateMutation = useUpdateLoa({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListLoaQueryKey() });
        setEditing(false);
        if (Platform.OS !== "web") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const deleteMutation = useDeleteLoa({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListLoaQueryKey() });
        router.back();
      },
    },
  });

  function set(key: keyof FormState, value: string) {
    setForm((f) => f ? { ...f, [key]: value } : f);
  }

  function handleSave() {
    if (!form) return;
    updateMutation.mutate({ id: loaId, data: form });
  }

  function handleDelete() {
    Alert.alert("Delete LOA?", "This will permanently remove this appointment letter.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate({ id: loaId }) },
    ]);
  }

  if (isLoading || !loa || !form) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
          {isLoading ? "Loading…" : "LOA not found"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Action bar */}
      <View style={[styles.actionBar, { borderBottomColor: colors.border }]}>
        {editing ? (
          <>
            <Pressable
              onPress={() => { setForm(loaToForm(loa)); setEditing(false); }}
              style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
            >
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={updateMutation.isPending}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                {updateMutation.isPending ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={handleDelete}
              style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
              <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Delete</Text>
            </Pressable>
            <Pressable
              onPress={() => setEditing(true)}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="edit-2" size={14} color="#fff" />
              <Text style={[styles.actionBtnText, { color: "#fff" }]}>Edit</Text>
            </Pressable>
          </>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Employer">
          <Field label="Company Name" value={form.companyName} onChangeText={(v) => set("companyName", v)} editing={editing} />
          <Field label="Address" value={form.companyAddress} onChangeText={(v) => set("companyAddress", v)} editing={editing} multiline />
          <Field label="Email" value={form.companyEmail} onChangeText={(v) => set("companyEmail", v)} editing={editing} />
          <Field label="Phone" value={form.companyPhone} onChangeText={(v) => set("companyPhone", v)} editing={editing} />
          <Field label="Country" value={form.companyCountry} onChangeText={(v) => set("companyCountry", v)} editing={editing} />
          <Field label="Registration No." value={form.companyRegistrationNumber} onChangeText={(v) => set("companyRegistrationNumber", v)} editing={editing} />
        </Section>

        <Section title="Candidate">
          <Field label="Name" value={form.candidateName} onChangeText={(v) => set("candidateName", v)} editing={editing} />
          <Field label="Address" value={form.candidateAddress} onChangeText={(v) => set("candidateAddress", v)} editing={editing} multiline />
          <Field label="Nationality" value={form.candidateNationality} onChangeText={(v) => set("candidateNationality", v)} editing={editing} />
          <Field label="Date of Birth" value={form.candidateDateOfBirth} onChangeText={(v) => set("candidateDateOfBirth", v)} editing={editing} />
          <Field label="Passport No." value={form.candidatePassportNumber} onChangeText={(v) => set("candidatePassportNumber", v)} editing={editing} />
          <Field label="Emergency Contact" value={form.candidateEmergencyContact} onChangeText={(v) => set("candidateEmergencyContact", v)} editing={editing} />
        </Section>

        <Section title="Employment">
          <Field label="Job Title" value={form.jobTitle} onChangeText={(v) => set("jobTitle", v)} editing={editing} />
          <Field label="Work Type" value={form.workType} onChangeText={(v) => set("workType", v)} editing={editing} />
          <Field label="Basic Salary" value={form.basicSalary} onChangeText={(v) => set("basicSalary", v)} editing={editing} />
          <Field label="Salary Payment Date" value={form.salaryPaymentDate} onChangeText={(v) => set("salaryPaymentDate", v)} editing={editing} />
          <Field label="Work Site" value={form.workSite} onChangeText={(v) => set("workSite", v)} editing={editing} />
          <Field label="Date of Commence" value={form.dateOfCommence} onChangeText={(v) => set("dateOfCommence", v)} editing={editing} />
          <Field label="Job Description" value={form.jobDescription} onChangeText={(v) => set("jobDescription", v)} editing={editing} multiline />
          <Field label="Working Hours" value={form.workingHours} onChangeText={(v) => set("workingHours", v)} editing={editing} />
          <Field label="Work Status" value={form.workStatus} onChangeText={(v) => set("workStatus", v)} editing={editing} />
          <Field label="Contract Duration" value={form.contractDuration} onChangeText={(v) => set("contractDuration", v)} editing={editing} multiline />
        </Section>

        <Section title="Signatory">
          <Field label="Name" value={form.signatoryName} onChangeText={(v) => set("signatoryName", v)} editing={editing} />
          <Field label="Designation" value={form.signatoryDesignation} onChangeText={(v) => set("signatoryDesignation", v)} editing={editing} />
          <Field label="Signature Date" value={form.signatureDate} onChangeText={(v) => set("signatureDate", v)} editing={editing} />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  actionBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: "flex-end",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  container: { padding: 20, gap: 24, paddingBottom: 40 },
});
