import { Feather } from "@expo/vector-icons";
import {
  getGetXpatWorkPermitQueryKey,
  getListCompaniesQueryKey,
  getListLoaQueryKey,
  getListPassportsQueryKey,
  type Company,
  type Loa,
  type Passport,
  useGetXpatWorkPermit,
  useListCompanies,
  useListLoa,
  useListPassports,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
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

function formatDate(raw: string | null | undefined): string {
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

function nationalityFlag(nat: string | null | undefined): string {
  const n = (nat ?? "").toLowerCase();
  if (n.includes("bangladesh")) return "🇧🇩";
  if (n.includes("india")) return "🇮🇳";
  if (n.includes("nepal")) return "🇳🇵";
  if (n.includes("pakistan")) return "🇵🇰";
  if (n.includes("sri lanka")) return "🇱🇰";
  if (n.includes("philippines")) return "🇵🇭";
  return n ? "🌐" : "";
}

type StatusFilter =
  | "all"
  | "processing"
  | "applied"
  | "approved"
  | "ticket_issued"
  | "arrived"
  | "employed"
  | "handedover"
  | "completed"
  | "return_back_from_worksite"
  | "incomplete"
  | "cancelled"
  | "terminated"
  | "lost"
  | "failed";

type NationalityFilter = "all" | "bangladesh" | "india" | "nepal";
type ActivePicker = "status" | "nationality" | "company" | "client" | null;

const STATUS_OPTIONS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all",                       label: "All statuses",  color: "#64748B" },
  { key: "processing",                label: "Processing",    color: "#F59E0B" },
  { key: "applied",                   label: "Applied",       color: "#8B5CF6" },
  { key: "approved",                  label: "Approved",      color: "#6366F1" },
  { key: "ticket_issued",             label: "Ticket Issued", color: "#A78BFA" },
  { key: "arrived",                   label: "Arrived",       color: "#3B82F6" },
  { key: "employed",                  label: "Employed",      color: "#0EA5E9" },
  { key: "handedover",                label: "Handed Over",   color: "#06B6D4" },
  { key: "completed",                 label: "Completed",     color: "#10B981" },
  { key: "return_back_from_worksite", label: "Returned",      color: "#F97316" },
  { key: "incomplete",                label: "Incomplete",    color: "#EF4444" },
  { key: "failed",                    label: "Failed",        color: "#DC2626" },
  { key: "cancelled",                 label: "Cancelled",     color: "#9CA3AF" },
  { key: "terminated",                label: "Terminated",    color: "#6B7280" },
  { key: "lost",                      label: "Lost",          color: "#1F2937" },
];

const NATIONALITY_OPTIONS: { key: NationalityFilter; label: string }[] = [
  { key: "all",         label: "All nationalities" },
  { key: "bangladesh",  label: "🇧🇩  Bangladesh" },
  { key: "india",       label: "🇮🇳  India" },
  { key: "nepal",       label: "🇳🇵  Nepal" },
];

// ─── Picker modal ─────────────────────────────────────────────────────────────

function PickerModal<T extends string>({
  visible,
  title,
  options,
  value,
  onChange,
  onClose,
  showDot,
}: {
  visible: boolean;
  title: string;
  options: { key: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
  onClose: () => void;
  showDot?: boolean;
}) {
  const colors = useColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>
      <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
        {/* Handle */}
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
        <ScrollView
          style={{ maxHeight: 380 }}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {options.map((opt, idx) => {
            const active = opt.key === value;
            return (
              <Pressable
                key={opt.key}
                onPress={() => { onChange(opt.key); onClose(); }}
                style={[
                  styles.pickerRow,
                  {
                    borderTopWidth: idx === 0 ? 1 : 0,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: active ? colors.primary + "0D" : "transparent",
                  },
                ]}
              >
                {showDot && opt.color && opt.key !== "all" ? (
                  <View style={[styles.pickerDot, { backgroundColor: opt.color }]} />
                ) : (
                  <View style={styles.pickerDotPlaceholder} />
                )}
                <Text
                  style={[
                    styles.pickerLabel,
                    {
                      color: active ? colors.primary : colors.foreground,
                      fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
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
        </ScrollView>
        {/* Cancel button */}
        <Pressable
          onPress={onClose}
          style={[styles.cancelBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  dotColor,
  onPress,
}: {
  label: string;
  active: boolean;
  dotColor?: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const borderColor = active ? (dotColor ?? colors.primary) : colors.border;
  const bgColor = active ? (dotColor ?? colors.primary) + "14" : colors.card;
  const textColor = active ? (dotColor ?? colors.primary) : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, { backgroundColor: bgColor, borderColor }]}
    >
      {active && dotColor && (
        <View style={[styles.chipDot, { backgroundColor: dotColor }]} />
      )}
      <Text style={[styles.chipText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <Feather name="chevron-down" size={11} color={active ? textColor : colors.mutedForeground} />
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function MasterListScreen() {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [nationalityFilter, setNationalityFilter] = useState<NationalityFilter>("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [openPicker, setOpenPicker] = useState<ActivePicker>(null);

  const apiParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) p.search = search.trim();
    if (statusFilter !== "all") p.status = statusFilter;
    if (nationalityFilter !== "all") p.nationality = nationalityFilter;
    return p;
  }, [search, statusFilter, nationalityFilter]);

  const { data, isLoading, isError, refetch, isFetching, error } =
    useListPassports(apiParams, {
      query: {
        queryKey: getListPassportsQueryKey(apiParams),
        refetchInterval: 8000,
      },
    });

  const { data: loas = [] } = useListLoa(undefined, {
    query: { queryKey: getListLoaQueryKey() },
  });

  const { data: companies = [] } = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey() },
  });

  // id → name map for passport.companyId lookups (always up to date after save)
  const companyById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of companies as Company[]) {
      if (c.id != null && c.name) m.set(c.id, c.name);
    }
    return m;
  }, [companies]);

  // Fallback: derive company name from LOA (for records without a direct companyId)
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

  // Resolve company name: prefer passport.companyId (direct, always fresh after save)
  // fall back to LOA-derived name
  function resolveCompany(p: Passport): string | null {
    if (p.companyId != null) return companyById.get(p.companyId) ?? null;
    return companyByPassport.get(p.id) ?? null;
  }

  const allPassports = (data ?? []) as Passport[];

  // Client-side filtering for company + client
  const passports = useMemo(() => {
    let result = allPassports;
    if (companyFilter !== "all") {
      result = result.filter((p) => resolveCompany(p) === companyFilter);
    }
    if (clientFilter !== "all") {
      result = result.filter((p) => (p.clientName ?? null) === clientFilter);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPassports, companyFilter, clientFilter, companyById, companyByPassport]);

  // Build unique company + client lists from loaded data
  const companyOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { key: string; label: string }[] = [{ key: "all", label: "All companies" }];
    for (const p of allPassports) {
      const name = resolveCompany(p);
      if (name && !seen.has(name)) { seen.add(name); opts.push({ key: name, label: name }); }
    }
    return opts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPassports, companyById, companyByPassport]);

  const clientOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { key: string; label: string }[] = [{ key: "all", label: "All clients" }];
    for (const p of allPassports) {
      const name = p.clientName;
      if (name && !seen.has(name)) { seen.add(name); opts.push({ key: name, label: name }); }
    }
    return opts;
  }, [allPassports]);

  // Filter chip labels
  const statusEntry = STATUS_OPTIONS.find((s) => s.key === statusFilter)!;
  const natEntry = NATIONALITY_OPTIONS.find((n) => n.key === nationalityFilter)!;
  const activeCount = [statusFilter, nationalityFilter, companyFilter, clientFilter].filter((v) => v !== "all").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

      {/* Filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterBarWrap}
      >
        <FilterChip
          label={statusFilter === "all" ? "Status" : statusEntry.label}
          active={statusFilter !== "all"}
          dotColor={statusFilter !== "all" ? statusEntry.color : undefined}
          onPress={() => setOpenPicker("status")}
        />
        <FilterChip
          label={nationalityFilter === "all" ? "Nationality" : natEntry.label.replace(/^\S+\s+/, "")}
          active={nationalityFilter !== "all"}
          onPress={() => setOpenPicker("nationality")}
        />
        <FilterChip
          label={companyFilter === "all" ? "Company" : companyFilter}
          active={companyFilter !== "all"}
          onPress={() => setOpenPicker("company")}
        />
        <FilterChip
          label={clientFilter === "all" ? "Client" : clientFilter}
          active={clientFilter !== "all"}
          onPress={() => setOpenPicker("client")}
        />
        {activeCount > 0 && (
          <Pressable
            onPress={() => {
              setStatusFilter("all");
              setNationalityFilter("all");
              setCompanyFilter("all");
              setClientFilter("all");
            }}
            style={[styles.clearBtn, { borderColor: colors.border }]}
          >
            <Feather name="x" size={11} color={colors.mutedForeground} />
            <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* List */}
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
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
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
                {activeCount > 0 ? ` · ${activeCount} filter${activeCount !== 1 ? "s" : ""} active` : ""}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No results
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {activeCount > 0 ? "Try adjusting your filters." : "Tap Capture to scan a passport."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PassportCard
              passport={item}
              companyName={resolveCompany(item)}
              onPress={() => router.push(`/passport/${item.id}`)}
              onEdit={() => router.push(`/passport/${item.id}`)}
            />
          )}
        />
      )}

      {/* Picker modals */}
      <PickerModal
        visible={openPicker === "status"}
        title="Filter by status"
        options={STATUS_OPTIONS}
        value={statusFilter}
        onChange={setStatusFilter}
        onClose={() => setOpenPicker(null)}
        showDot
      />
      <PickerModal
        visible={openPicker === "nationality"}
        title="Filter by nationality"
        options={NATIONALITY_OPTIONS}
        value={nationalityFilter}
        onChange={(v) => setNationalityFilter(v as NationalityFilter)}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === "company"}
        title="Filter by company"
        options={companyOptions}
        value={companyFilter}
        onChange={setCompanyFilter}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === "client"}
        title="Filter by client"
        options={clientOptions}
        value={clientFilter}
        onChange={setClientFilter}
        onClose={() => setOpenPicker(null)}
      />
    </View>
  );
}

