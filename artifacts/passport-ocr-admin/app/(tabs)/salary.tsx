import { Feather } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
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
import { SafeAreaView } from "react-native-safe-area-context";

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

type SalaryForm = {
  daysWorked: string;
  basicSalary: string;
  clientSalary: string;
  foodAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  deductions: string;
  otherExpenses: string;
  notes: string;
  status: "draft" | "confirmed";
};

const EMPTY_FORM: SalaryForm = {
  daysWorked: "",
  basicSalary: "",
  clientSalary: "0",
  foodAllowance: "0",
  transportAllowance: "0",
  otherAllowances: "0",
  deductions: "0",
  otherExpenses: "0",
  notes: "",
  status: "draft",
};

function computeNet(f: SalaryForm): number {
  const n = (v: string) => parseFloat(v) || 0;
  return n(f.basicSalary) + n(f.foodAllowance) + n(f.transportAllowance) + n(f.otherAllowances) + n(f.otherExpenses) - n(f.deductions);
}

function SalaryCard({ record, colors, onDelete }: {
  record: SalaryRecord;
  colors: ReturnType<typeof useColors>;
  onDelete?: () => void;
}) {
  const initials = (record.employeeName ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0] ?? "").join("").toUpperCase() || "?";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.avatarText, { color: colors.foreground }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.employeeName, { color: colors.foreground }]} numberOfLines={1}>
            {record.employeeName ?? "—"}
          </Text>
          <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>
            {MONTHS_LONG[record.month - 1]} {record.year}
            {record.daysWorked ? ` · ${record.daysWorked} days` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={[styles.netSalary, { color: colors.foreground }]}>{fmtMVR(record.netSalary)}</Text>
          <StatusBadge status={record.status} colors={colors} />
        </View>
        {onDelete && (
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

function SalarySlip({ record, colors }: { record: SalaryRecord; colors: ReturnType<typeof useColors> }) {
  const rows: { label: string; val: string | null | undefined; deduction?: boolean }[] = [
    { label: "Basic Salary", val: record.basicSalary },
    { label: "Food Allowance", val: record.foodAllowance },
    { label: "Transport Allowance", val: record.transportAllowance },
    { label: "Other Allowances", val: record.otherAllowances },
    { label: "Other Expenses", val: record.otherExpenses },
  ].filter((r) => parseFloat(r.val ?? "0") !== 0);

  const hasDeductions = parseFloat(record.deductions ?? "0") > 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Slip header */}
      <View style={{ alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 10, letterSpacing: 2, color: colors.mutedForeground, textTransform: "uppercase", fontWeight: "600" }}>Salary Slip</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginTop: 2 }}>
          {MONTHS_LONG[(record.month ?? 1) - 1]} {record.year}
        </Text>
        {record.daysWorked ? (
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>
            {record.daysWorked} day{Number(record.daysWorked) !== 1 ? "s" : ""} worked
          </Text>
        ) : null}
        <View style={{ marginTop: 6 }}>
          <StatusBadge status={record.status} colors={colors} />
        </View>
      </View>

      {/* Earnings */}
      <View style={{ paddingHorizontal: 4, paddingTop: 10 }}>
        <Text style={{ fontSize: 9, letterSpacing: 1.5, color: "#10B981", fontWeight: "700", marginBottom: 6, textTransform: "uppercase" }}>Earnings</Text>
        {rows.map((r) => (
          <View key={r.label} style={[styles.breakdownRow, { paddingVertical: 5 }]}>
            <Text style={[styles.breakdownLabel, { color: colors.mutedForeground, flex: 1 }]}>{r.label}</Text>
            <Text style={[styles.breakdownValue, { color: colors.foreground }]}>{fmtMVR(r.val)}</Text>
          </View>
        ))}
        {rows.length === 0 && (
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Basic Salary</Text>
            <Text style={[styles.breakdownValue, { color: colors.foreground }]}>{fmtMVR(record.basicSalary)}</Text>
          </View>
        )}
      </View>

      {/* Deductions */}
      {hasDeductions && (
        <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, color: "#EF4444", fontWeight: "700", marginBottom: 6, textTransform: "uppercase" }}>Deductions</Text>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Total Deductions</Text>
            <Text style={[styles.breakdownValue, { color: "#DC2626" }]}>− {fmtMVR(record.deductions)}</Text>
          </View>
        </View>
      )}

      {/* Net salary total */}
      <View style={{ marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, paddingHorizontal: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Net Salary</Text>
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#10B981", fontVariant: ["tabular-nums"] }}>
          MVR {parseFloat(record.netSalary || "0").toFixed(2)}
        </Text>
      </View>

      {record.notes ? (
        <Text style={[styles.notes, { color: colors.mutedForeground, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          Note: {record.notes}
        </Text>
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

  // Filter state (admin)
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Form modal state
  const [formTarget, setFormTarget] = useState<{ passport: Passport; existing: SalaryRecord | null } | null>(null);
  const [form, setForm] = useState<SalaryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formMonthPickerOpen, setFormMonthPickerOpen] = useState(false);
  const [formYearPickerOpen, setFormYearPickerOpen] = useState(false);
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());

  // Data
  const queryParams = isAdmin ? { month: filterMonth, year: filterYear } : undefined;
  const { data, isLoading, isError, refetch, isFetching } = useListSalaryRecords(queryParams, {
    query: {
      queryKey: getListSalaryRecordsQueryKey(queryParams),
      refetchInterval: 30000,
    },
  });
  const { data: passportsRaw = [], isLoading: passportsLoading } = useListPassports(undefined, {
    query: { queryKey: ["listPassports"], enabled: isAdmin },
  });
  const passports = (passportsRaw as Passport[]).filter(
    (p) => p.employeeType === "casual",
  );

  const createMutation = useCreateSalaryRecord();
  const updateMutation = useUpdateSalaryRecord();
  const deleteMutation = useDeleteSalaryRecord();

  const records = (data ?? []) as SalaryRecord[];

  // Salary map: passportId → record (for current filter month/year)
  const salaryMap = useMemo(() => {
    const m = new Map<number, SalaryRecord>();
    for (const r of records) m.set(r.passportId, r);
    return m;
  }, [records]);

  const totalNet = useMemo(() => records.reduce((s, r) => s + parseFloat(r.netSalary || "0"), 0), [records]);
  const confirmedCount = useMemo(() => records.filter((r) => r.status === "confirmed").length, [records]);

  // Filtered employee list for admin roster
  const filteredPassports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? passports.filter((p) =>
          (p.fullName ?? "").toLowerCase().includes(q) ||
          (p.passportNumber ?? "").toLowerCase().includes(q),
        )
      : passports;
  }, [passports, search]);

  // Employee view: sorted newest-first
  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month),
    [records],
  );

  function openForm(passport: Passport, existing: SalaryRecord | null) {
    setFormMonth(existing ? existing.month : filterMonth);
    setFormYear(existing ? existing.year : filterYear);
    if (existing) {
      setForm({
        daysWorked: String(existing.daysWorked ?? ""),
        basicSalary: existing.basicSalary,
        clientSalary: existing.clientSalary ?? "0",
        foodAllowance: existing.foodAllowance,
        transportAllowance: existing.transportAllowance,
        otherAllowances: existing.otherAllowances,
        deductions: existing.deductions,
        otherExpenses: existing.otherExpenses,
        notes: existing.notes ?? "",
        status: existing.status as "draft" | "confirmed",
      });
    } else {
      setForm({ ...EMPTY_FORM, basicSalary: passport.agencySalary ?? "", clientSalary: passport.clientSalary ?? passport.agencySalary ?? "0" });
    }
    setFormTarget({ passport, existing });
  }

  async function handleSave() {
    if (!formTarget) return;
    const { passport, existing } = formTarget;
    if (!form.basicSalary || parseFloat(form.basicSalary) <= 0) {
      Alert.alert("Basic salary missing", "The employee has no agency salary set on their passport record.");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          data: {
            daysWorked: parseInt(form.daysWorked) || 0,
            basicSalary: form.basicSalary,
            clientSalary: form.clientSalary || "0",
            foodAllowance: form.foodAllowance || "0",
            transportAllowance: form.transportAllowance || "0",
            otherAllowances: form.otherAllowances || "0",
            deductions: form.deductions || "0",
            otherExpenses: form.otherExpenses || "0",
            notes: form.notes || null,
            status: form.status,
          },
        });
      } else {
        await createMutation.mutateAsync({
          data: {
            passportId: passport.id,
            month: formMonth,
            year: formYear,
            daysWorked: parseInt(form.daysWorked) || 0,
            basicSalary: form.basicSalary,
            clientSalary: form.clientSalary || "0",
            foodAllowance: form.foodAllowance || "0",
            transportAllowance: form.transportAllowance || "0",
            otherAllowances: form.otherAllowances || "0",
            deductions: form.deductions || "0",
            otherExpenses: form.otherExpenses || "0",
            notes: form.notes || null,
            status: form.status,
          },
        });
        setFilterMonth(formMonth);
        setFilterYear(formYear);
      }
      await qc.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
      setFormTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      Alert.alert(
        "Failed",
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

  const netPreview = computeNet(form);
  const dataLoading = isLoading || (isAdmin && passportsLoading);

  if (dataLoading) {
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
          {isAdmin ? "Generate & manage employee salaries" : "My salary"}
        </Text>
      </View>

      {/* ── ADMIN VIEW ── */}
      {isAdmin && (
        <>
          {/* Month / Year filter */}
          <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setMonthPickerOpen(true)} style={[styles.filterBtn, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.filterBtnText, { color: colors.foreground }]}>{MONTHS_LONG[filterMonth - 1]}</Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setYearPickerOpen(true)} style={[styles.filterBtn, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.filterBtnText, { color: colors.foreground }]}>{filterYear}</Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
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
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Summary strip */}
          {records.length > 0 && (
            <View style={[styles.summaryRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Records</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>{records.length} / {passports.length}</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Confirmed</Text>
                <Text style={[styles.summaryValue, { color: "#059669" }]}>{confirmedCount}</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Pending</Text>
                <Text style={[styles.summaryValue, { color: "#D97706" }]}>{passports.length - records.length}</Text>
              </View>
            </View>
          )}

          {/* Employee roster */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.rosterList}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isFetching && !dataLoading} onRefresh={() => { refetch(); }} tintColor={colors.primary} />}
          >
            {filteredPassports.length === 0 ? (
              <View style={styles.center}>
                <Feather name="users" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No employees found</Text>
              </View>
            ) : (
              filteredPassports.map((p) => {
                const record = salaryMap.get(p.id) ?? null;
                const initials = (p.fullName ?? "?").split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase();
                const hasSalary = record !== null;
                const isConfirmed = record?.status === "confirmed";

                return (
                  <View key={p.id} style={[styles.rosterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.rosterRow}>
                      <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.avatarText, { color: colors.foreground }]}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.employeeName, { color: colors.foreground }]} numberOfLines={1}>{p.fullName ?? "—"}</Text>
                        <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>{p.passportNumber ?? "—"}</Text>
                      </View>
                      {hasSalary ? (
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Text style={[styles.netSalary, { color: colors.foreground }]}>{fmtMVR(record!.netSalary)}</Text>
                          <View style={[styles.badge, { backgroundColor: isConfirmed ? "#05966918" : "#D9770618" }]}>
                            <Text style={[styles.badgeText, { color: isConfirmed ? "#059669" : "#D97706" }]}>
                              {isConfirmed ? "Confirmed" : "Draft"}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={[styles.noSalaryText, { color: colors.mutedForeground }]}>No salary</Text>
                      )}
                    </View>
                    <View style={[styles.rosterActions, { borderTopColor: colors.border }]}>
                      <TouchableOpacity
                        onPress={() => openForm(p, record)}
                        style={[styles.actionBtn, { backgroundColor: colors.primary + "14" }]}
                      >
                        <Feather name={hasSalary ? "edit-2" : "plus"} size={14} color={colors.primary} />
                        <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                          {hasSalary ? "Edit" : "Generate"}
                        </Text>
                      </TouchableOpacity>
                      {hasSalary && (
                        <TouchableOpacity
                          onPress={() => handleDelete(record!)}
                          style={[styles.actionBtn, { backgroundColor: "#DC262614" }]}
                        >
                          <Feather name="trash-2" size={14} color="#DC2626" />
                          <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}

      {/* ── EMPLOYEE VIEW ── */}
      {!isAdmin && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.primary} />}
        >
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
                <SalarySlip key={r.id} record={r} colors={colors} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ── MODALS ── */}

      {/* Filter — Month */}
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

      {/* Filter — Year */}
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

      {/* Salary Form Modal */}
      <Modal
        visible={formTarget !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormTarget(null)}
      >
        {formTarget && (
          <SafeAreaView style={[styles.sheetContainer, { backgroundColor: colors.background }]} edges={["bottom"]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              {/* Header */}
              <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setFormTarget(null)} style={styles.sheetClose}>
                  <Text style={[styles.sheetCloseText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                    {formTarget.existing ? "Edit Salary" : "Generate Salary"}
                  </Text>
                  <Text style={[styles.sheetSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {formTarget.passport.fullName ?? "—"} · {MONTHS_SHORT[formMonth - 1]} {formYear}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.sheetSave, { opacity: saving ? 0.5 : 1 }]}>
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.sheetSaveText, { color: colors.primary }]}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">

                {/* Month / Year (only for create) */}
                {!formTarget.existing && (
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MONTH</Text>
                      <TouchableOpacity onPress={() => setFormMonthPickerOpen(true)} style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.selectorBtnText, { color: colors.foreground }]}>{MONTHS_LONG[formMonth - 1]}</Text>
                        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>YEAR</Text>
                      <TouchableOpacity onPress={() => setFormYearPickerOpen(true)} style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.selectorBtnText, { color: colors.foreground }]}>{formYear}</Text>
                        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

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

                {/* Employee salary */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>EMPLOYEE SALARY (MVR)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      value={form.basicSalary}
                      onChangeText={(v) => setForm((p) => ({ ...p, basicSalary: v }))}
                    />
                    <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>What you pay</Text>
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CLIENT BILLING RATE (MVR)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      value={form.clientSalary}
                      onChangeText={(v) => setForm((p) => ({ ...p, clientSalary: v }))}
                    />
                    <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>What you charge</Text>
                  </View>
                </View>
                {(() => {
                  const margin = Number(form.clientSalary || 0) - Number(form.basicSalary || 0);
                  const mc = margin > 0 ? "#059669" : margin < 0 ? "#DC2626" : colors.mutedForeground;
                  return (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Monthly margin</Text>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: mc }}>
                        {margin >= 0 ? "+" : ""}{margin.toFixed(2)} MVR
                      </Text>
                    </View>
                  );
                })()}

                {/* Allowances */}
                <Text style={[styles.sectionHeader, { color: "#059669" }]}>EARNINGS</Text>
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
                <Text style={[styles.sectionHeader, { color: "#DC2626" }]}>DEDUCTIONS</Text>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TOTAL DEDUCTIONS</Text>
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
                  <Text style={[styles.netValue, { color: netPreview < 0 ? "#DC2626" : colors.foreground }]}>
                    {`MVR ${netPreview.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </Text>
                </View>

                {/* Status */}
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
            </KeyboardAvoidingView>

            {/* Form — month picker */}
            <Modal visible={formMonthPickerOpen} transparent animationType="fade" onRequestClose={() => setFormMonthPickerOpen(false)}>
              <Pressable style={styles.modalOverlay} onPress={() => setFormMonthPickerOpen(false)}>
                <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                  <ScrollView bounces={false}>
                    <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Month</Text>
                    {MONTHS_LONG.map((m, i) => (
                      <TouchableOpacity key={i} onPress={() => { setFormMonth(i + 1); setFormMonthPickerOpen(false); }} style={[styles.pickerItem, formMonth === i + 1 && { backgroundColor: colors.primary + "18" }]}>
                        <Text style={[styles.pickerItemText, { color: formMonth === i + 1 ? colors.primary : colors.foreground }]}>{m}</Text>
                        {formMonth === i + 1 && <Feather name="check" size={14} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>

            {/* Form — year picker */}
            <Modal visible={formYearPickerOpen} transparent animationType="fade" onRequestClose={() => setFormYearPickerOpen(false)}>
              <Pressable style={styles.modalOverlay} onPress={() => setFormYearPickerOpen(false)}>
                <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Year</Text>
                  {YEARS.map((y) => (
                    <TouchableOpacity key={y} onPress={() => { setFormYear(y); setFormYearPickerOpen(false); }} style={[styles.pickerItem, formYear === y && { backgroundColor: colors.primary + "18" }]}>
                      <Text style={[styles.pickerItemText, { color: formYear === y ? colors.primary : colors.foreground }]}>{y}</Text>
                      {formYear === y && <Feather name="check" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>
          </SafeAreaView>
        )}
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

  filterBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  filterBtnText: { fontSize: 14, fontWeight: "500" },
  totalLabel: { fontSize: 10, letterSpacing: 0.4 },
  totalAmount: { fontSize: 15, fontWeight: "700" },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  summaryRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2 },
  summaryLabel: { fontSize: 10, letterSpacing: 0.3 },
  summaryValue: { fontSize: 15, fontWeight: "700" },
  summaryDivider: { width: StyleSheet.hairlineWidth },

  rosterList: { padding: 16, gap: 10, paddingBottom: 48 },
  rosterCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rosterActions: { flexDirection: "row", gap: 8, padding: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  noSalaryText: { fontSize: 12 },

  container: { padding: 16, gap: 12, paddingBottom: 48 },
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
  sheetSub: { fontSize: 12, marginTop: 2 },
  sheetClose: { width: 60 },
  sheetCloseText: { fontSize: 16 },
  sheetSave: { width: 60, alignItems: "flex-end" },
  sheetSaveText: { fontSize: 16, fontWeight: "600" },

  formBody: { padding: 20, gap: 16, paddingBottom: 60 },
  sectionHeader: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: 4 },

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
});
