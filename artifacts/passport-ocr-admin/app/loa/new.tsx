import { Feather } from "@expo/vector-icons";
import {
  getListLoaQueryKey,
  type Company,
  type Passport,
  useCreateLoa,
  useListCompanies,
  useListPassports,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

const STEPS = ["Company & Candidate", "Employment Details", "Signatory"] as const;

interface FormData {
  companyId: string;
  passportId: string;
  companyName: string; companyAddress: string; companyEmail: string;
  companyPhone: string; companyCountry: string; companyRegistrationNumber: string;
  candidateName: string; candidateAddress: string; candidateNationality: string;
  candidateDateOfBirth: string; candidatePassportNumber: string; candidateEmergencyContact: string;
  jobTitle: string; workType: string; basicSalary: string;
  salaryPaymentDate: string; workSite: string; dateOfCommence: string;
  jobDescription: string; workingHours: string; workStatus: string; contractDuration: string;
  signatoryName: string; signatoryDesignation: string; signatureDate: string;
}

const DEFAULT_FORM: FormData = {
  companyId: "", passportId: "",
  companyName: "", companyAddress: "", companyEmail: "",
  companyPhone: "", companyCountry: "Maldives", companyRegistrationNumber: "",
  candidateName: "", candidateAddress: "", candidateNationality: "",
  candidateDateOfBirth: "", candidatePassportNumber: "", candidateEmergencyContact: "",
  jobTitle: "", workType: "Full Time", basicSalary: "",
  salaryPaymentDate: "End of each month", workSite: "", dateOfCommence: "Date of Arrival",
  jobDescription: "Job Description will be given at the time of signing the contract",
  workingHours: "09:00 to 17:00 Saturday to Thursday",
  workStatus: "Contract based",
  contractDuration: "Contract will be for 2 years, Probation period is 3 months",
  signatoryName: "", signatoryDesignation: "",
  signatureDate: new Date().toLocaleDateString("en-GB"),
};

function Field({
  label, value, onChangeText, multiline, placeholder, required,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  multiline?: boolean; placeholder?: string; required?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={fieldSt.wrap}>
      <Text style={[fieldSt.label, { color: colors.mutedForeground }]}>
        {label}{required ? " *" : ""}
      </Text>
      <TextInput
        style={[
          fieldSt.input,
          multiline && fieldSt.multilineInput,
          { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const fieldSt = StyleSheet.create({
  wrap: { gap: 5 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  input: { fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  multilineInput: { minHeight: 80, textAlignVertical: "top", paddingTop: 10 },
});

function PickerModal<T>({
  visible, onClose, items, onSelect, keyFn, labelFn, title, searchable,
}: {
  visible: boolean; onClose: () => void; items: T[];
  onSelect: (item: T) => void; keyFn: (i: T) => string;
  labelFn: (i: T) => string; sublabelFn?: (i: T) => string;
  title: string; searchable?: boolean;
}) {
  const colors = useColors();
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? items.filter((i) => labelFn(i).toLowerCase().includes(q.toLowerCase()))
    : items;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[pmSt.root, { backgroundColor: colors.background }]}>
        <View style={[pmSt.header, { borderBottomColor: colors.border }]}>
          <Text style={[pmSt.title, { color: colors.foreground }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={20} color={colors.foreground} /></Pressable>
        </View>
        {searchable && (
          <View style={[pmSt.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[pmSt.searchInput, { color: colors.foreground }]}
              placeholder="Search…"
              placeholderTextColor={colors.mutedForeground}
              value={q} onChangeText={setQ}
              autoFocus
            />
          </View>
        )}
        <FlatList
          data={filtered}
          keyExtractor={keyFn}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onSelect(item); onClose(); setQ(""); }}
              style={({ pressed }) => [pmSt.item, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[pmSt.itemLabel, { color: colors.foreground }]}>{labelFn(item)}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}
const pmSt = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  item: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  itemLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
});

export default function NewLoaScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [showCandidatePicker, setShowCandidatePicker] = useState(false);

  const { data: companiesRaw } = useListCompanies();
  const { data: passportsRaw } = useListPassports();
  const companies = (companiesRaw ?? []) as Company[];
  const passports = (passportsRaw ?? []) as Passport[];

  const selectedCompany = useMemo(() => companies.find((c) => String(c.id) === form.companyId), [companies, form.companyId]);
  const selectedPassport = useMemo(() => passports.find((p) => String(p.id) === form.passportId), [passports, form.passportId]);

  function set(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyCompany(company: Company) {
    setForm((f) => ({
      ...f,
      companyId: String(company.id),
      companyName: company.name ?? "",
      companyAddress: company.address ?? "",
      companyEmail: company.email ?? "",
      companyPhone: company.phone ?? "",
      companyCountry: company.country ?? "Maldives",
      companyRegistrationNumber: company.registrationNumber ?? "",
    }));
  }

  function applyPassport(p: Passport) {
    setForm((f) => ({
      ...f,
      passportId: String(p.id),
      candidateName: p.fullName ?? "",
      candidateNationality: p.nationality ?? "",
      candidateDateOfBirth: p.dateOfBirth ?? "",
      candidatePassportNumber: p.passportNumber ?? "",
      candidateAddress: p.address ?? "",
    }));
  }

  const createMutation = useCreateLoa({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLoaQueryKey() });
        router.replace("/loa" as never);
      },
      onError: (err: Error) => Alert.alert("Failed to create LOA", err.message),
    },
  });

  function validateStep(): boolean {
    if (step === 0 && !form.companyId) {
      Alert.alert("Select a company before continuing.");
      return false;
    }
    if (step === 0 && !form.passportId) {
      Alert.alert("Select a candidate before continuing.");
      return false;
    }
    return true;
  }

  function handleNext() {
    if (!validateStep()) return;
    if (step < 2) setStep((s) => s + 1);
    else handleSubmit();
  }

  function handleSubmit() {
    createMutation.mutate({
      data: {
        companyId: form.companyId ? parseInt(form.companyId, 10) : undefined,
        passportId: form.passportId ? parseInt(form.passportId, 10) : undefined,
        companyName: form.companyName || undefined,
        companyAddress: form.companyAddress || undefined,
        companyEmail: form.companyEmail || undefined,
        companyPhone: form.companyPhone || undefined,
        companyCountry: form.companyCountry || undefined,
        companyRegistrationNumber: form.companyRegistrationNumber || undefined,
        candidateName: form.candidateName || undefined,
        candidateAddress: form.candidateAddress || undefined,
        candidateNationality: form.candidateNationality || undefined,
        candidateDateOfBirth: form.candidateDateOfBirth || undefined,
        candidatePassportNumber: form.candidatePassportNumber || undefined,
        candidateEmergencyContact: form.candidateEmergencyContact || undefined,
        jobTitle: form.jobTitle || undefined,
        workType: form.workType || undefined,
        basicSalary: form.basicSalary || undefined,
        salaryPaymentDate: form.salaryPaymentDate || undefined,
        workSite: form.workSite || undefined,
        dateOfCommence: form.dateOfCommence || undefined,
        jobDescription: form.jobDescription || undefined,
        workingHours: form.workingHours || undefined,
        workStatus: form.workStatus || undefined,
        contractDuration: form.contractDuration || undefined,
        signatoryName: form.signatoryName || undefined,
        signatoryDesignation: form.signatoryDesignation || undefined,
        signatureDate: form.signatureDate || undefined,
      },
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Step indicator */}
      <View style={[styles.stepBar, { borderBottomColor: colors.border }]}>
        {STEPS.map((label, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <React.Fragment key={label}>
              {i > 0 && (
                <View style={[styles.stepLine, { backgroundColor: done ? colors.primary : colors.border }]} />
              )}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  active && { backgroundColor: colors.primary },
                  done && { backgroundColor: colors.primary },
                  !active && !done && { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 },
                ]}>
                  {done
                    ? <Feather name="check" size={12} color="#fff" />
                    : <Text style={[styles.stepNum, { color: active ? "#fff" : colors.mutedForeground }]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[styles.stepLabel, { color: active ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 1: Company & Candidate */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Select Company</Text>
            <Pressable
              onPress={() => setShowCompanyPicker(true)}
              style={[styles.pickerBtn, { backgroundColor: colors.card, borderColor: selectedCompany ? colors.primary : colors.border }]}
            >
              <Feather name="briefcase" size={16} color={selectedCompany ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.pickerText, { color: selectedCompany ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                {selectedCompany?.name ?? "Choose a company…"}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            {selectedCompany && (
              <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
                {form.companyAddress ? <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{form.companyAddress}</Text> : null}
                {form.companyEmail ? <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{form.companyEmail}</Text> : null}
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Select Candidate</Text>
            <Pressable
              onPress={() => setShowCandidatePicker(true)}
              style={[styles.pickerBtn, { backgroundColor: colors.card, borderColor: selectedPassport ? colors.primary : colors.border }]}
            >
              <Feather name="user" size={16} color={selectedPassport ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.pickerText, { color: selectedPassport ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                {selectedPassport?.fullName ?? "Choose a candidate…"}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            {selectedPassport && (
              <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                  {selectedPassport.passportNumber ?? ""} {selectedPassport.nationality ? `· ${selectedPassport.nationality}` : ""}
                </Text>
              </View>
            )}

            <Field label="Emergency Contact" value={form.candidateEmergencyContact} onChangeText={(v) => set("candidateEmergencyContact", v)} />
          </View>
        )}

        {/* Step 2: Employment Details */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Field label="Job Title" value={form.jobTitle} onChangeText={(v) => set("jobTitle", v)} required />
            <Field label="Work Type" value={form.workType} onChangeText={(v) => set("workType", v)} />
            <Field label="Basic Salary (MVR)" value={form.basicSalary} onChangeText={(v) => set("basicSalary", v)} />
            <Field label="Salary Payment Date" value={form.salaryPaymentDate} onChangeText={(v) => set("salaryPaymentDate", v)} />
            <Field label="Work Site" value={form.workSite} onChangeText={(v) => set("workSite", v)} />
            <Field label="Date of Commence" value={form.dateOfCommence} onChangeText={(v) => set("dateOfCommence", v)} />
            <Field label="Job Description" value={form.jobDescription} onChangeText={(v) => set("jobDescription", v)} multiline />
            <Field label="Working Hours" value={form.workingHours} onChangeText={(v) => set("workingHours", v)} />
            <Field label="Work Status" value={form.workStatus} onChangeText={(v) => set("workStatus", v)} />
            <Field label="Contract Duration" value={form.contractDuration} onChangeText={(v) => set("contractDuration", v)} multiline />
          </View>
        )}

        {/* Step 3: Signatory */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Field label="Signature Date (DD/MM/YYYY)" value={form.signatureDate} onChangeText={(v) => set("signatureDate", v)} />

            {/* Summary card */}
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Summary</Text>
              <Text style={[styles.summaryRow, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>Candidate:</Text> {form.candidateName || "—"}
              </Text>
              <Text style={[styles.summaryRow, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>Company:</Text> {form.companyName || "—"}
              </Text>
              <Text style={[styles.summaryRow, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>Job Title:</Text> {form.jobTitle || "—"}
              </Text>
              <Text style={[styles.summaryRow, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>Salary:</Text> {form.basicSalary || "—"}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => step === 0 ? router.back() : setStep((s) => s - 1)}
          style={[styles.navBtn, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.navBtnText, { color: colors.foreground }]}>
            {step === 0 ? "Cancel" : "Back"}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleNext}
          disabled={createMutation.isPending}
          style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: colors.primary, opacity: createMutation.isPending ? 0.6 : 1 }]}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.navBtnTextPrimary}>
                {step === 2 ? "Create LOA" : "Next →"}
              </Text>
          }
        </Pressable>
      </View>

      {/* Pickers */}
      <PickerModal
        visible={showCompanyPicker}
        onClose={() => setShowCompanyPicker(false)}
        items={companies}
        onSelect={applyCompany}
        keyFn={(c) => String(c.id)}
        labelFn={(c) => c.name ?? ""}
        title="Select Company"
        searchable
      />
      <PickerModal
        visible={showCandidatePicker}
        onClose={() => setShowCandidatePicker(false)}
        items={passports}
        onSelect={applyPassport}
        keyFn={(p) => String(p.id)}
        labelFn={(p) => p.fullName ?? `#${p.id}`}
        title="Select Candidate"
        searchable
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepItem: { alignItems: "center", gap: 4, flex: 1 },
  stepLine: { height: 2, width: 20, borderRadius: 1 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 12, fontFamily: "Inter_700Bold" },
  stepLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },

  container: { padding: 20, paddingBottom: 20 },
  stepContent: { gap: 16 },

  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickerText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  infoBox: { padding: 12, borderRadius: 10, gap: 2 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  summaryCard: { borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, marginTop: 8 },
  summaryTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  summaryRow: { fontSize: 13, fontFamily: "Inter_400Regular" },

  bottomBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnPrimary: {},
  navBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  navBtnTextPrimary: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
