import { Feather } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import {
  useListSalaryRecords,
  getListSalaryRecordsQueryKey,
  type SalaryRecord,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const MONTHS_LONG = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

function SalaryCard({ record, isAdmin, colors }: {
  record: SalaryRecord;
  isAdmin: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const initials = (record.employeeName ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0] ?? "").join("").toUpperCase() || "?";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
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
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={[styles.netSalary, { color: colors.foreground }]}>{fmtMVR(record.netSalary)}</Text>
          <StatusBadge status={record.status} colors={colors} />
        </View>
      </View>

      {/* Breakdown */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.breakdown}>
        {[
          { label: "Basic", val: record.basicSalary, color: colors.foreground },
          { label: "Food", val: record.foodAllowance, color: colors.foreground },
          { label: "Transport", val: record.transportAllowance, color: colors.foreground },
          { label: "Other Allowances", val: record.otherAllowances, color: colors.foreground },
          { label: "Other Expenses", val: record.otherExpenses, color: colors.foreground },
          { label: "Deductions", val: record.deductions, color: "#DC2626" },
        ]
          .filter((r) => parseFloat(r.val ?? "0") !== 0)
          .map((r) => (
            <View key={r.label} style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
              <Text style={[styles.breakdownValue, { color: r.color }]}>
                {r.label === "Deductions" ? `− ${fmtMVR(r.val)}` : fmtMVR(r.val)}
              </Text>
            </View>
          ))}
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
  const { user } = useAuth();

  const isAdmin = user?.role === "superuser" || user?.role === "admin";
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data, isLoading, isError, refetch, isFetching } = useListSalaryRecords(undefined, {
    query: {
      queryKey: getListSalaryRecordsQueryKey(),
      refetchInterval: 30000,
    },
  });

  const records = data ?? [];

  // For employee: their records are already filtered server-side by linkedEntityId.
  // For admin: all records — group by month for a summary view.
  const { currentMonthRecords, totalCurrentMonth, confirmedCount } = useMemo(() => {
    const current = records.filter((r) => r.month === currentMonth && r.year === currentYear);
    const total = current.reduce((s, r) => s + parseFloat(r.netSalary || "0"), 0);
    const confirmed = current.filter((r) => r.status === "confirmed").length;
    return { currentMonthRecords: current, totalCurrentMonth: total, confirmedCount: confirmed };
  }, [records, currentMonth, currentYear]);

  // For employee: show all their records sorted most-recent first
  const sortedRecords = useMemo(
    () =>
      [...records].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.month - a.month;
      }),
    [records],
  );

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading salary data…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Could not load salary data</Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Navigation bar */}
      <View style={[styles.navBar, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Salary</Text>
        <Text style={[styles.navSub, { color: colors.mutedForeground }]}>
          {isAdmin ? "All employees" : "My salary"}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.primary} />
        }
      >
        {/* ── Admin view ── */}
        {isAdmin && (
          <>
            {/* Summary hero */}
            <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
              <Text style={styles.heroLabel}>{MONTHS_LONG[currentMonth - 1]} {currentYear} — Total</Text>
              <Text style={styles.heroAmount}>{fmtMVR(totalCurrentMonth)}</Text>
              {currentMonthRecords.length > 0 && (
                <Text style={styles.heroSub}>
                  {confirmedCount} confirmed · {currentMonthRecords.length - confirmedCount} draft
                </Text>
              )}
            </View>

            {/* Go to generator CTA */}
            <Pressable
              onPress={() => router.push("/admin/salary-generator" as never)}
              style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.ctaIcon, { backgroundColor: colors.primary + "14" }]}>
                <Feather name="dollar-sign" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Salary Generator</Text>
                <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>Generate & manage monthly salaries</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>

            {/* Current month records */}
            {currentMonthRecords.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="dollar-sign" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No salary records yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Use Salary Generator to create salary records for {MONTHS_LONG[currentMonth - 1]}.
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                  THIS MONTH · {currentMonthRecords.length} RECORDS
                </Text>
                {currentMonthRecords.map((r) => (
                  <SalaryCard key={r.id} record={r} isAdmin colors={colors} />
                ))}
              </>
            )}
          </>
        )}

        {/* ── Employee view ── */}
        {!isAdmin && (
          <>
            {sortedRecords.length === 0 ? (
              <>
                {/* Current month pending hero */}
                <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
                  <Text style={styles.heroLabel}>{MONTHS_LONG[currentMonth - 1]} {currentYear}</Text>
                  <Text style={styles.heroAmount}>Pending</Text>
                  <Text style={styles.heroSub}>Your salary hasn't been processed yet</Text>
                </View>

                <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="clock" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Salary not yet generated</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Salaries are processed by your admin once the monthly invoice is marked as paid. Check back soon.
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* Latest salary hero */}
                {(() => {
                  const latest = sortedRecords[0];
                  return (
                    <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
                      <Text style={styles.heroLabel}>
                        {MONTHS_LONG[(latest?.month ?? 1) - 1]} {latest?.year}
                      </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  loadingText: { fontSize: 13, marginTop: 4 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { fontSize: 14, color: "#fff" },

  navBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  navTitle: { fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  navSub: { fontSize: 13 },

  container: { padding: 16, gap: 12, paddingBottom: 48 },

  heroCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 6,
  },
  heroLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", letterSpacing: 0.5 },
  heroAmount: { fontSize: 36, fontWeight: "700", color: "#fff" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  ctaTitle: { fontSize: 15, fontWeight: "600" },
  ctaSub: { fontSize: 12, marginTop: 1 },

  sectionTitle: { fontSize: 11, letterSpacing: 0.8, fontWeight: "600", marginTop: 4 },

  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "600" },
  employeeName: { fontSize: 14, fontWeight: "600" },
  monthLabel: { fontSize: 12, marginTop: 1 },
  netSalary: { fontSize: 16, fontWeight: "700" },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },

  breakdown: { padding: 12, gap: 6 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { fontSize: 12 },
  breakdownValue: { fontSize: 12, fontWeight: "500" },

  notes: { fontSize: 12, padding: 12, fontStyle: "italic" },

  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20, color: "#999" },
});
