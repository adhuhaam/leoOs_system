import { Feather } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import {
  type Passport,
  getListPassportsQueryKey,
  useListPassports,
} from "@workspace/api-client-react";
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

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMVR(val: string | null | undefined): string {
  const n = Number(val ?? "0");
  if (!val || isNaN(n)) return "MVR —";
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

function InfoRow({ icon, label, value, valueColor }: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  valueColor?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={14} color={colors.mutedForeground} style={styles.infoIcon} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor ?? colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function SalaryScreen() {
  const colors = useColors();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch, isFetching } = useListPassports(undefined, {
    query: {
      queryKey: getListPassportsQueryKey(),
      refetchInterval: 30000,
    },
  });

  const passports = useMemo(() => {
    const all = (data ?? []) as Passport[];
    return all.filter((p) => p.agencySalary && Number(p.agencySalary) > 0);
  }, [data]);

  const totalSalary = useMemo(
    () => passports.reduce((sum, p) => sum + Number(p.agencySalary ?? 0), 0),
    [passports],
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.primary} />
      }
    >
      {/* ── Summary hero ── */}
      <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.heroLabel}>Monthly Agency Salary</Text>
        <Text style={styles.heroAmount}>{fmtMVR(String(totalSalary))}</Text>
        {passports.length > 0 && (
          <Text style={styles.heroSub}>
            Across {passports.length} employee{passports.length !== 1 ? "s" : ""}
          </Text>
        )}
      </View>

      {/* ── Salary breakdown table ── */}
      {passports.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="dollar-sign" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No salary data yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Agency salaries are set by your admin when editing employee records.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>EMPLOYEES</Text>

          {passports.map((p) => (
            <View
              key={p.id}
              style={[styles.salaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* Name + salary hero */}
              <View style={styles.cardHeader}>
                <View style={styles.cardAvatar}>
                  <Text style={[styles.cardAvatarText, { color: colors.primary }]}>
                    {(p.fullName ?? "?").split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
                    {p.fullName ?? "Unknown"}
                  </Text>
                  {p.clientName && (
                    <Text style={[styles.cardClient, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {p.clientName}
                    </Text>
                  )}
                </View>
                <View style={[styles.salaryBadge, { backgroundColor: colors.primary + "14" }]}>
                  <Text style={[styles.salaryBadgeText, { color: colors.primary }]}>
                    {fmtMVR(p.agencySalary)}
                  </Text>
                  <Text style={[styles.salaryPeriod, { color: colors.primary + "99" }]}>/mo</Text>
                </View>
              </View>

              {/* Details */}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.detailsGrid}>
                <InfoRow icon="hash" label="Passport" value={p.passportNumber ?? "—"} />
                {p.workPermitNumber && (
                  <InfoRow icon="briefcase" label="Work Permit" value={p.workPermitNumber} />
                )}
                {p.nationality && (
                  <InfoRow icon="globe" label="Nationality" value={p.nationality} />
                )}
                {p.dateOfExpiry && (
                  <InfoRow
                    icon="calendar"
                    label="PP Expiry"
                    value={fmtDate(p.dateOfExpiry)}
                    valueColor={
                      new Date(p.dateOfExpiry) < new Date() ? "#DC2626" : undefined
                    }
                  />
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  loadingText: { fontSize: 13, marginTop: 4 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14 },

  heroCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 6,
  },
  heroLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", letterSpacing: 0.5 },
  heroAmount: { fontSize: 36, fontWeight: "700", color: "#fff" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  sectionTitle: { fontSize: 11, letterSpacing: 0.8, fontWeight: "600", marginTop: 4 },

  salaryCard: {
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
  cardAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(99,102,241,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardAvatarText: { fontSize: 15, fontWeight: "700" },
  cardName: { fontSize: 15, fontWeight: "600" },
  cardClient: { fontSize: 12, marginTop: 1 },
  salaryBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  salaryBadgeText: { fontSize: 14, fontWeight: "700" },
  salaryPeriod: { fontSize: 10 },

  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  detailsGrid: { padding: 12, gap: 6 },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoIcon: { width: 18 },
  infoLabel: { fontSize: 12, width: 88 },
  infoValue: { fontSize: 12, flex: 1 },

  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