// ─── Passport card ────────────────────────────────────────────────────────────

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
  onEdit,
}: {
  passport: Passport;
  companyName: string | null;
  onPress: () => void;
  onEdit: () => void;
}) {
  const colors = useColors();
  const status = (passport.status ?? "processing") as StatusFilter;
  const statusEntry = STATUS_OPTIONS.find((s) => s.key === status) ?? STATUS_OPTIONS[1];

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

  const flag = nationalityFlag(passport.nationality);
  const natLabel = passport.nationality ?? null;
  const dobLabel = passport.dateOfBirth ? formatDate(passport.dateOfBirth) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      {/* Status stripe */}
      <View
        style={[styles.cardStripe, { backgroundColor: statusEntry.color }]}
      />

      <View style={styles.cardInner}>
        {/* Avatar */}
        <AvatarPhoto
          src={photoSrc}
          initials={initials}
          loading={xpatLoading && hasXpat && !xpat}
        />

        {/* Main content */}
        <View style={styles.cardContent}>
          {/* Row 1: Name + edit */}
          <View style={styles.cardTopRow}>
            <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
              {passport.fullName || "Unnamed passport"}
            </Text>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onEdit(); }}
              hitSlop={10}
              style={[styles.editBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name="edit-2" size={13} color={colors.primary} />
            </Pressable>
          </View>

          {/* Row 2: Passport # · WP# */}
          <Text style={[styles.cardNums, { color: colors.mutedForeground }]} numberOfLines={1}>
            {passport.passportNumber || "—"}
            {wp ? <Text style={styles.wpNum}> · {wp}</Text> : null}
          </Text>

          {/* Row 3: Status badge + nationality */}
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusEntry.color + "18", borderColor: statusEntry.color + "40" }]}>
              <View style={[styles.statusDotSm, { backgroundColor: statusEntry.color }]} />
              <Text style={[styles.statusBadgeText, { color: statusEntry.color }]}>
                {statusEntry.label}
              </Text>
            </View>
            {flag || natLabel ? (
              <Text style={[styles.natText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {flag}{natLabel ? `  ${natLabel}` : ""}
              </Text>
            ) : null}
          </View>

          {/* Row 4: Company → Client */}
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

          {/* Row 5: WP badge + expiry | DOB */}
          <View style={styles.wpRow}>
            {hasXpat && xpatLoading && !xpat ? (
              <View style={[styles.wpLoadingSkeleton, { backgroundColor: colors.muted }]} />
            ) : xpat ? (
              <>
                <View style={[styles.wpBadge, { backgroundColor: wpValid ? "#d1fae5" : "#fee2e2" }]}>
                  <Text style={[styles.wpBadgeText, { color: wpValid ? "#065f46" : "#991b1b" }]}>
                    {xpat.isValid ?? "Unknown"}
                  </Text>
                </View>
                {xpat.workPermitExpiry ? (
                  <Text style={[styles.wpExpiry, { color: colors.mutedForeground }]}>
                    Exp:{" "}
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                      {formatDate(xpat.workPermitExpiry)}
                    </Text>
                  </Text>
                ) : null}
              </>
            ) : !hasXpat ? (
              <Text style={[styles.noWpText, { color: colors.mutedForeground }]}>
                No WP on record
              </Text>
            ) : null}
            {dobLabel ? (
              <Text style={[styles.dobText, { color: colors.mutedForeground }]}>
                DOB:{" "}
                <Text style={{ fontFamily: "Inter_500Medium", color: colors.foreground }}>
                  {dobLabel}
                </Text>
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Search
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

  // Filter bar
  filterBarWrap: { paddingBottom: 4 },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingRight: 24,
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 150,
  },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  clearText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  listCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 10, letterSpacing: 0.2 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 },

  // Card
  card: {
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardStripe: { height: 3 },
  cardInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 13,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    marginTop: 1,
  },
  avatarImg: { width: 48, height: 48 },
  avatarInitials: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  cardContent: { flex: 1, gap: 4 },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },

  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  cardNums: { fontSize: 12, fontFamily: "Inter_500Medium" },
  wpNum: { fontFamily: "Inter_400Regular", opacity: 0.7 },

  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDotSm: { width: 5, height: 5, borderRadius: 2.5 },
  statusBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  natText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  companyRow: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  companyText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },

  wpRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  wpLoadingSkeleton: { height: 18, width: 60, borderRadius: 6 },
  wpBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  wpBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  wpExpiry: { fontSize: 11, fontFamily: "Inter_400Regular" },
  dobText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noWpText: { fontSize: 10, fontFamily: "Inter_400Regular", fontStyle: "italic" },

  // Picker modal
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  pickerDot: { width: 8, height: 8, borderRadius: 4 },
  pickerDotPlaceholder: { width: 8, height: 8 },
  pickerLabel: { flex: 1, fontSize: 15 },
  cancelBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },

  // Other
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
