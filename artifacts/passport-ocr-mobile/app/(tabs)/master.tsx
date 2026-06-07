import { Feather } from "@expo/vector-icons";
import {
  getGetXpatWorkPermitQueryKey,
  getListLoaQueryKey,
  getListPassportsQueryKey,
  type Loa,
  type Passport,
  useGetXpatWorkPermit,
  useListLoa,
  useListPassports,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const XPAT_STALE = 15 * 60 * 1000;

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function buildPhotoSrc(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  return `${BASE_URL}/api/xpat/photo?photoUrl=${encodeURIComponent(photoUrl)}`;
}

function formatXpatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

function isWpValid(v: string | null | undefined): boolean {
  return v?.toLowerCase() === "valid";
}

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

  const { data: loas = [] } = useListLoa(undefined, {
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
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading candidates…
          </Text>
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
          ListHeaderComponent={
            passports.length > 0 ? (
              <Text style={[styles.listCount, { color: colors.mutedForeground }]}>
                {passports.length} candidate{passports.length !== 1 ? "s" : ""}
              </Text>
            ) : null
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
                backgroundColor: active ? colors.primary : colors.card,
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
                    : colors.foreground,
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

function AvatarPhoto({
  src,
  initials,
  loading,
}: {
  src: string | null;
  initials: string;
  loading: boolean;
}) {
  const colors = useColors();
  const [errored, setErrored] = useState(false);
  const showPhoto = !!(src && !errored);

  return (
    <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
      {showPhoto ? (
        <Image
          source={{ uri: src! }}
          style={styles.avatarImg}
          onError={() => setErrored(true)}
        />
      ) : loading ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : (
        <Text style={[styles.avatarInitials, { color: colors.mutedForeground }]}>
          {initials}
        </Text>
      )}
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

  const wp = passport.workPermitNumber ?? null;
  const pp = passport.passportNumber ?? null;
  const hasXpat = !!(wp && pp);

  const xpatParams = { workPermitNumber: wp ?? "", passportNumber: pp ?? "" };
  const { data: xpat, isLoading: xpatLoading } = useGetXpatWorkPermit(xpatParams, {
    query: {
      enabled: hasXpat,
      staleTime: XPAT_STALE,
      queryKey: getGetXpatWorkPermitQueryKey(xpatParams),
    },
  });

  const photoSrc = buildPhotoSrc(xpat?.photoUrl);
  const wpValid = isWpValid(xpat?.isValid);

  const initials = (passport.fullName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase();

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
      <View style={styles.cardInner}>
        {/* Avatar */}
        <AvatarPhoto
          src={photoSrc}
          initials={initials}
          loading={xpatLoading && hasXpat && !xpat}
        />

        {/* Main content */}
        <View style={styles.cardContent}>
          {/* Name + status indicator */}
          <View style={styles.cardTopRow}>
            <Text
              style={[styles.cardName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {passport.fullName || "Unnamed passport"}
            </Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>

          {/* Passport # + WP# */}
          <Text style={[styles.cardNums, { color: colors.mutedForeground }]} numberOfLines={1}>
            {passport.passportNumber || "—"}
            {wp ? (
              <Text style={styles.wpNum}> · {wp}</Text>
            ) : null}
          </Text>

          {/* Company → Client */}
          <View style={styles.companyRow}>
            <Feather name="briefcase" size={10} color={colors.mutedForeground} style={{ marginTop: 1 }} />
            <Text style={[styles.companyText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {companyName ? (
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                  {companyName}
                </Text>
              ) : (
                <Text style={{ fontStyle: "italic" }}>No company</Text>
              )}
              {"  →  "}
              {passport.clientName ? (
                passport.clientName
              ) : (
                <Text style={{ fontStyle: "italic" }}>Unallocated</Text>
              )}
            </Text>
          </View>

          {/* WP Status + Expiry */}
          <View style={styles.wpRow}>
            {hasXpat && xpatLoading && !xpat ? (
              <View style={[styles.wpLoadingSkeleton, { backgroundColor: colors.muted }]} />
            ) : xpat ? (
              <>
                <View
                  style={[
                    styles.wpBadge,
                    {
                      backgroundColor: wpValid ? "#d1fae5" : "#fee2e2",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.wpBadgeText,
                      { color: wpValid ? "#065f46" : "#991b1b" },
                    ]}
                  >
                    {xpat.isValid ?? "Unknown"}
                  </Text>
                </View>
                {xpat.workPermitExpiry ? (
                  <Text style={[styles.wpExpiry, { color: colors.mutedForeground }]}>
                    Exp:{" "}
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                      {formatXpatDate(xpat.workPermitExpiry)}
                    </Text>
                  </Text>
                ) : null}
              </>
            ) : !hasXpat ? (
              <Text style={[styles.noWpText, { color: colors.mutedForeground }]}>
                No WP on record
              </Text>
            ) : null}
          </View>
        </View>

        {/* Chevron */}
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ alignSelf: "center" }} />
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
    marginBottom: 6,
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
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 5,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  listCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 10, letterSpacing: 0.2 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarImg: { width: 46, height: 46 },
  avatarInitials: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },

  cardContent: { flex: 1, gap: 3 },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  cardNums: { fontSize: 12, fontFamily: "Inter_500Medium" },
  wpNum: { fontFamily: "Inter_400Regular", opacity: 0.7 },

  companyRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 1 },
  companyText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },

  wpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
  wpLoadingSkeleton: { height: 18, width: 60, borderRadius: 6 },
  wpBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  wpBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  wpExpiry: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noWpText: { fontSize: 10, fontFamily: "Inter_400Regular", fontStyle: "italic" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
