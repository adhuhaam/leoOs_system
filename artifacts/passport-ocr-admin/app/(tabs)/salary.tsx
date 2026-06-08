import { Feather } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import {
  useListSalaryRecords,
  useCreateSalaryRecord,
  useDeleteSalaryRecord,
  useListPassports,
  getListSalaryRecordsQueryKey,
  type SalaryRecord,
  type Passport,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const MONTHS_LONG = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function fmtMVR(val: string | number | null | undefined): string {
  const n = Number(val ?? "0");
  if (!val || isNaN(n)) return "MVR —";
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status, colors }: { status: string; colors: ReturnType<typeof useColors> }) {
  const confirmed = status === "confirmed";
  return (
    <View style={[styles.badge, { backgroundColor: confirmed ? "#05966918" : "#D9770618" }]}>
      <Feather name={confirmed ? "check-circle" : "clock"} size={10} color={confirmed ? "#059669" : "#D97706"} />
      <Text style={[styles.badgeText, { color: confirmed ? "#059669" : "#D97706" }]}>
        {confirmed ? "Confirmed" : "Draft"}
      </Text>
    </View>
  );
}

type CreateForm = {
  daysWorked: string;
  basicSalary: string;
  foodAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  deductions: string;
  otherExpenses: string;
  notes: string;
  status: "draft" | "confirmed";
};

const EMPTY_FORM: CreateForm = {
  daysWorked: "",
  basicSalary: "",
  foodAllowance: "0",
  transportAllowance: "0",
  otherAllowances: "0",
  deductions: "0",
  otherExpenses: "0",
  notes: "",
  status: "draft",
};

function computeNet(f: CreateForm): number {
  const n = (v: string) => parseFloat(v) || 0;
  return n(f.basicSalary) + n(f.foodAllowance) + n(f.transportAllowance) + n(f.otherAllowances) + n(f.otherExpenses) - n(f.deductions);
}

function SalaryCard({ record, isAdmin, colors, onDelete }: {
  record: SalaryRecord;
  isAdmin: boolean;
  colors: ReturnType<typeof useColors>;
  onDelete?: () => void;
}) {
  const initials = (record.employeeName ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0] ?? "").join("").toUpperCase() || "?";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        {isAdmin && (
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.foreground }]}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          {isAdmin && (
            <Text style={[styles.employeeName, { color: colors.foreground }]} numberOfLines={1}>
              {record.employeeName ?? "—"}
            </Text>
          )}
          <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>
            {MONTHS_LONG[record.month - 1]} {record.year}
            {record.daysWorked ? ` · ${record.daysWorked} days` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={[styles.netSalary, { color: colors.foreground }]}>{fmtMVR(record.netSalary)}</Text>
          <StatusBadge status={record.status} colors={colors} />
        </View>
        {isAdmin && onDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
            <Feather name="trash-2" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.breakdown}>
        {[
          { label: "Basic", val: record.basicSalary },
          { label: "Food", val: record.foodAllowance },
          { label: "Transport", val: record.transportAllowance },
          { label: "Other Allow.", val: record.otherAllowances },
          { label: "Other Exp.", val: record.otherExpenses },
        ]
          .filter((r) => parseFloat(r.val ?? "0") !== 0)
          .map((r) => (
            <View key={r.label} style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
              <Text style={[styles.breakdownValue, { color: colors.foreground }]}>{fmtMVR(r.val)}</Text>
            </View>
          ))}
        {parseFloat(record.deductions ?? "0") > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Deductions</Text>
            <Text style={[styles.breakdownValue, { color: "#DC2626" }]}>− {fmtMVR(record.deductions)}</Text>
          </View>
        )}
      </View>

      {record.notes ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.notes, { color: colors.mutedForeground }]}>{record.notes}</Text>
        </>
      ) : null}
    </View>
  );
}

