import { Feather } from "@expo/vector-icons";
import {
  getListPassportsQueryKey,
  type Passport,
  useListPassports,
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

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const ROLE_LABEL: Record<string, string> = {
  superuser: "Superuser",
  admin: "Admin",
  client: "Client",
  company: "Company",
  employee: "Employee",
  agent: "Agent",
};

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  superuser: { bg: "#7C3AED18", text: "#7C3AED" },
  admin:     { bg: "#0F172A18", text: "#0F172A" },
  client:    { bg: "#0EA5E918", text: "#0369A1" },
  company:   { bg: "#10B98118", text: "#047857" },
  employee:  { bg: "#F59E0B18", text: "#B45309" },
  agent:     { bg: "#EC489918", text: "#BE185D" },
};

type StatGroup = {
  label: string;
  value: number;
  icon: keyof typeof Feather.glyphMap;
  color: string;
};

const STATUS_GROUPS = {
  processing: ["processing"],
  active: ["arrived", "employed", "handedover", "approved", "ticket_issued"],
  attention: ["failed", "incomplete", "return_back_from_worksite", "cancelled", "terminated", "lost"],
  completed: ["completed"],
};

export default function DashboardScreen() {
  const colors = useColors();
  const { user } = useAuth();

  const role = user?.role ?? null;
  const firstName = user?.name?.split(" ")[0] ?? null;
  const roleStyle = role ? (ROLE_COLOR[role] ?? { bg: colors.secondary, text: colors.mutedForeground }) : null;

  // Role-based Quick Action visibility
  const canSeeCapture = role === "superuser" || role === "admin" || role === "company";
  const canSeeBilling = role === "superuser" || role === "admin" || role === "client" || role === "company";
  const canSeeMaster  = role !== "employee";

  const { data, isLoading, isFetching, refetch } = useListPassports(undefined, {
    query: {
      queryKey: getListPassportsQueryKey(),
      staleTime: 30_000,
    },
  });

  const passports = (data ?? []) as Passport[];

  const stats = useMemo<StatGroup[]>(() => {
    let processing = 0;
    let active = 0;
    let attention = 0;
    let completed = 0;

    for (const p of passports) {
      const s = p.status ?? "processing";
      if (STATUS_GROUPS.processing.includes(s)) processing++;
      else if (STATUS_GROUPS.active.includes(s)) active++;
      else if (STATUS_GROUPS.attention.includes(s)) attention++;
      else if (STATUS_GROUPS.completed.includes(s)) completed++;
    }

    return [
      { label: "Total", value: passports.length, icon: "users", color: "#0F172A" },
      { label: "Processing", value: processing, icon: "clock", color: "#F59E0B" },
      { label: "Active", value: active, icon: "check-circle", color: "#10B981" },
      { label: "Attention", value: attention, icon: "alert-triangle", color: "#EF4444" },
    ];
  }, [passports]);

  const recent = useMemo(
    () =>
      [...passports]
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 8),
    [passports],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={() => refetch()}
          tintColor={colors.primary}
        />
      }
    >
      {/* Hero greeting */}
      <View style={styles.hero}>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
          {getGreeting()}{firstName ? `, ${firstName}` : ""}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>LEO OS</Text>
        <View style={styles.heroMeta}>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate()}
          </Text>
          {role && roleStyle && (
            <View style={[styles.rolePill, { backgroundColor: roleStyle.bg }]}>
              <Text style={[styles.roleText, { color: roleStyle.text }]}>
                {ROLE_LABEL[role] ?? role}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats grid */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </View>
      )}

      {/* Quick actions — only show actions the user's role can access */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Quick Actions
        </Text>
        <View style={styles.actionsRow}>
          {canSeeCapture && (
            <ActionButton
              icon="camera"
              label="Capture"
              onPress={() => router.push("/(tabs)/upload")}
            />
          )}
          {canSeeMaster && (
            <ActionButton
              icon="users"
              label="Employees"
              onPress={() => router.push("/(tabs)/master")}
            />
          )}
          {canSeeBilling && (
            <ActionButton
              icon="file-text"
              label="Billing"
              onPress={() => router.push("/(tabs)/billing")}
            />
          )}
          <ActionButton
            icon="briefcase"
            label="Companies"
            onPress={() => router.push("/companies")}
          />
        </View>
      </View>

      {/* Recent uploads */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Recent Uploads
          </Text>
          {passports.length > 8 && (
            <Pressable onPress={() => router.push("/(tabs)/master")}>
              <Text style={[styles.seeAll, { color: colors.mutedForeground }]}>
                See all
              </Text>
            </Pressable>
          )}
        </View>

        {isLoading ? null : recent.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="inbox" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No uploads yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap Capture to scan your first passport.
            </Text>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recent.map((p) => (
              <RecentRow
                key={p.id}
                passport={p}
                onPress={() => router.push(`/passport/${p.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({ stat }: { stat: StatGroup }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          shadowColor: "#000",
        },
      ]}
    >
      <View
        style={[
          styles.statIconWrap,
          { backgroundColor: stat.color + "18" },
        ]}
      >
        <Feather name={stat.icon} size={18} color={stat.color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {stat.value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {stat.label}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: colors.card,
          opacity: pressed ? 0.75 : 1,
          shadowColor: "#000",
        },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={20} color={colors.foreground} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "completed": return "#10B981";
    case "failed": return "#EF4444";
    case "arrived":
    case "employed":
    case "handedover": return "#3B82F6";
    case "processing": return "#F59E0B";
    case "applied":
    case "approved":
    case "ticket_issued": return "#8B5CF6";
    default: return "#94A3B8";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function RecentRow({
  passport,
  onPress,
}: {
  passport: Passport;
  onPress: () => void;
}) {
  const colors = useColors();
  const status = passport.status ?? "processing";
  const initials = (passport.fullName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase();
  const sc = statusColor(status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentRow,
        {
          backgroundColor: colors.card,
          shadowColor: "#000",
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.recentAvatar, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.recentInitials, { color: colors.foreground }]}>
          {initials}
        </Text>
      </View>
      <View style={styles.recentContent}>
        <Text
          style={[styles.recentName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {passport.fullName || "Unnamed"}
        </Text>
        <Text
          style={[styles.recentNum, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {passport.passportNumber || "No passport #"}
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: sc + "18" }]}>
        <View style={[styles.statusDot, { backgroundColor: sc }]} />
        <Text style={[styles.statusPillText, { color: sc }]}>
          {statusLabel(status)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 32, gap: 28 },

  hero: { gap: 4, paddingTop: 8 },
  greeting: { fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  title: { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" },
  date: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rolePill: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  loadingBox: { height: 140, alignItems: "center", justifyContent: "center" },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 18,
    padding: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  section: { gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },

  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  recentList: { gap: 8 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  recentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  recentInitials: { fontSize: 15, fontFamily: "Inter_700Bold" },
  recentContent: { flex: 1, gap: 2 },
  recentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  recentNum: { fontSize: 12, fontFamily: "Inter_400Regular" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
