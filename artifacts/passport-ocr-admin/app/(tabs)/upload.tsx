import { Feather } from "@/components/Icon";
import {
  useGetPassport,
  useUpdatePassport,
  useListCompanies,
  useListLoaOptions,
  useCreateLoa,
  getGetPassportQueryKey,
  getListLoaOptionsQueryKey,
  type Company,
} from "@workspace/api-client-react";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fileNameFromUri,
  inferMimeType,
  type PickedFile,
  uploadPassportFile,
} from "@/lib/api";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "upload" | "assign" | "done";

interface AssignForm {
  companyId: string;
  emergencyContact: string;
  jobTitle: string;
  workType: string;
  workSite: string;
  basicSalary: string;
  salaryPaymentDate: string;
  workingHours: string;
  workStatus: string;
  contractDuration: string;
  dateOfCommence: string;
  jobDescription: string;
  signatoryName: string;
  signatoryDesignation: string;
  signatureDate: string;
}

const DEFAULT_ASSIGN: AssignForm = {
  companyId: "",
  emergencyContact: "",
  jobTitle: "",
  workType: "",
  workSite: "",
  basicSalary: "",
  salaryPaymentDate: "End of each month",
  workingHours: "09:00 to 17:00 Saturday to Sunday",
  workStatus: "Contract based",
  contractDuration: "Contract will be for 2 years, Probation period is 3 months",
  dateOfCommence: "Date of Arrival",
  jobDescription: "Job Description will be given the time of signing the contract",
  signatoryName: "",
  signatoryDesignation: "",
  signatureDate: new Date().toLocaleDateString("en-GB"),
};

const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: "upload", label: "Upload & Extract" },
  { id: "assign", label: "Assign & Details" },
  { id: "done", label: "Complete" },
];

