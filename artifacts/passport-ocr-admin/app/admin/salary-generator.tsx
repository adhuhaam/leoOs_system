import { Feather } from "@/components/Icon";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSalaryRecords,
  useCreateSalaryRecord,
  useUpdateSalaryRecord,
  useDeleteSalaryRecord,
  useListPassports,
  getListSalaryRecordsQueryKey,
  type SalaryRecord,
  type Passport,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function fmtMVR(val: string | number | null | undefined): string {
  const n = Number(val ?? "0");
  if (isNaN(n)) return "MVR —";
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeNet(f: Record<string, string>): number {
  const n = (v: string) => parseFloat(v) || 0;
  return n(f.basicSalary) + n(f.foodAllowance) + n(f.transportAllowance) + n(f.otherAllowances) + n(f.otherExpenses) - n(f.deductions);
}

const EMPTY_FORM = { basicSalary: "", foodAllowance: "0", transportAllowance: "0", otherAllowances: "0", deductions: "0", otherExpenses: "0", notes: "", status: "draft" };

export default function SalaryGeneratorScreen() {
  const colors = useColors();
  const qc = useQueryClient();

  const [month, setMonth] = useState(NOW.getMonth() + 1);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Form modal
  const [formTarget, setFormTarget] = useState<{ passport: Passport; existing: SalaryRecord | null } | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);

  const { data: allPassports, isLoading: passportsLoading, refetch: refetchPassports } = useListPassports();
  const { data: salaryRecords, isLoading: salaryLoading, refetch: refetchSalary } = useListSalaryRecords({ month, year });

  const createMutation = useCreateSalaryRecord();
  const updateMutation = useUpdateSalaryRecord();
  const deleteMutation = useDeleteSalaryRecord();

  const isLoading = passportsLoading || salaryLoading;

  const salaryMap = useMemo(() => {
    const m = new Map<number, SalaryRecord>();
    for (const r of salaryRecords ?? []) m.set(r.passportId, r);
    return m;
  }, [salaryRecords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allPassports ?? []).filter((p) =>
      !q || (p.fullName ?? "").toLowerCase().includes(q) || (p.passportNumber ?? "").toLowerCase().includes(q)
    );
  }, [allPassports, search]);

  const totalNet = useMemo(
    () => (salaryRecords ?? []).reduce((s, r) => s + parseFloat(r.netSalary || "0"), 0),
    [salaryRecords]
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchPassports(), refetchSalary()]);
    setRefreshing(false);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
  }

  function openForm(passport: Passport, existing: SalaryRecord | null) {
    setForm(
      existing
        ? {
            basicSalary: existing.basicSalary,
            foodAllowance: existing.foodAllowance,
            transportAllowance: existing.transportAllowance,
            otherAllowances: existing.otherAllowances,
            deductions: existing.deductions,
            otherExpenses: existing.otherExpenses,
            notes: existing.notes ?? "",
            status: existing.status,
          }
        : { ...EMPTY_FORM }
    );
    setFormTarget({ passport, existing });
  }

  async function handleSave() {
    if (!formTarget) return;
    const { passport, existing } = formTarget;
    if (!form.basicSalary || parseFloat(form.basicSalary) <= 0) {
      Alert.alert("Required", "Please enter a basic salary amount.");
      return;
    }
    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          data: {
            basicSalary: form.basicSalary,
            foodAllowance: form.foodAllowance,
            transportAllowance: form.transportAllowance,
            otherAllowances: form.otherAllowances,
            deductions: form.deductions,
            otherExpenses: form.otherExpenses,
            notes: form.notes || null,
            status: form.status as "draft" | "confirmed",
          },
        });
      } else {
        await createMutation.mutateAsync({
          data: {
            passportId: passport.id,
            month,
            year,
            basicSalary: form.basicSalary,
            foodAllowance: form.foodAllowance,
            transportAllowance: form.transportAllowance,
            otherAllowances: form.otherAllowances,
            deductions: form.deductions,
            otherExpenses: form.otherExpenses,
            notes: form.notes || null,
            status: form.status,
          },
        });
      }
      invalidate();
      setFormTarget(null);
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  function confirmDelete(record: SalaryRecord) {
    Alert.alert("Delete salary record?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteMutation.mutateAsync({ id: record.id });
          invalidate();
        },
      },
    ]);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const netPreview = computeNet(form);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Salary Generator</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {MONTHS[month - 1]} {year}
          </Text>
        </View>
      </View>

      {/* Month / Year selector */}
      <View style={[styles.pickerRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable
          onPress={() => setShowMonthPicker(true)}
          style={[styles.pickerBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.pickerBtnText, { color: colors.foreground }]}>{MONTHS[month - 1]}</Text>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => setShowYearPicker(true)}
          style={[styles.pickerBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.pickerBtnText, { color: colors.foreground }]}>{year}</Text>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
        </Pressable>

        {/* Summary */}
        <View style={styles.totalWrap}>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total</Text>
          <Text style={[styles.totalAmount, { color: colors.primary }]}>{fmtMVR(totalNet)}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search employees…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {(salaryRecords ?? []).length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                WITH SALARY — {(salaryRecords ?? []).length} RECORDS
              </Text>
              {filtered
                .filter((p) => salaryMap.has(p.id))
                .map((p) => {
                  const record = salaryMap.get(p.id)!;
                  return (
                    <EmployeeCard
                      key={p.id}
                      passport={p}
                      record={record}
                      colors={colors}
                      onEdit={() => openForm(p, record)}
                      onDelete={() => confirmDelete(record)}
                    />
                  );
                })}
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
                PENDING — {filtered.filter((p) => !salaryMap.has(p.id)).length} EMPLOYEES
              </Text>
            </>
          )}

          {filtered
            .filter((p) => !salaryMap.has(p.id))
            .map((p) => (
              <EmployeeCard
                key={p.id}
                passport={p}
                record={null}
                colors={colors}
                onEdit={() => openForm(p, null)}
                onDelete={() => {}}
              />
            ))}

          {filtered.length === 0 && (
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No employees found</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Month picker modal */}
      <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowMonthPicker(false)}>
          <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerModalTitle, { color: colors.foreground }]}>Select Month</Text>
            {MONTHS.map((m, i) => (
              <Pressable
                key={i}
                onPress={() => { setMonth(i + 1); setShowMonthPicker(false); }}
                style={[styles.pickerOption, { backgroundColor: month === i + 1 ? colors.primary + "18" : "transparent" }]}
              >
                <Text style={[styles.pickerOptionText, { color: month === i + 1 ? colors.primary : colors.foreground }]}>
                  {m}
                </Text>
                {month === i + 1 && <Feather name="check" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Year picker modal */}
      <Modal visible={showYearPicker} transparent animationType="fade" onRequestClose={() => setShowYearPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowYearPicker(false)}>
          <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerModalTitle, { color: colors.foreground }]}>Select Year</Text>
            {YEARS.map((y) => (
              <Pressable
                key={y}
                onPress={() => { setYear(y); setShowYearPicker(false); }}
                style={[styles.pickerOption, { backgroundColor: year === y ? colors.primary + "18" : "transparent" }]}
              >
                <Text style={[styles.pickerOptionText, { color: year === y ? colors.primary : colors.foreground }]}>
                  {y}
                </Text>
                {year === y && <Feather name="check" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Salary form modal */}
      <Modal
        visible={formTarget !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormTarget(null)}
      >
        {formTarget && (
          <SafeAreaView style={[styles.formSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.formHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setFormTarget(null)} hitSlop={10}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={[styles.formTitle, { color: colors.foreground }]}>
                  {formTarget.existing ? "Edit Salary" : "Generate Salary"}
                </Text>
                <Text style={[styles.formSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {formTarget.passport.fullName ?? "—"} · {MONTHS_SHORT[month - 1]} {year}
                </Text>
              </View>
              <Pressable onPress={handleSave} disabled={isPending} hitSlop={10} style={{ opacity: isPending ? 0.5 : 1 }}>
                {isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
                )}
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
              {/* Earnings section */}
              <Text style={[styles.formSection, { color: "#059669" }]}>EARNINGS</Text>
              {[
                { key: "basicSalary", label: "Basic Salary *" },
                { key: "foodAllowance", label: "Food Allowance" },
                { key: "transportAllowance", label: "Transport Allowance" },
                { key: "otherAllowances", label: "Other Allowances" },
                { key: "otherExpenses", label: "Other Expenses" },
              ].map((f) => (
                <View key={f.key} style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{f.label.toUpperCase()}</Text>
                  <TextInput
                    value={form[f.key]}
                    onChangeText={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    style={[styles.formInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                  />
                </View>
              ))}

              {/* Deductions section */}
              <Text style={[styles.formSection, { color: "#DC2626", marginTop: 16 }]}>DEDUCTIONS</Text>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>TOTAL DEDUCTIONS</Text>
                <TextInput
                  value={form.deductions}
                  onChangeText={(v) => setForm((p) => ({ ...p, deductions: v }))}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[styles.formInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                />
              </View>

              {/* Net preview */}
              <View style={[styles.netRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.netLabel, { color: colors.mutedForeground }]}>Net Salary</Text>
                <Text style={[styles.netValue, { color: netPreview < 0 ? "#DC2626" : colors.foreground }]}>
                  {fmtMVR(netPreview)}
                </Text>
              </View>

              {/* Notes */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>NOTES (OPTIONAL)</Text>
                <TextInput
                  value={form.notes}
                  onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
                  placeholder="Optional notes…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  style={[styles.formInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, height: 80, textAlignVertical: "top", paddingTop: 12 }]}
                />
              </View>

              {/* Status toggle */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>STATUS</Text>
                <View style={styles.statusRow}>
                  {["draft", "confirmed"].map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setForm((p) => ({ ...p, status: s }))}
                      style={[
                        styles.statusBtn,
                        {
                          backgroundColor: form.status === s ? (s === "confirmed" ? "#059669" : colors.primary) + "18" : colors.secondary,
                          borderColor: form.status === s ? (s === "confirmed" ? "#059669" : colors.primary) : colors.border,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBtnText, { color: form.status === s ? (s === "confirmed" ? "#059669" : colors.primary) : colors.mutedForeground }]}>
                        {s === "confirmed" ? "Confirmed" : "Draft"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function EmployeeCard({
  passport, record, colors, onEdit, onDelete,
}: {
  passport: Passport;
  record: SalaryRecord | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = (passport.fullName ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0] ?? "").join("").toUpperCase();

  const hasSalary = record !== null;
  const isConfirmed = record?.status === "confirmed";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.avatarText, { color: colors.foreground }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>{passport.fullName ?? "—"}</Text>
          <Text style={[styles.cardPassport, { color: colors.mutedForeground }]}>{passport.passportNumber ?? "—"}</Text>
        </View>
        {hasSalary ? (
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={[styles.cardNet, { color: colors.foreground }]}>{fmtMVR(record!.netSalary)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: isConfirmed ? "#05966918" : "#D9770618" }]}>
              <Text style={[styles.statusBadgeText, { color: isConfirmed ? "#059669" : "#D97706" }]}>
                {isConfirmed ? "Confirmed" : "Draft"}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.noneText, { color: colors.mutedForeground }]}>No salary</Text>
        )}
      </View>

      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1, backgroundColor: colors.primary + "14" }]}
        >
          <Feather name={hasSalary ? "edit-2" : "plus"} size={14} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {hasSalary ? "Edit" : "Generate"}
          </Text>
        </Pressable>
        {hasSalary && (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1, backgroundColor: "#DC262614" }]}
          >
            <Feather name="trash-2" size={14} color="#DC2626" />
            <Text style={[styles.actionText, { color: "#DC2626" }]}>Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  headerSub: { fontSize: 12, marginTop: 1 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  pickerBtnText: { fontSize: 14, fontWeight: "500" },
  totalWrap: { flex: 1, alignItems: "flex-end" },
  totalLabel: { fontSize: 10, letterSpacing: 0.4 },
  totalAmount: { fontSize: 15, fontWeight: "700" },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600", marginBottom: 4 },
  emptyText: { fontSize: 14 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "600" },
  cardName: { fontSize: 14, fontWeight: "600" },
  cardPassport: { fontSize: 12, marginTop: 1 },
  cardNet: { fontSize: 15, fontWeight: "700" },
  noneText: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  cardActions: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: "500" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  pickerModal: { borderRadius: 16, padding: 8, width: 260, maxHeight: 400 },
  pickerModalTitle: { fontSize: 15, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 10 },
  pickerOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  pickerOptionText: { fontSize: 14 },
  formSafe: { flex: 1 },
  formHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  formTitle: { fontSize: 16, fontWeight: "600" },
  formSub: { fontSize: 12, marginTop: 1 },
  cancelText: { fontSize: 16, width: 56 },
  saveText: { fontSize: 16, fontWeight: "600" },
  formBody: { padding: 20, gap: 12, paddingBottom: 40 },
  formSection: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  formField: { gap: 6 },
  formLabel: { fontSize: 10, letterSpacing: 0.5 },
  formInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, height: 48 },
  netRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  netLabel: { fontSize: 13 },
  netValue: { fontSize: 18, fontWeight: "700" },
  statusRow: { flexDirection: "row", gap: 10 },
  statusBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
  statusBtnText: { fontSize: 14, fontWeight: "500" },
});
