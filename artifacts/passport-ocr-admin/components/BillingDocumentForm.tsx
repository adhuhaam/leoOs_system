import { Feather } from "@/components/Icon";
import {
  type Client,
  type Company,
  type Passport,
  type SalaryRecord,
  getListClientsQueryKey,
  getListCompaniesQueryKey,
  getListSalaryRecordsQueryKey,
  useListClients,
  useListCompanies,
  useListPassports,
  useListSalaryRecords,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardTypeOptions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { CalendarPicker, todayISO } from "@/components/CalendarPicker";
import { useColors } from "@/hooks/useColors";

export type LineItemDraft = {
  description: string;
  detail: string;
  qty: string;
  rate: string;
};

export type BillingFormState = {
  kind: "invoice" | "quotation";
  companyId: number | null;
  clientId: number | null;
  customerName: string;
  customerAddress: string;
  customerTin: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  gstRate: string;
  gstInclusive: boolean;
  notes: string;
  status: string;
  items: LineItemDraft[];
  linkedSalaryIds: number[];
};

export const EMPTY_FORM: BillingFormState = {
  kind: "invoice",
  companyId: null,
  clientId: null,
  customerName: "",
  customerAddress: "",
  customerTin: "",
  issueDate: todayISO(),
  dueDate: "",
  terms: "",
  gstRate: "0",
  gstInclusive: false,
  notes: "",
  status: "draft",
  items: [{ description: "", detail: "", qty: "1", rate: "" }],
  linkedSalaryIds: [],
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "payment_received", label: "Payment Received" },
  { value: "completed", label: "Completed" },
];

function statusLabel(s: string) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? (s || "Draft");
}