// ─── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({
  current,
  colors,
}: {
  current: WizardStep;
  colors: ReturnType<typeof useColors>;
}) {
  const idx = WIZARD_STEPS.findIndex((s) => s.id === current);
  return (
    <View style={siStyles.row}>
      {WIZARD_STEPS.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        const bg = active ? colors.primary : done ? colors.primary + "28" : colors.muted;
        const fg = active
          ? colors.primaryForeground
          : done
          ? colors.primary
          : colors.mutedForeground;
        return (
          <React.Fragment key={s.id}>
            <View style={[siStyles.pill, { backgroundColor: bg }]}>
              <View style={[siStyles.badge, { borderColor: fg }]}>
                {done ? (
                  <Feather name="check" size={8} color={fg} />
                ) : (
                  <Text style={[siStyles.num, { color: fg }]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[siStyles.label, { color: fg }]}>{s.label}</Text>
            </View>
            {i < WIZARD_STEPS.length - 1 && (
              <Feather name="chevron-right" size={12} color={colors.mutedForeground} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const siStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  num: { fontSize: 9, },
  label: { fontSize: 11, },
});

// ─── OptionPickerField ────────────────────────────────────────────────────────

function OptionPickerField({
  label,
  value,
  onChange,
  options,
  placeholder,
  isLoading,
  companySelected,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: number; value: string }[];
  placeholder: string;
  isLoading?: boolean;
  companySelected?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const hasOptions = options.length > 0;

  if (isLoading) {
    return (
      <View style={fpStyles.group}>
        <Text style={[fpStyles.label, { color: colors.foreground }]}>{label}</Text>
        <View
          style={[
            fpStyles.selector,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ActivityIndicator size="small" color={colors.mutedForeground} />
          <Text style={[fpStyles.placeholder, { color: colors.mutedForeground }]}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!hasOptions && companySelected) {
    return (
      <View style={fpStyles.group}>
        <Text style={[fpStyles.label, { color: colors.foreground }]}>{label}</Text>
        <TextInput
          style={[
            fpStyles.input,
            {
              backgroundColor: colors.card,
              borderColor: "#fbbf24",
              color: colors.foreground,
            },
          ]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={fpStyles.noOptionsHint}>No options configured — type a custom value.</Text>
      </View>
    );
  }

  return (
    <View style={fpStyles.group}>
      <View style={fpStyles.labelRow}>
        <Text style={[fpStyles.label, { color: colors.foreground }]}>{label}</Text>
        {hasOptions && (
          <Pressable
            onPress={() => {
              setCustomMode((m) => !m);
              if (!customMode) onChange("");
            }}
          >
            <Text style={[fpStyles.toggle, { color: colors.primary }]}>
              {customMode ? "Pick from list" : "Type custom"}
            </Text>
          </Pressable>
        )}
      </View>

      {customMode ? (
        <TextInput
          style={[
            fpStyles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
        />
      ) : (
        <Pressable
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [
            fpStyles.selector,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={[
              value ? fpStyles.value : fpStyles.placeholder,
              {
                color: value ? colors.foreground : colors.mutedForeground,
                flex: 1,
              },
            ]}
            numberOfLines={1}
          >
            {value || `Select ${label.toLowerCase()}…`}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
        </Pressable>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={fpStyles.overlay} onPress={() => setModalVisible(false)}>
          <View
            style={[
              fpStyles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[fpStyles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[fpStyles.sheetTitle, { color: colors.foreground }]}>{label}</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setModalVisible(false);
                  }}
                  style={({ pressed }) => [
                    fpStyles.optionRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.muted : "transparent",
                    },
                  ]}
                >
                  <View style={{ width: 22 }}>
                    {value === item.value && (
                      <Feather name="check" size={14} color={colors.primary} />
                    )}
                  </View>
                  <Text style={[fpStyles.optionText, { color: colors.foreground }]}>
                    {item.value}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const fpStyles = StyleSheet.create({
  group: { gap: 5 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 12, },
  toggle: { fontSize: 11, },
  noOptionsHint: { fontSize: 11, color: "#d97706", },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  value: { fontSize: 14, },
  placeholder: { fontSize: 14, },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, maxHeight: "60%" },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 15, },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: 14, flex: 1 },
});

// ─── TextField ────────────────────────────────────────────────────────────────

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  colors,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  colors: ReturnType<typeof useColors>;
  required?: boolean;
}) {
  return (
    <View style={tfStyles.group}>
      <Text style={[tfStyles.label, { color: colors.foreground }]}>
        {label}
        {required && <Text style={{ color: colors.destructive }}> *</Text>}
      </Text>
      <TextInput
        style={[
          tfStyles.input,
          multiline && tfStyles.multiline,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

const tfStyles = StyleSheet.create({
  group: { gap: 5 },
  label: { fontSize: 12, },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  multiline: { height: 76, paddingTop: 10 },
});

// ─── CompanyPicker ────────────────────────────────────────────────────────────

function CompanyPicker({
  value,
  onChange,
  companies,
  colors,
}: {
  value: string;
  onChange: (id: string, company: Company) => void;
  companies: Company[];
  colors: ReturnType<typeof useColors>;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const selected = companies.find((c) => String(c.id) === value);

  return (
    <View style={cpStyles.group}>
      <Text style={[cpStyles.label, { color: colors.foreground }]}>
        Company (Employer) <Text style={{ color: colors.destructive }}>*</Text>
      </Text>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => [
          cpStyles.selector,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[
              cpStyles.name,
              { color: selected ? colors.foreground : colors.mutedForeground },
            ]}
            numberOfLines={1}
          >
            {selected ? selected.name : "Select a company…"}
          </Text>
          {selected?.address && (
            <Text
              style={[cpStyles.meta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {selected.address}
            </Text>
          )}
        </View>
        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={cpStyles.overlay} onPress={() => setModalVisible(false)}>
          <View
            style={[
              cpStyles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[cpStyles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[cpStyles.sheetTitle, { color: colors.foreground }]}>
                Select Company
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            <FlatList
              data={companies}
              keyExtractor={(c) => String(c.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(String(item.id), item);
                    setModalVisible(false);
                  }}
                  style={({ pressed }) => [
                    cpStyles.optionRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.muted : "transparent",
                    },
                  ]}
                >
                  <View style={{ width: 22 }}>
                    {String(item.id) === value && (
                      <Feather name="check" size={14} color={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[cpStyles.optionName, { color: colors.foreground }]}>
                      {item.name}
                    </Text>
                    {item.address && (
                      <Text
                        style={[cpStyles.optionMeta, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {item.address}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const cpStyles = StyleSheet.create({
  group: { gap: 5 },
  label: { fontSize: 12, },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  name: { fontSize: 14, },
  meta: { fontSize: 12, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: "70%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 15, },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionName: { fontSize: 14, },
  optionMeta: { fontSize: 12, marginTop: 2 },
});

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  iconColor,
  colors,
}: {
  icon: string;
  label: string;
  iconColor: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={shStyles.row}>
      <Feather name={icon} size={13} color={iconColor} />
      <Text style={[shStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const shStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 10, letterSpacing: 1.4 },
});

// ─── AssignStep ───────────────────────────────────────────────────────────────

function AssignStep({
  form,
  setForm,
  companies,
  colors,
}: {
  form: AssignForm;
  setForm: React.Dispatch<React.SetStateAction<AssignForm>>;
  companies: Company[];
  colors: ReturnType<typeof useColors>;
}) {
  const companyId = form.companyId ? Number(form.companyId) : 0;
  const enabled = !!form.companyId;

  const { data: jobTitles = [], isLoading: loadingJobTitles } = useListLoaOptions(
    { companyId, category: "job_title" },
    {
      query: {
        enabled,
        queryKey: getListLoaOptionsQueryKey({ companyId, category: "job_title" }),
      },
    },
  );
  const { data: workTypes = [], isLoading: loadingWorkTypes } = useListLoaOptions(
    { companyId, category: "work_type" },
    {
      query: {
        enabled,
        queryKey: getListLoaOptionsQueryKey({ companyId, category: "work_type" }),
      },
    },
  );
  const { data: workSites = [], isLoading: loadingWorkSites } = useListLoaOptions(
    { companyId, category: "work_site" },
    {
      query: {
        enabled,
        queryKey: getListLoaOptionsQueryKey({ companyId, category: "work_site" }),
      },
    },
  );

  const set = (key: keyof AssignForm) => (v: string) =>
    setForm((s) => ({ ...s, [key]: v }));

  return (
    <View style={asStyles.container}>
      {/* Company */}
      <View style={asStyles.section}>
        <SectionHeader icon="briefcase" label="COMPANY ASSIGNMENT" iconColor="#0d9488" colors={colors} />
        <CompanyPicker
          value={form.companyId}
          onChange={(id, company) =>
            setForm((s) => ({
              ...s,
              companyId: id,
              jobTitle: "",
              workType: "",
              workSite: "",
              signatoryName: company.signatoryName ?? s.signatoryName,
              signatoryDesignation: company.signatoryDesignation ?? s.signatoryDesignation,
            }))
          }
          companies={companies}
          colors={colors}
        />
      </View>

      {/* Employment — only when company selected */}
      {form.companyId ? (
        <>
          <View
            style={[
              asStyles.section,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            ]}
          >
            <SectionHeader icon="file-text" label="EMPLOYMENT DETAILS" iconColor="#7c3aed" colors={colors} />
            <OptionPickerField
              key={`jobTitle-${form.companyId}`}
              label="Job Title / Occupation"
              value={form.jobTitle}
              onChange={set("jobTitle")}
              options={jobTitles}
              isLoading={loadingJobTitles}
              placeholder="e.g. Construction Worker"
              companySelected={enabled}
              colors={colors}
            />
            <OptionPickerField
              key={`workType-${form.companyId}`}
              label="Work Type"
              value={form.workType}
              onChange={set("workType")}
              options={workTypes}
              isLoading={loadingWorkTypes}
              placeholder="e.g. Manual Labour"
              companySelected={enabled}
              colors={colors}
            />
            <TextField
              label="Basic Salary (USD)"
              value={form.basicSalary}
              onChange={set("basicSalary")}
              placeholder="e.g. 500"
              colors={colors}
            />
            <TextField
              label="Salary Payment Date"
              value={form.salaryPaymentDate}
              onChange={set("salaryPaymentDate")}
              colors={colors}
            />
            <OptionPickerField
              key={`workSite-${form.companyId}`}
              label="Work Site"
              value={form.workSite}
              onChange={set("workSite")}
              options={workSites}
              isLoading={loadingWorkSites}
              placeholder="e.g. Guraidhoo, Maldives"
              companySelected={enabled}
              colors={colors}
            />
            <TextField
              label="Date of Commence"
              value={form.dateOfCommence}
              onChange={set("dateOfCommence")}
              colors={colors}
            />
            <TextField
              label="Work Status"
              value={form.workStatus}
              onChange={set("workStatus")}
              colors={colors}
            />
            <TextField
              label="Contract Duration"
              value={form.contractDuration}
              onChange={set("contractDuration")}
              colors={colors}
            />
            <TextField
              label="Working Hours"
              value={form.workingHours}
              onChange={set("workingHours")}
              colors={colors}
            />
            <TextField
              label="Job Description"
              value={form.jobDescription}
              onChange={set("jobDescription")}
              multiline
              colors={colors}
            />
          </View>

          <View
            style={[
              asStyles.section,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            ]}
          >
            <SectionHeader icon="users" label="CANDIDATE & SIGNATORY" iconColor={colors.mutedForeground} colors={colors} />
            <TextField
              label="Emergency Contact"
              value={form.emergencyContact}
              onChange={set("emergencyContact")}
              placeholder="e.g. Jane Doe, +880-123-456789"
              colors={colors}
            />
            <TextField
              label="Signatory Name"
              value={form.signatoryName}
              onChange={set("signatoryName")}
              placeholder="Full name of signing authority"
              colors={colors}
            />
            <TextField
              label="Signatory Designation"
              value={form.signatoryDesignation}
              onChange={set("signatoryDesignation")}
              placeholder="e.g. Managing Director"
              colors={colors}
            />
            <TextField
              label="Signature Date"
              value={form.signatureDate}
              onChange={set("signatureDate")}
              placeholder="DD/MM/YYYY"
              colors={colors}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const asStyles = StyleSheet.create({
  container: { gap: 0 },
  section: { gap: 12, paddingVertical: 14 },
});

// ─── DoneStep ─────────────────────────────────────────────────────────────────

function DoneStep({
  loaId,
  candidateName,
  companyName,
  onReset,
  colors,
}: {
  loaId: number;
  candidateName: string | null;
  companyName: string | null;
  onReset: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const pdfUrl = `${BASE_URL}/api/loa/${loaId}/pdf`;

  return (
    <View style={dsStyles.container}>
      <View style={dsStyles.successCard}>
        <View style={dsStyles.iconWrap}>
          <Feather name="check-circle" size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[dsStyles.title, { color: colors.foreground }]}>
            Passport processed & LOA created
          </Text>
          {candidateName && (
            <Text style={[dsStyles.sub, { color: colors.mutedForeground }]}>
              {candidateName}
              {companyName ? ` · ${companyName}` : ""}
            </Text>
          )}
        </View>
      </View>

      <View style={dsStyles.actions}>
        <Pressable
          onPress={() => Linking.openURL(pdfUrl)}
          style={({ pressed }) => [
            dsStyles.btn,
            dsStyles.outline,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="eye" size={16} color={colors.foreground} />
          <Text style={[dsStyles.btnText, { color: colors.foreground }]}>View LOA</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(pdfUrl)}
          style={({ pressed }) => [
            dsStyles.btn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="download" size={16} color={colors.primaryForeground} />
          <Text style={[dsStyles.btnText, { color: colors.primaryForeground }]}>Download PDF</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onReset}
        style={({ pressed }) => [dsStyles.reset, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Feather name="rotate-ccw" size={13} color={colors.mutedForeground} />
        <Text style={[dsStyles.resetText, { color: colors.mutedForeground }]}>
          Process another document
        </Text>
      </Pressable>
    </View>
  );
}

const dsStyles = StyleSheet.create({
  container: { gap: 16 },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#ecfdf5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    padding: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: { fontSize: 15, },
  sub: { fontSize: 13, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: 12,
  },
  outline: { borderWidth: 1 },
  btnText: { fontSize: 14, },
  reset: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  resetText: { fontSize: 13, },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProcessDocumentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<WizardStep>("upload");
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [passportId, setPassportId] = useState<number | null>(null);
  const [assignForm, setAssignForm] = useState<AssignForm>(DEFAULT_ASSIGN);
  const [createdLoaId, setCreatedLoaId] = useState<number | null>(null);
  const [createdLoaCompanyName, setCreatedLoaCompanyName] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const { data: companies = [] } = useListCompanies();
  const updatePassportMutation = useUpdatePassport();
  const createLoaMutation = useCreateLoa();

  // Poll for OCR result — must be called unconditionally
  const { data: passport } = useGetPassport(passportId as number, {
    query: {
      enabled: !!passportId,
      queryKey: getGetPassportQueryKey(passportId as number),
      retry: false,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === "completed" || data?.status === "failed") return false;
        if (query.state.error) return false;
        return 2000;
      },
    },
  });

  const isPdf = picked?.mimeType === "application/pdf";
  const isExtracting = !!passportId && (!passport || passport.status === "processing");
  const extractionDone = passport?.status === "completed";
  const extractionFailed = passport?.status === "failed";
  const isSubmitting = updatePassportMutation.isPending || createLoaMutation.isPending;

  async function handleTakePhoto() {
    if (Platform.OS !== "web") {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert("Camera permission needed", "Please grant camera access to capture passports.");
          return;
        }
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      name: asset.fileName ?? fileNameFromUri(asset.uri),
      mimeType: asset.mimeType ?? inferMimeType(asset.uri, "image/jpeg"),
    });
    setPassportId(null);
  }

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      name: asset.name ?? fileNameFromUri(asset.uri),
      mimeType: asset.mimeType ?? inferMimeType(asset.name ?? asset.uri, "image/jpeg"),
    });
    setPassportId(null);
  }

  async function handleUpload() {
    if (!picked || uploading) return;
    setUploading(true);
    try {
      if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await uploadPassportFile(picked);
      setPassportId(result.id);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleCreateLoa() {
    if (!passport || !passportId || !assignForm.companyId) {
      Alert.alert("Missing info", "Please select a company before creating the LOA.");
      return;
    }
    const selectedCompany = companies.find((c) => String(c.id) === assignForm.companyId);
    const cid = Number(assignForm.companyId);

    updatePassportMutation.mutate(
      { id: passportId, data: { companyId: cid } },
      {
        onError: () => Alert.alert("Error", "Failed to assign company. Please try again."),
        onSuccess: () => {
          createLoaMutation.mutate(
            {
              data: {
                companyId: cid,
                passportId,
                companyName: selectedCompany?.name,
                companyAddress: selectedCompany?.address ?? undefined,
                companyEmail: selectedCompany?.email ?? undefined,
                companyPhone: selectedCompany?.phone ?? undefined,
                companyCountry: selectedCompany?.country ?? undefined,
                companyRegistrationNumber: selectedCompany?.registrationNumber ?? undefined,
                candidateName: passport.fullName ?? undefined,
                candidateAddress: passport.address ?? undefined,
                candidateNationality: passport.nationality ?? undefined,
                candidateDateOfBirth: passport.dateOfBirth ?? undefined,
                candidatePassportNumber: passport.passportNumber ?? undefined,
                candidateEmergencyContact: assignForm.emergencyContact || undefined,
                jobTitle: assignForm.jobTitle || undefined,
                workType: assignForm.workType || undefined,
                basicSalary: assignForm.basicSalary || undefined,
                salaryPaymentDate: assignForm.salaryPaymentDate || undefined,
                workSite: assignForm.workSite || undefined,
                dateOfCommence: assignForm.dateOfCommence || undefined,
                jobDescription: assignForm.jobDescription || undefined,
                workingHours: assignForm.workingHours || undefined,
                workStatus: assignForm.workStatus || undefined,
                contractDuration: assignForm.contractDuration || undefined,
                signatoryName: assignForm.signatoryName || undefined,
                signatoryDesignation: assignForm.signatoryDesignation || undefined,
                signatureDate: assignForm.signatureDate || undefined,
              },
            },
            {
              onSuccess: (loa) => {
                setCreatedLoaId(loa.id);
                setCreatedLoaCompanyName(selectedCompany?.name ?? null);
                setStep("done");
              },
              onError: () => Alert.alert("Error", "Failed to create LOA. Please try again."),
            },
          );
        },
      },
    );
  }

  function handleReset() {
    setStep("upload");
    setPicked(null);
    setPassportId(null);
    setAssignForm(DEFAULT_ASSIGN);
    setCreatedLoaId(null);
    setCreatedLoaCompanyName(null);
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="zap" size={17} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Process Document</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>AI Vision · GPT</Text>
        <StepIndicator current={step} colors={colors} />
      </View>

      {/* ══ Step 1: Upload & Extract ══════════════════════════════════════════ */}
      {step === "upload" && (
        <View style={styles.body}>
          {/* File preview — only shown before uploading */}
          {!passportId && (
            <>
              <View
                style={[
                  styles.preview,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {picked ? (
                  isPdf ? (
                    <View style={styles.pdfPreview}>
                      <Feather name="file-text" size={48} color={colors.primary} />
                      <Text
                        numberOfLines={1}
                        style={[styles.pdfName, { color: colors.foreground }]}
                      >
                        {picked.name}
                      </Text>
                      <Text style={[styles.pdfMeta, { color: colors.mutedForeground }]}>
                        PDF document
                      </Text>
                    </View>
                  ) : (
                    <Image source={{ uri: picked.uri }} style={styles.image} contentFit="cover" />
                  )
                ) : (
                  <View style={styles.dropHint}>
                    <Feather name="upload-cloud" size={40} color={colors.mutedForeground} />
                    <Text style={[styles.dropText, { color: colors.mutedForeground }]}>
                      No file selected
                    </Text>
                    <Text style={[styles.dropSub, { color: colors.mutedForeground }]}>
                      JPG · PNG · WEBP · PDF · max 20 MB
                    </Text>
                  </View>
                )}
                {picked && (
                  <Pressable
                    onPress={() => setPicked(null)}
                    style={[styles.clearBtn, { backgroundColor: colors.background }]}
                    hitSlop={6}
                  >
                    <Feather name="x" size={16} color={colors.foreground} />
                  </Pressable>
                )}
              </View>

              <View style={styles.captureRow}>
                <Pressable
                  onPress={handleTakePhoto}
                  disabled={uploading}
                  style={({ pressed }) => [
                    styles.captureBtn,
                    {
                      backgroundColor: colors.foreground,
                      opacity: uploading || pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="camera" size={16} color={colors.background} />
                  <Text style={[styles.captureBtnText, { color: colors.background }]}>
                    Take photo
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handlePickFile}
                  disabled={uploading}
                  style={({ pressed }) => [
                    styles.captureBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderWidth: 1,
                      opacity: uploading || pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather name="folder" size={16} color={colors.foreground} />
                  <Text style={[styles.captureBtnText, { color: colors.foreground }]}>
                    Choose file
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={handleUpload}
                disabled={!picked || uploading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: !picked || uploading ? 0.4 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="cpu" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                      Begin Extraction
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          )}

          {/* Extracting spinner */}
          {isExtracting && (
            <View
              style={[
                styles.statusCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <ActivityIndicator color={colors.primary} size="small" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                  Extracting with AI…
                </Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  GPT Vision is analysing your document
                </Text>
              </View>
            </View>
          )}

          {/* Extraction failed */}
          {extractionFailed && (
            <>
              <View
                style={[styles.statusCard, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}
              >
                <Feather name="alert-circle" size={20} color="#ef4444" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusTitle, { color: "#b91c1c" }]}>Extraction failed</Text>
                  <Text style={[styles.statusSub, { color: "#dc2626" }]}>
                    Could not read the document. Try a clearer image.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleReset}
                style={({ pressed }) => [
                  styles.outlineBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="rotate-ccw" size={14} color={colors.foreground} />
                <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>
                  Try a different file
                </Text>
              </Pressable>
            </>
          )}

          {/* Extracted data + Continue */}
          {extractionDone && passport && (
            <View style={{ gap: 12 }}>
              <View
                style={[
                  styles.extractedCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.extractedHeader}>
                  <Feather name="check-circle" size={14} color="#10b981" />
                  <Text style={[styles.extractedTitle, { color: colors.foreground }]}>
                    Extracted data
                  </Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI OCR</Text>
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  {(
                    [
                      ["Full Name", passport.fullName],
                      ["Passport No.", passport.passportNumber],
                      ["Nationality", passport.nationality],
                      ["Date of Birth", passport.dateOfBirth],
                      ["Date of Issue", passport.dateOfIssue],
                      ["Date of Expiry", passport.dateOfExpiry],
                      ["Address", passport.address],
                    ] as [string, string | null | undefined][]
                  )
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <View
                        key={label}
                        style={[styles.dataRow, { borderBottomColor: colors.border }]}
                      >
                        <Text style={[styles.dataLabel, { color: colors.mutedForeground }]}>
                          {label}
                        </Text>
                        <Text
                          style={[
                            styles.dataValue,
                            { color: colors.foreground },
                            label === "Passport No." && styles.mono,
                          ]}
                          numberOfLines={2}
                        >
                          {value}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>

              <Pressable
                onPress={() => setStep("assign")}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                  Continue to Assign
                </Text>
                <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* ══ Step 2: Assign & Details ══════════════════════════════════════════ */}
      {step === "assign" && (
        <View style={styles.body}>
          <AssignStep
            form={assignForm}
            setForm={setAssignForm}
            companies={companies}
            colors={colors}
          />

          <View style={styles.footerRow}>
            <Pressable
              onPress={() => setStep("upload")}
              style={({ pressed }) => [
                styles.outlineBtn,
                {
                  flex: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="arrow-left" size={14} color={colors.foreground} />
              <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleCreateLoa}
              disabled={!assignForm.companyId || isSubmitting}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  flex: 2,
                  backgroundColor: colors.primary,
                  opacity:
                    !assignForm.companyId || isSubmitting ? 0.4 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="file-plus" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                    Create LOA
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* ══ Step 3: Done ══════════════════════════════════════════════════════ */}
      {step === "done" && createdLoaId !== null && (
        <View style={styles.body}>
          <DoneStep
            loaId={createdLoaId}
            candidateName={passport?.fullName ?? null}
            companyName={createdLoaCompanyName}
            onReset={handleReset}
            colors={colors}
          />
        </View>
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20, paddingBottom: 48 },
  header: { gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, },
  subtitle: { fontSize: 12, },
  body: { gap: 14 },
  // File preview
  preview: {
    aspectRatio: 3 / 4,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  pdfPreview: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  pdfName: { fontSize: 16, textAlign: "center" },
  pdfMeta: { fontSize: 12, },
  dropHint: { alignItems: "center", gap: 10 },
  dropText: { fontSize: 15, },
  dropSub: { fontSize: 12, },
  clearBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  // Capture buttons
  captureRow: { flexDirection: "row", gap: 10 },
  captureBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  captureBtnText: { fontSize: 14, },
  // Primary button
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  primaryBtnText: { fontSize: 15, },
  // Outline button
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  outlineBtnText: { fontSize: 14, },
  // Status card
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusTitle: { fontSize: 14, },
  statusSub: { fontSize: 12, marginTop: 3 },
  // Extracted data
  extractedCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  extractedHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  extractedTitle: { fontSize: 13, flex: 1 },
  aiBadge: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: { fontSize: 10, color: "#059669" },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  dataLabel: { fontSize: 11, width: 88, flexShrink: 0 },
  dataValue: { fontSize: 13, flex: 1, textAlign: "right" },
  mono: { fontSize: 12 },
  // Footer row (back + submit)
  footerRow: { flexDirection: "row", gap: 10, marginTop: 4 },
});