export default function SalaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();

  const isAdmin = user?.role === "superuser" || user?.role === "admin";
  const now = new Date();

  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [selectedPassport, setSelectedPassport] = useState<Passport | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [createMonth, setCreateMonth] = useState(now.getMonth() + 1);
  const [createYear, setCreateYear] = useState(now.getFullYear());
  const [createMonthPickerOpen, setCreateMonthPickerOpen] = useState(false);
  const [createYearPickerOpen, setCreateYearPickerOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const queryParams = isAdmin ? { month: filterMonth, year: filterYear } : undefined;

  const { data, isLoading, isError, refetch, isFetching } = useListSalaryRecords(queryParams, {
    query: {
      queryKey: getListSalaryRecordsQueryKey(queryParams),
      refetchInterval: 30000,
    },
  });

  const { data: passportsRaw = [] } = useListPassports(undefined, {
    query: { queryKey: ["listPassports"], enabled: isAdmin },
  });
  const passports = passportsRaw as Passport[];

  const createMutation = useCreateSalaryRecord();
  const deleteMutation = useDeleteSalaryRecord();

  const records = (data ?? []) as SalaryRecord[];

  const sortedRecords = useMemo(
    () =>
      isAdmin
        ? records
        : [...records].sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month),
    [records, isAdmin],
  );

  const totalNet = useMemo(() => records.reduce((s, r) => s + parseFloat(r.netSalary || "0"), 0), [records]);
  const confirmedCount = useMemo(() => records.filter((r) => r.status === "confirmed").length, [records]);

  const filteredPassports = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return q
      ? passports.filter((p) =>
          (p.fullName ?? "").toLowerCase().includes(q) ||
          (p.passportNumber ?? "").toLowerCase().includes(q),
        )
      : passports;
  }, [passports, empSearch]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setSelectedPassport(null);
    setCreateMonth(filterMonth);
    setCreateYear(filterYear);
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!selectedPassport) {
      Alert.alert("Select employee", "Please choose an employee.");
      return;
    }
    if (!form.basicSalary || parseFloat(form.basicSalary) <= 0) {
      Alert.alert("Basic salary required", "Enter a basic salary amount.");
      return;
    }
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        data: {
          passportId: selectedPassport.id,
          month: createMonth,
          year: createYear,
          daysWorked: parseInt(form.daysWorked) || 0,
          basicSalary: form.basicSalary,
          foodAllowance: form.foodAllowance || "0",
          transportAllowance: form.transportAllowance || "0",
          otherAllowances: form.otherAllowances || "0",
          deductions: form.deductions || "0",
          otherExpenses: form.otherExpenses || "0",
          notes: form.notes || null,
          status: form.status,
        },
      });
      await qc.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
      setFilterMonth(createMonth);
      setFilterYear(createYear);
      setCreateOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create";
      Alert.alert(
        "Error",
        msg.toLowerCase().includes("already exists") || msg.includes("23505")
          ? "A salary record already exists for this employee, month, and year."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: SalaryRecord) {
    Alert.alert(
      "Delete salary record?",
      `Delete salary for ${record.employeeName ?? "this employee"} — ${MONTHS_LONG[record.month - 1]} ${record.year}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: record.id });
              await qc.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
            } catch {
              Alert.alert("Error", "Failed to delete salary record.");
            }
          },
        },
      ],
    );
  }

  const net = computeNet(form);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError && !isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Could not load salary data</Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontSize: 14 }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Salary</Text>
        <Text style={[styles.navSub, { color: colors.mutedForeground }]}>
          {isAdmin ? "Manage employee salaries" : "My salary"}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        {/* ── Admin view ── */}
        {isAdmin && (
          <>
            {/* Month/Year filter + New button */}
            <View style={styles.filterRow}>
              <TouchableOpacity onPress={() => setMonthPickerOpen(true)} style={[styles.filterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.filterBtnText, { color: colors.foreground }]}>{MONTHS_SHORT[filterMonth - 1]}</Text>
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setYearPickerOpen(true)} style={[styles.filterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.filterBtnText, { color: colors.foreground }]}>{filterYear}</Text>
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={openCreate} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                <Feather name="plus" size={16} color={colors.primaryForeground} />
                <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>New Salary</Text>
              </TouchableOpacity>
            </View>

            {/* Summary strip */}
            {records.length > 0 && (
              <View style={[styles.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Net</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{fmtMVR(totalNet)}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Records</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{records.length}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Confirmed</Text>
                  <Text style={[styles.summaryValue, { color: "#059669" }]}>{confirmedCount}</Text>
                </View>
              </View>
            )}

            {sortedRecords.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="dollar-sign" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No salary records</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Tap "New Salary" to create a salary record for {MONTHS_LONG[filterMonth - 1]} {filterYear}.
                </Text>
              </View>
            ) : (
              sortedRecords.map((r) => (
                <SalaryCard key={r.id} record={r} isAdmin colors={colors} onDelete={() => handleDelete(r)} />
              ))
            )}
          </>
        )}

        {/* ── Employee view ── */}
        {!isAdmin && (
          <>
            {sortedRecords.length === 0 ? (
              <>
                <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
                  <Text style={styles.heroLabel}>{MONTHS_LONG[now.getMonth()]} {now.getFullYear()}</Text>
                  <Text style={styles.heroAmount}>Pending</Text>
                  <Text style={styles.heroSub}>Your salary hasn't been processed yet</Text>
                </View>
                <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="clock" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Salary not yet generated</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Salaries are processed by your admin once the monthly invoice is marked as paid.
                  </Text>
                </View>
              </>
            ) : (
              <>
                {(() => {
                  const latest = sortedRecords[0];
                  return (
                    <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
                      <Text style={styles.heroLabel}>{MONTHS_LONG[(latest?.month ?? 1) - 1]} {latest?.year}</Text>
                      <Text style={styles.heroAmount}>{fmtMVR(latest?.netSalary)}</Text>
                      <Text style={styles.heroSub}>
                        {latest?.status === "confirmed" ? "✓ Confirmed" : "Draft — pending confirmation"}
                      </Text>
                    </View>
                  );
                })()}
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SALARY HISTORY</Text>
                {sortedRecords.map((r) => (
                  <SalaryCard key={r.id} record={r} isAdmin={false} colors={colors} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Filter — Month picker */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMonthPickerOpen(false)}>
          <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
            <ScrollView bounces={false}>
              <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Month</Text>
              {MONTHS_LONG.map((m, i) => (
                <TouchableOpacity key={i} onPress={() => { setFilterMonth(i + 1); setMonthPickerOpen(false); }} style={[styles.pickerItem, filterMonth === i + 1 && { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[styles.pickerItemText, { color: filterMonth === i + 1 ? colors.primary : colors.foreground }]}>{m}</Text>
                  {filterMonth === i + 1 && <Feather name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Filter — Year picker */}
      <Modal visible={yearPickerOpen} transparent animationType="fade" onRequestClose={() => setYearPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setYearPickerOpen(false)}>
          <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Year</Text>
            {YEARS.map((y) => (
              <TouchableOpacity key={y} onPress={() => { setFilterYear(y); setYearPickerOpen(false); }} style={[styles.pickerItem, filterYear === y && { backgroundColor: colors.primary + "18" }]}>
                <Text style={[styles.pickerItemText, { color: filterYear === y ? colors.primary : colors.foreground }]}>{y}</Text>
                {filterYear === y && <Feather name="check" size={14} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Create Salary Sheet ── */}
      <Modal visible={createOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setCreateOpen(false)} style={styles.sheetClose}>
                <Text style={[styles.sheetCloseText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New Salary Record</Text>
              <TouchableOpacity onPress={handleCreate} disabled={saving} style={styles.sheetSave}>
                <Text style={[styles.sheetSaveText, { color: saving ? colors.mutedForeground : colors.primary }]}>
                  {saving ? "Saving…" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">

              {/* Employee */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>EMPLOYEE</Text>
                <TouchableOpacity onPress={() => { setEmpSearch(""); setEmployeePickerOpen(true); }} style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="user" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.selectorBtnText, { color: selectedPassport ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                    {selectedPassport ? (selectedPassport.fullName ?? selectedPassport.passportNumber ?? "Selected") : "Select employee…"}
                  </Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Month / Year */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MONTH</Text>
                  <TouchableOpacity onPress={() => setCreateMonthPickerOpen(true)} style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.selectorBtnText, { color: colors.foreground }]}>{MONTHS_LONG[createMonth - 1]}</Text>
                    <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>YEAR</Text>
                  <TouchableOpacity onPress={() => setCreateYearPickerOpen(true)} style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.selectorBtnText, { color: colors.foreground }]}>{createYear}</Text>
                    <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Days Worked */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DAYS WORKED (QTY)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="e.g. 26"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  value={form.daysWorked}
                  onChangeText={(v) => setForm((p) => ({ ...p, daysWorked: v }))}
                />
              </View>

              {/* Basic Salary */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>BASIC SALARY (MVR) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  value={form.basicSalary}
                  onChangeText={(v) => setForm((p) => ({ ...p, basicSalary: v }))}
                />
                <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>Agency salary from passport</Text>
              </View>

              {/* Allowances */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FOOD ALLOW.</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" value={form.foodAllowance} onChangeText={(v) => setForm((p) => ({ ...p, foodAllowance: v }))} />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRANSPORT</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" value={form.transportAllowance} onChangeText={(v) => setForm((p) => ({ ...p, transportAllowance: v }))} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>OTHER ALLOW.</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" value={form.otherAllowances} onChangeText={(v) => setForm((p) => ({ ...p, otherAllowances: v }))} />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>OTHER EXP.</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" value={form.otherExpenses} onChangeText={(v) => setForm((p) => ({ ...p, otherExpenses: v }))} />
                </View>
              </View>

              {/* Deductions */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: "#DC2626" }]}>DEDUCTIONS</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  value={form.deductions}
                  onChangeText={(v) => setForm((p) => ({ ...p, deductions: v }))}
                />
              </View>

              {/* Net preview */}
              <View style={[styles.netPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.netLabel, { color: colors.mutedForeground }]}>Net Salary</Text>
                <Text style={[styles.netValue, { color: net < 0 ? "#DC2626" : colors.foreground }]}>
                  {`MVR ${net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </Text>
              </View>

              {/* Status chips */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>STATUS</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {(["draft", "confirmed"] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setForm((p) => ({ ...p, status: s }))}
                      style={[styles.statusChip, { backgroundColor: form.status === s ? colors.primary : colors.card, borderColor: form.status === s ? colors.primary : colors.border }]}
                    >
                      <Text style={[styles.statusChipText, { color: form.status === s ? colors.primaryForeground : colors.mutedForeground }]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Optional notes…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  value={form.notes}
                  onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Create — month picker */}
        <Modal visible={createMonthPickerOpen} transparent animationType="fade" onRequestClose={() => setCreateMonthPickerOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setCreateMonthPickerOpen(false)}>
            <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
              <ScrollView bounces={false}>
                <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Month</Text>
                {MONTHS_LONG.map((m, i) => (
                  <TouchableOpacity key={i} onPress={() => { setCreateMonth(i + 1); setCreateMonthPickerOpen(false); }} style={[styles.pickerItem, createMonth === i + 1 && { backgroundColor: colors.primary + "18" }]}>
                    <Text style={[styles.pickerItemText, { color: createMonth === i + 1 ? colors.primary : colors.foreground }]}>{m}</Text>
                    {createMonth === i + 1 && <Feather name="check" size={14} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        {/* Create — year picker */}
        <Modal visible={createYearPickerOpen} transparent animationType="fade" onRequestClose={() => setCreateYearPickerOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setCreateYearPickerOpen(false)}>
            <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Year</Text>
              {YEARS.map((y) => (
                <TouchableOpacity key={y} onPress={() => { setCreateYear(y); setCreateYearPickerOpen(false); }} style={[styles.pickerItem, createYear === y && { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[styles.pickerItemText, { color: createYear === y ? colors.primary : colors.foreground }]}>{y}</Text>
                  {createYear === y && <Feather name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Employee picker sheet */}
        <Modal visible={employeePickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEmployeePickerOpen(false)}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setEmployeePickerOpen(false)} style={styles.sheetClose}>
                <Text style={[styles.sheetCloseText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Select Employee</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, margin: 16 }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search name or passport…"
                placeholderTextColor={colors.mutedForeground}
                value={empSearch}
                onChangeText={setEmpSearch}
                autoFocus
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {filteredPassports.map((p) => {
                const initials = (p.fullName ?? "?").split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase();
                return (
                  <TouchableOpacity key={p.id} onPress={() => { setSelectedPassport(p); setForm((prev) => ({ ...prev, basicSalary: p.agencySalary ?? prev.basicSalary })); setEmployeePickerOpen(false); }} style={[styles.empRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.empAvatar, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.empAvatarText, { color: colors.foreground }]}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.empName, { color: colors.foreground }]} numberOfLines={1}>{p.fullName ?? "—"}</Text>
                      <Text style={[styles.empSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {p.passportNumber ?? ""}
                        {p.nationality ? ` · ${p.nationality}` : ""}
                      </Text>
                    </View>
                    {selectedPassport?.id === p.id && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
              {filteredPassports.length === 0 && (
                <Text style={[{ color: colors.mutedForeground, padding: 24, textAlign: "center", fontSize: 14 }]}>No employees found</Text>
              )}
            </ScrollView>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  navBar: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  navTitle: { fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  navSub: { fontSize: 13 },

  container: { padding: 16, gap: 12, paddingBottom: 48 },

  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  filterBtnText: { fontSize: 14, fontWeight: "600" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { fontSize: 14, fontWeight: "600" },

  summaryRow: { flexDirection: "row", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  summaryItem: { flex: 1, alignItems: "center", padding: 14, gap: 3 },
  summaryLabel: { fontSize: 11, letterSpacing: 0.3 },
  summaryValue: { fontSize: 18, fontWeight: "700" },
  summaryDivider: { width: StyleSheet.hairlineWidth },

  sectionTitle: { fontSize: 11, letterSpacing: 0.8, fontWeight: "600", marginTop: 4 },

  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "600" },
  employeeName: { fontSize: 14, fontWeight: "600" },
  monthLabel: { fontSize: 12, marginTop: 1 },
  netSalary: { fontSize: 16, fontWeight: "700" },
  deleteBtn: { padding: 4, marginLeft: 4 },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  breakdown: { padding: 12, gap: 6 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 12 },
  breakdownValue: { fontSize: 12, fontWeight: "500" },
  notes: { fontSize: 12, padding: 12, fontStyle: "italic" },

  heroCard: { borderRadius: 20, padding: 28, alignItems: "center", gap: 6 },
  heroLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", letterSpacing: 0.5 },
  heroAmount: { fontSize: 36, fontWeight: "700", color: "#fff" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  emptyCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 28, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 24 },
  pickerCard: { borderRadius: 18, overflow: "hidden", width: "100%", maxWidth: 340, maxHeight: 460 },
  pickerTitle: { fontSize: 14, fontWeight: "700", padding: 16, paddingBottom: 8 },
  pickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13 },
  pickerItemText: { fontSize: 15 },

  sheetContainer: { flex: 1 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  sheetClose: { width: 60 },
  sheetCloseText: { fontSize: 16 },
  sheetSave: { width: 60, alignItems: "flex-end" },
  sheetSaveText: { fontSize: 16, fontWeight: "600" },
  sheetContent: { padding: 20, gap: 16, paddingBottom: 60 },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6 },
  selectorBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  selectorBtnText: { flex: 1, fontSize: 15 },

  input: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { height: 80, textAlignVertical: "top" },

  netPreview: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  netLabel: { fontSize: 13 },
  netValue: { fontSize: 18, fontWeight: "700" },

  statusChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  statusChipText: { fontSize: 14, fontWeight: "600" },

  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 15 },

  empRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  empAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  empAvatarText: { fontSize: 15, fontWeight: "600" },
  empName: { fontSize: 15, fontWeight: "600" },
  empSub: { fontSize: 12, marginTop: 2 },
});