function fmtMVR(n: number) {
  return `MVR ${(isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface Props {
  initialValues?: Partial<BillingFormState>;
  onSubmit: (form: BillingFormState) => Promise<void>;
  isSaving: boolean;
  submitLabel: string;
}

export default function BillingDocumentForm({
  initialValues,
  onSubmit,
  isSaving,
  submitLabel,
}: Props) {
  const colors = useColors();
  const [form, setForm] = useState<BillingFormState>({
    ...EMPTY_FORM,
    ...initialValues,
    items:
      initialValues?.items && initialValues.items.length > 0
        ? initialValues.items
        : EMPTY_FORM.items,
  });

  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [salaryModalVisible, setSalaryModalVisible] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
  const [selectedSalaryIds, setSelectedSalaryIds] = useState<Set<number>>(new Set());
  const [showIssueCal, setShowIssueCal] = useState(false);
  const [showDueCal, setShowDueCal] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const { data: companiesRaw = [] } = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey() },
  });
  const companies = companiesRaw as Company[];

  const { data: clientsRaw = [] } = useListClients(undefined, {
    query: { queryKey: getListClientsQueryKey() },
  });
  const clients = clientsRaw as Client[];

  const filteredCompanies = useMemo(
    () =>
      companySearch
        ? companies.filter((c) =>
            (c.name ?? "").toLowerCase().includes(companySearch.toLowerCase()),
          )
        : companies,
    [companies, companySearch],
  );

  const selectedCompany = companies.find((c) => c.id === form.companyId) ?? null;

  const { data: passportsRaw = [] } = useListPassports(
    form.clientId != null ? { clientId: String(form.clientId) } : undefined,
    {
      query: {
        queryKey: ["passports", "list", { clientId: form.clientId }] as const,
        enabled: form.clientId != null,
      },
    },
  );
  const clientEmployees = (passportsRaw as Passport[]).filter(
    (p) => p.submitted && p.fullName,
  );

  const filteredEmployees = useMemo(
    () =>
      employeeSearch
        ? clientEmployees.filter((p) =>
            (p.fullName ?? "").toLowerCase().includes(employeeSearch.toLowerCase()) ||
            (p.passportNumber ?? "").toLowerCase().includes(employeeSearch.toLowerCase()),
          )
        : clientEmployees,
    [clientEmployees, employeeSearch],
  );

  // Salary records for invoice linking (confirmed, not yet linked to any invoice)
  const { data: salaryRecordsRaw = [] } = useListSalaryRecords({ status: "confirmed" }, {
    query: { queryKey: getListSalaryRecordsQueryKey({ status: "confirmed" }), enabled: salaryModalVisible },
  });
  const availableSalaryRecords = useMemo(
    () => (salaryRecordsRaw as SalaryRecord[]).filter((r) => !r.invoiceId),
    [salaryRecordsRaw],
  );

  function toggleEmployee(id: number) {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelectedEmployees() {
    const toAdd = clientEmployees.filter((p) => selectedEmployeeIds.has(p.id));
    const newItems = toAdd.map((p) => ({
      description: p.fullName ?? "",
      detail: p.passportNumber ? `Passport: ${p.passportNumber}` : "",
      qty: "1",
      rate: "",
    }));
    setF("items", [...form.items, ...newItems]);
    setSelectedEmployeeIds(new Set());
    setEmployeeSearch("");
    setEmployeeModalVisible(false);
  }

  const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function addSelectedSalaryRecords() {
    const toAdd = availableSalaryRecords.filter((r) => selectedSalaryIds.has(r.id));
    if (toAdd.length === 0) return;
    const newItems = toAdd.map((r) => ({
      description: r.employeeName ? `Salary — ${r.employeeName}` : "Salary",
      detail: `${MONTHS_LONG[(r.month - 1) % 12] ?? ""} ${r.year}${r.passportNumber ? ` · ${r.passportNumber}` : ""}`,
      qty: "1",
      rate: r.netSalary ?? "0",
    }));
    const newLinkedIds = [...(form.linkedSalaryIds ?? []), ...Array.from(selectedSalaryIds)];
    setF("items", [...form.items, ...newItems]);
    setF("linkedSalaryIds", newLinkedIds);
    setSelectedSalaryIds(new Set());
    setSalaryModalVisible(false);
  }

  const filteredClients = useMemo(
    () =>
      clientSearch
        ? clients.filter((c) =>
            (c.name ?? "").toLowerCase().includes(clientSearch.toLowerCase()),
          )
        : clients,
    [clients, clientSearch],
  );

  const selectedClient = clients.find((c) => c.id === form.clientId) ?? null;

  const setF = <K extends keyof BillingFormState>(key: K, value: BillingFormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const setItem = (idx: number, key: keyof LineItemDraft, value: string) => {
    setForm((s) => {
      const items = [...s.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...s, items };
    });
  };

  const addItem = () =>
    setForm((s) => ({
      ...s,
      items: [...s.items, { description: "", detail: "", qty: "1", rate: "" }],
    }));

  const removeItem = (idx: number) => {
    if (form.items.length <= 1) {
      Alert.alert("Required", "At least one line item is required.");
      return;
    }
    setForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));
  };

  const totals = useMemo(() => {
    const sub = form.items.reduce(
      (acc, it) => acc + Number(it.qty || 0) * Number(it.rate || 0),
      0,
    );
    const rate = Number(form.gstRate || 0) / 100;
    if (form.gstInclusive) {
      const base = sub / (1 + rate);
      return { sub: base, gst: sub - base, total: sub };
    }
    const gst = sub * rate;
    return { sub, gst, total: sub + gst };
  }, [form.items, form.gstRate, form.gstInclusive]);

  const handleSubmit = async () => {
    if (!form.companyId) {
      Alert.alert("Required", "Please select a company.");
      return;
    }
    if (!form.customerName.trim()) {
      Alert.alert("Required", "Customer name is required.");
      return;
    }
    if (!form.issueDate.trim()) {
      Alert.alert("Required", "Issue date is required (YYYY-MM-DD).");
      return;
    }
    const hasEmptyDesc = form.items.some((it) => !it.description.trim());
    if (hasEmptyDesc) {
      Alert.alert("Required", "All line items must have a description.");
      return;
    }
    try {
      await onSubmit(form);
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: 48 }]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      {/* Kind selector */}
      <View style={styles.section}>
        <Label text="Type" />
        <View style={styles.kindRow}>
          {(["invoice", "quotation"] as const).map((k) => {
            const active = form.kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => setF("kind", k)}
                style={[
                  styles.kindBtn,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Feather
                  name={k === "invoice" ? "file-text" : "file"}
                  size={16}
                  color={active ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.kindBtnText,
                    { color: active ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {k === "invoice" ? "Invoice" : "Quotation"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Company (issuer) */}
      <View style={styles.section}>
        <Label text="Company *" />
        <Pressable
          onPress={() => setCompanyModalVisible(true)}
          style={[
            styles.pickerBtn,
            {
              backgroundColor: colors.card,
              borderColor: form.companyId ? colors.border : colors.destructive + "66",
            },
          ]}
        >
          <Text
            style={[
              styles.pickerBtnText,
              {
                color: selectedCompany ? colors.foreground : colors.mutedForeground,
                flex: 1,
              },
            ]}
            numberOfLines={1}
          >
            {selectedCompany?.name ?? "Select company…"}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Client */}
      <View style={styles.section}>
        <Label text="Client" />
        <Pressable
          onPress={() => setClientModalVisible(true)}
          style={[
            styles.pickerBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.pickerBtnText,
              {
                color: selectedClient ? colors.foreground : colors.mutedForeground,
                flex: 1,
              },
            ]}
            numberOfLines={1}
          >
            {selectedClient?.name ?? "Select client…"}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Label text="Status" />
        <Pressable
          onPress={() => setStatusModalVisible(true)}
          style={[
            styles.pickerBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.pickerBtnText, { color: colors.foreground, flex: 1 }]}>
            {statusLabel(form.status)}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Customer */}
      <View style={styles.section}>
        <Label text="Customer Name *" />
        <Field
          value={form.customerName}
          onChangeText={(v) => setF("customerName", v)}
          placeholder="Full name or company"
          autoCapitalize="words"
        />
      </View>
      <View style={styles.section}>
        <Label text="Customer Address" />
        <Field
          value={form.customerAddress}
          onChangeText={(v) => setF("customerAddress", v)}
          placeholder="Optional"
          multiline
        />
      </View>
      <View style={styles.section}>
        <Label text="Customer TIN" />
        <Field
          value={form.customerTin}
          onChangeText={(v) => setF("customerTin", v)}
          placeholder="Tax identification number"
          autoCapitalize="characters"
        />
      </View>

      {/* Issue Date */}
      <View style={styles.section}>
        <Label text="Issue Date *" />
        <Pressable
          onPress={() => { setShowIssueCal((v) => !v); setShowDueCal(false); }}
          style={[
            styles.dateTrigger,
            { backgroundColor: colors.card, borderColor: form.issueDate ? colors.primary : colors.border },
          ]}
        >
          <Feather name="calendar" size={16} color={form.issueDate ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.dateTriggerText, { color: form.issueDate ? colors.foreground : colors.mutedForeground, flex: 1 }]}>
            {form.issueDate || "Pick date"}
          </Text>
          {form.issueDate ? (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); setF("issueDate", ""); setShowIssueCal(false); }}
              hitSlop={8}
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Feather name={showIssueCal ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
          )}
        </Pressable>
        {showIssueCal && (
          <CalendarPicker
            value={form.issueDate}
            onChange={(d) => { setF("issueDate", d); if (d) setShowIssueCal(false); }}
          />
        )}
      </View>

      {/* Due Date */}
      <View style={styles.section}>
        <Label text="Due Date" />
        <Pressable
          onPress={() => { setShowDueCal((v) => !v); setShowIssueCal(false); }}
          style={[
            styles.dateTrigger,
            { backgroundColor: colors.card, borderColor: form.dueDate ? colors.primary : colors.border },
          ]}
        >
          <Feather name="calendar" size={16} color={form.dueDate ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.dateTriggerText, { color: form.dueDate ? colors.foreground : colors.mutedForeground, flex: 1 }]}>
            {form.dueDate || "Pick date (optional)"}
          </Text>
          {form.dueDate ? (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); setF("dueDate", ""); setShowDueCal(false); }}
              hitSlop={8}
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Feather name={showDueCal ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
          )}
        </Pressable>
        {showDueCal && (
          <CalendarPicker
            value={form.dueDate}
            onChange={(d) => { setF("dueDate", d); if (d) setShowDueCal(false); }}
          />
        )}
      </View>

      {/* Terms */}
      <View style={styles.section}>
        <Label text="Payment Terms" />
        <Field
          value={form.terms}
          onChangeText={(v) => setF("terms", v)}
          placeholder="e.g. Net 30"
        />
      </View>

      {/* GST */}
      <View style={styles.row2}>
        <View style={[styles.section, { flex: 1 }]}>
          <Label text="GST Rate (%)" />
          <Field
            value={form.gstRate}
            onChangeText={(v) => setF("gstRate", v)}
            placeholder="0"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={[styles.section, { flex: 1 }]}>
          <Label text="GST Inclusive" />
          <View
            style={[
              styles.toggleRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
              {form.gstInclusive ? "Yes" : "No"}
            </Text>
            <Switch
              value={form.gstInclusive}
              onValueChange={(v) => setF("gstInclusive", v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>

      {/* Line items */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Label text="Line Items *" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => {
                setSelectedSalaryIds(new Set());
                setSalaryModalVisible(true);
              }}
              style={[styles.addItemBtn, { backgroundColor: "#05966918" }]}
            >
              <Feather name="dollar-sign" size={14} color="#059669" />
              <Text style={[styles.addItemText, { color: "#059669" }]}>
                From Salary
              </Text>
            </Pressable>
            {form.clientId != null && clientEmployees.length > 0 && (
              <Pressable
                onPress={() => {
                  setSelectedEmployeeIds(new Set());
                  setEmployeeModalVisible(true);
                }}
                style={[styles.addItemBtn, { backgroundColor: colors.primary + "18" }]}
              >
                <Feather name="users" size={14} color={colors.primary} />
                <Text style={[styles.addItemText, { color: colors.primary }]}>
                  Add employees
                </Text>
              </Pressable>
            )}
            <Pressable onPress={addItem} style={styles.addItemBtn}>
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[styles.addItemText, { color: colors.primary }]}>
                Custom item
              </Text>
            </Pressable>
          </View>
        </View>

        {form.items.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.itemCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.itemHeader}>
              <Text style={[styles.itemNum, { color: colors.mutedForeground }]}>
                #{idx + 1}
              </Text>
              <Pressable onPress={() => removeItem(idx)} hitSlop={10}>
                <Feather name="trash-2" size={15} color={colors.destructive} />
              </Pressable>
            </View>

            <Field
              value={item.description}
              onChangeText={(v) => setItem(idx, "description", v)}
              placeholder="Description *"
              autoCapitalize="sentences"
            />
            <Field
              value={item.detail}
              onChangeText={(v) => setItem(idx, "detail", v)}
              placeholder="Detail (optional)"
              autoCapitalize="sentences"
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Label text="Qty" />
                <Field
                  value={item.qty}
                  onChangeText={(v) => setItem(idx, "qty", v)}
                  placeholder="1"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="Rate (MVR)" />
                <Field
                  value={item.rate}
                  onChangeText={(v) => setItem(idx, "rate", v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="Amount" />
                <View
                  style={[
                    styles.amountBox,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.amountText, { color: colors.foreground }]}>
                    {fmtMVR(Number(item.qty || 0) * Number(item.rate || 0))}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View
        style={[
          styles.totalsBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TotalRow label="Subtotal" value={fmtMVR(totals.sub)} colors={colors} />
        <TotalRow
          label={`GST (${form.gstRate || "0"}%${form.gstInclusive ? ", incl." : ""})`}
          value={fmtMVR(totals.gst)}
          colors={colors}
        />
        <View style={[styles.totalDivider, { backgroundColor: colors.border }]} />
        <TotalRow label="Total" value={fmtMVR(totals.total)} bold colors={colors} />
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Label text="Notes" />
        <Field
          value={form.notes}
          onChangeText={(v) => setF("notes", v)}
          placeholder="Any additional notes…"
          multiline
          minHeight={80}
        />
      </View>

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={isSaving}
        style={({ pressed }) => [
          styles.submitBtn,
          {
            backgroundColor: colors.primary,
            opacity: isSaving ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {isSaving ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="save" size={18} color={colors.primaryForeground} />
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
              {submitLabel}
            </Text>
          </>
        )}
      </Pressable>

      {/* Company picker modal */}
      <Modal
        visible={companyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCompanyModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalNav, { borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Select Company
            </Text>
            <Pressable
              onPress={() => { setCompanyModalVisible(false); setCompanySearch(""); }}
              hitSlop={12}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={companySearch}
              onChangeText={setCompanySearch}
              placeholder="Search…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {companySearch.length > 0 && (
              <Pressable onPress={() => setCompanySearch("")} hitSlop={8}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={filteredCompanies}
            keyExtractor={(c) => String(c.id)}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => {
              const selected = item.id === form.companyId;
              return (
                <Pressable
                  onPress={() => {
                    setF("companyId", item.id);
                    setCompanyModalVisible(false);
                    setCompanySearch("");
                  }}
                  style={({ pressed }) => [
                    styles.companyRow,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.companyName,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.registrationNumber ? (
                      <Text
                        style={[
                          styles.clientSub,
                          { color: selected ? colors.primaryForeground + "cc" : colors.mutedForeground },
                        ]}
                        numberOfLines={1}
                      >
                        Reg: {item.registrationNumber}
                      </Text>
                    ) : null}
                  </View>
                  {selected && (
                    <Feather name="check" size={16} color={colors.primaryForeground} />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No companies found
              </Text>
            }
          />
        </View>
      </Modal>

      {/* Client picker modal */}
      <Modal
        visible={clientModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setClientModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalNav, { borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Select Client
            </Text>
            <Pressable
              onPress={() => { setClientModalVisible(false); setClientSearch(""); }}
              hitSlop={12}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="Search…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {clientSearch.length > 0 && (
              <Pressable onPress={() => setClientSearch("")} hitSlop={8}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={filteredClients}
            keyExtractor={(c) => String(c.id)}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => {
              const selected = item.id === form.clientId;
              return (
                <Pressable
                  onPress={() => {
                    setForm((s) => ({
                      ...s,
                      clientId: item.id,
                      customerName: item.name ?? s.customerName,
                      customerAddress: item.address ?? s.customerAddress,
                      customerTin: item.tin ?? s.customerTin,
                    }));
                    setClientModalVisible(false);
                    setClientSearch("");
                  }}
                  style={({ pressed }) => [
                    styles.companyRow,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.companyName,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.contactPerson ? (
                      <Text
                        style={[
                          styles.clientSub,
                          { color: selected ? colors.primaryForeground + "cc" : colors.mutedForeground },
                        ]}
                        numberOfLines={1}
                      >
                        {item.contactPerson}
                      </Text>
                    ) : null}
                  </View>
                  {selected && (
                    <Feather name="check" size={16} color={colors.primaryForeground} />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No clients found
              </Text>
            }
          />
        </View>
      </Modal>

      {/* Employee picker modal */}
      <Modal
        visible={employeeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEmployeeModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalNav, { borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Add Employees
            </Text>
            <Pressable
              onPress={() => { setEmployeeModalVisible(false); setEmployeeSearch(""); }}
              hitSlop={12}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <View
            style={[
              styles.searchWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={employeeSearch}
              onChangeText={setEmployeeSearch}
              placeholder="Search by name or passport…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {employeeSearch.length > 0 && (
              <Pressable onPress={() => setEmployeeSearch("")} hitSlop={8}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* select-all row */}
          <Pressable
            onPress={() => {
              if (selectedEmployeeIds.size === clientEmployees.length) {
                setSelectedEmployeeIds(new Set());
              } else {
                setSelectedEmployeeIds(new Set(clientEmployees.map((p) => p.id)));
              }
            }}
            style={[
              styles.selectAllRow,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: colors.primary,
                  backgroundColor:
                    selectedEmployeeIds.size === clientEmployees.length && clientEmployees.length > 0
                      ? colors.primary
                      : "transparent",
                },
              ]}
            >
              {selectedEmployeeIds.size === clientEmployees.length && clientEmployees.length > 0 && (
                <Feather name="check" size={11} color="#fff" />
              )}
            </View>
            <Text style={[styles.selectAllText, { color: colors.foreground }]}>
              {selectedEmployeeIds.size === clientEmployees.length && clientEmployees.length > 0
                ? "Deselect all"
                : `Select all (${clientEmployees.length})`}
            </Text>
            {selectedEmployeeIds.size > 0 && (
              <Text style={[styles.selectedCount, { color: colors.primary }]}>
                {selectedEmployeeIds.size} selected
              </Text>
            )}
          </Pressable>

          <FlatList
            data={filteredEmployees}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => {
              const checked = selectedEmployeeIds.has(item.id);
              return (
                <Pressable
                  onPress={() => toggleEmployee(item.id)}
                  style={({ pressed }) => [
                    styles.employeeRow,
                    {
                      backgroundColor: checked ? colors.primary + "14" : colors.card,
                      borderColor: checked ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: checked ? colors.primary : colors.mutedForeground,
                        backgroundColor: checked ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {checked && <Feather name="check" size={11} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.companyName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {item.fullName}
                    </Text>
                    {item.passportNumber ? (
                      <Text
                        style={[styles.clientSub, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {item.passportNumber}
                        {item.nationality ? ` · ${item.nationality}` : ""}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No employees found
              </Text>
            }
          />

          {/* Footer add button */}
          <View
            style={[
              styles.employeeFooter,
              { borderTopColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <Pressable
              onPress={addSelectedEmployees}
              disabled={selectedEmployeeIds.size === 0}
              style={[
                styles.employeeAddBtn,
                {
                  backgroundColor:
                    selectedEmployeeIds.size > 0 ? colors.primary : colors.muted,
                },
              ]}
            >
              <Text style={[styles.employeeAddBtnText, { color: selectedEmployeeIds.size > 0 ? colors.primaryForeground : colors.mutedForeground }]}>
                {selectedEmployeeIds.size > 0
                  ? `Add ${selectedEmployeeIds.size} employee${selectedEmployeeIds.size > 1 ? "s" : ""}`
                  : "Select employees above"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Salary record picker modal ── */}
      <Modal
        visible={salaryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setSalaryModalVisible(false); setSelectedSalaryIds(new Set()); }}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalNav, { borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>From Salary Records</Text>
            <Pressable onPress={() => { setSalaryModalVisible(false); setSelectedSalaryIds(new Set()); }} hitSlop={12}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          {availableSalaryRecords.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
              <Feather name="dollar-sign" size={32} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
                No confirmed, unlinked salary records.{"\n"}Confirm salary records first.
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.selectAllRow, { borderBottomColor: colors.border }]}>
                <Pressable
                  onPress={() =>
                    setSelectedSalaryIds(
                      selectedSalaryIds.size === availableSalaryRecords.length
                        ? new Set()
                        : new Set(availableSalaryRecords.map((r) => r.id)),
                    )
                  }
                  style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}
                >
                  <View style={[styles.checkbox, { borderColor: selectedSalaryIds.size === availableSalaryRecords.length ? colors.primary : colors.border, backgroundColor: selectedSalaryIds.size === availableSalaryRecords.length ? colors.primary : "transparent" }]}>
                    {selectedSalaryIds.size === availableSalaryRecords.length && (
                      <Feather name="check" size={12} color={colors.primaryForeground} />
                    )}
                  </View>
                  <Text style={[styles.selectAllText, { color: colors.foreground }]}>Select all</Text>
                </Pressable>
                {selectedSalaryIds.size > 0 && (
                  <Text style={[styles.selectedCount, { color: colors.mutedForeground }]}>{selectedSalaryIds.size} selected</Text>
                )}
              </View>
              <FlatList
                data={availableSalaryRecords}
                keyExtractor={(r) => String(r.id)}
                contentContainerStyle={{ padding: 16, gap: 8 }}
                renderItem={({ item: r }) => {
                  const checked = selectedSalaryIds.has(r.id);
                  return (
                    <Pressable
                      onPress={() => setSelectedSalaryIds((prev) => { const next = new Set(prev); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); return next; })}
                      style={({ pressed }) => [styles.employeeRow, { backgroundColor: checked ? colors.primary + "18" : colors.card, borderColor: checked ? colors.primary : colors.border, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <View style={[styles.checkbox, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : "transparent" }]}>
                        {checked && <Feather name="check" size={12} color={colors.primaryForeground} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                          {r.employeeName ?? "Unknown employee"}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
                          {MONTHS_LONG[(r.month - 1) % 12]} {r.year}{r.passportNumber ? ` · ${r.passportNumber}` : ""}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#059669" }}>
                        MVR {Number(r.netSalary ?? 0).toFixed(2)}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </>
          )}

          <View style={[styles.employeeFooter, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <Pressable
              onPress={addSelectedSalaryRecords}
              disabled={selectedSalaryIds.size === 0}
              style={[styles.employeeAddBtn, { backgroundColor: selectedSalaryIds.size > 0 ? "#059669" : colors.muted }]}
            >
              <Text style={[styles.employeeAddBtnText, { color: selectedSalaryIds.size > 0 ? "#FFFFFF" : colors.mutedForeground }]}>
                {selectedSalaryIds.size > 0 ? `Add ${selectedSalaryIds.size} salary record${selectedSalaryIds.size > 1 ? "s" : ""}` : "Select records above"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Status picker modal */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setStatusModalVisible(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Status
            </Text>
            {STATUS_OPTIONS.map((opt) => {
              const active = opt.value === form.status;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { setF("status", opt.value); setStatusModalVisible(false); }}
                  style={({ pressed }) => [
                    styles.statusRow,
                    {
                      backgroundColor: active
                        ? colors.primary + "22"
                        : pressed
                          ? colors.secondary
                          : "transparent",
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusRowText,
                      {
                        color: active ? colors.primary : colors.foreground,
                        flex: 1,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setStatusModalVisible(false)}
              style={[styles.cancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

function Label({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.label, { color: colors.mutedForeground }]}>
      {text.toUpperCase()}
    </Text>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  minHeight,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  minHeight?: number;
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      keyboardType={keyboardType ?? "default"}
      autoCapitalize={autoCapitalize ?? "sentences"}
      style={[
        styles.input,
        {
          backgroundColor: colors.card,
          color: colors.foreground,
          borderColor: colors.border,
          minHeight: minHeight ?? (multiline ? 72 : 46),
          textAlignVertical: multiline ? "top" : "center",
        },
      ]}
    />
  );
}

function TotalRow({
  label,
  value,
  bold,
  colors,
}: {
  label: string;
  value: string;
  bold?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.totalRow}>
      <Text
        style={[
          styles.totalLabel,
          { color: bold ? colors.foreground : colors.mutedForeground, },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.totalValue,
          { color: colors.foreground, fontSize: bold ? 18 : 14 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  section: { gap: 6 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  row2: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  label: { fontSize: 11, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  kindRow: { flexDirection: "row", gap: 10 },
  kindBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  kindBtnText: { fontSize: 14, },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  pickerBtnText: { fontSize: 15, },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 46,
  },
  toggleLabel: { fontSize: 15, },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addItemText: { fontSize: 13, },
  itemCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemNum: { fontSize: 12, },
  amountBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
  },
  amountText: { fontSize: 13, },
  totalsBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 13 },
  totalValue: {},
  totalDivider: { height: 1, marginVertical: 2 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
  },
  submitText: { fontSize: 15, },
  // Company modal
  modalContainer: { flex: 1 },
  modalNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  companyName: { flex: 1, fontSize: 15, },
  clientSub: { fontSize: 12, marginTop: 2 },
  emptyText: { textAlign: "center", marginTop: 20, fontSize: 14, },
  // Status modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
    gap: 6,
  },
  sheetTitle: { fontSize: 17, marginBottom: 6 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusRowText: { fontSize: 15 },
  cancelBtn: { marginTop: 8, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  cancelText: { fontSize: 15, },
  // Date pickers
  dateTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateTriggerText: { fontSize: 15 },
  // Employee picker
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  selectAllText: { flex: 1, fontSize: 14 },
  selectedCount: { fontSize: 13 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  employeeFooter: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  employeeAddBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  employeeAddBtnText: { fontSize: 15, fontWeight: "600" },
});
