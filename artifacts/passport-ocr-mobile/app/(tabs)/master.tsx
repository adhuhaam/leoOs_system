import { Feather } from "@expo/vector-icons";
import {
  getListLoaQueryKey,
  getListPassportsQueryKey,
  type Loa,
  type Passport,
  useListLoa,
  useListPassports,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type StatusFilter = "all" | "completed" | "processing" | "failed";
type NationalityFilter = "all" | "bangladesh" | "india" | "nepal";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "processing", label: "Processing" },
  { key: "failed", label: "Failed" },
];

const NATIONALITY_FILTERS: { key: NationalityFilter; label: string }[] = [
  { key: "all", label: "Any" },
  { key: "bangladesh", label: "Bangladesh" },
  { key: "india", label: "India" },
  { key: "nepal", label: "Nepal" },
];

export default function MasterListScreen() {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [nationalityFilter, setNationalityFilter] =
    useState<NationalityFilter>("all");

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) p.search = search.trim();
    if (statusFilter !== "all") p.status = statusFilter;
    if (nationalityFilter !== "all") p.nationality = nationalityFilter;
    return p;
  }, [search, statusFilter, nationalityFilter]);

  const { data, isLoading, isError, refetch, isFetching, error } =
    useListPassports(params, {
      query: {
        queryKey: getListPassportsQueryKey(params),
        refetchInterval: 8000,
      },
    });

  const { data: loas = [] } = useListLoa({
    query: { queryKey: getListLoaQueryKey() },
  });

  const companyByPassport = useMemo(() => {
    const m = new Map<number, string>();
    for (const loa of loas as Loa[]) {
      if (loa.passportId == null) continue;
      if (!m.has(loa.passportId) && loa.companyName) {
        m.set(loa.passportId, loa.companyName);
      }
    }
    return m;
  }, [loas]);

  const passports = (data ?? []) as Passport[];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or passport #"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <FilterRow
        items={STATUS_FILTERS}
        value={statusFilter}
        onChange={setStatusFilter}
      />
      <FilterRow
        items={NATIONALITY_FILTERS}
        value={nationalityFilter}
        onChange={setNationalityFilter}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Feather name="alert-triangle" size={28} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            {error instanceof Error ? error.message : "Failed to load"}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={passports}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={
            passports.length === 0 ? styles.emptyContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No passports yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap Capture to scan your first passport.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PassportCard
              passport={item}
              companyName={companyByPassport.get(item.id) ?? null}
              onPress={() => router.push(`/passport/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function FilterRow<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.filterRow}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.secondary,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: active
                    ? colors.primaryForeground
                    : colors.secondaryForeground,
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PassportCard({
  passport,
  companyName,
  onPress,
}: {
  passport: Passport;
  companyName: string | null;
  onPress: () => void;
}) {
  const colors = useColors();
  const status = passport.status ?? "processing";
  const statusColor =
    status === "completed"
      ? colors.primary
      : status === "failed"
        ? colors.destructive
        : colors.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[styles.cardName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {passport.fullName || "Unnamed passport"}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
      <Text style={[styles.cardNum, { color: colors.mutedForeground }]}>
        {passport.passportNumber || "Number pending..."}
      </Text>
      <View style={styles.cardFooter}>
        <Text
          style={[styles.cardMeta, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {companyName
            ? `LOA · ${companyName}`
            : passport.nationality
              ? passport.nationality.toUpperCase()
              : "—"}
        </Text>
        <Text style={[styles.cardMeta, { color: statusColor }]}>
          {status.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  listContent: { padding: 16, gap: 12 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardName: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  cardNum: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 10 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardMeta: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, flexShrink: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
