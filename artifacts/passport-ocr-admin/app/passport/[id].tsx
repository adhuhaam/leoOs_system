import { Feather } from "@/components/Icon";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Client,
  type Company,
  type Passport,
  type XpatWorkPermit,
  getGetPassportQueryKey,
  getGetXpatWorkPermitQueryKey,
  getListClientsQueryKey,
  getListCompaniesQueryKey,
  useDeletePassport,
  useGetPassport,
  useGetXpatWorkPermit,
  useListClients,
  useListCompanies,
  useUpdatePassport,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useColors } from "@/hooks/useColors";

// ─── Xpat helpers ─────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function buildPhotoSrc(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  return `${BASE_URL}/api/xpat/photo?photoUrl=${encodeURIComponent(photoUrl)}`;
}

function buildCardSrc(wp: string, pp: string): string {
  return (
    `${BASE_URL}/api/xpat/card` +
    `?workPermitNumber=${encodeURIComponent(wp)}` +
    `&passportNumber=${encodeURIComponent(pp)}`
  );
}

function fmtXpatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
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

// ─── Status definitions ──────────────────────────────────────────────────────

export type PassportStatus =
  | "processing"
  | "completed"
  | "failed"
  | "applied"
  | "approved"
  | "ticket_issued"
  | "arrived"
  | "handedover"
  | "return_back_from_worksite"
  | "incomplete"
  | "cancelled"
  | "terminated"
  | "lost"
  | "employed";

type StatusMeta = {
  label: string;
  bg: string;
  text: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const STATUS_LIST: PassportStatus[] = [
  "processing",
  "completed",
  "failed",
  "applied",
  "approved",
  "ticket_issued",
  "arrived",
  "handedover",
  "return_back_from_worksite",
  "incomplete",
  "cancelled",
  "terminated",
  "lost",
  "employed",
];

const STATUS_META: Record<PassportStatus, StatusMeta> = {
  processing:                { label: "Processing",         bg: "#EFF6FF", text: "#1D4ED8", icon: "loader" },
  completed:                 { label: "OCR Done",           bg: "#F0FDF4", text: "#15803D", icon: "check-circle" },
  failed:                    { label: "OCR Failed",         bg: "#FEF2F2", text: "#DC2626", icon: "alert-octagon" },
  applied:                   { label: "Applied",            bg: "#FAF5FF", text: "#7C3AED", icon: "send" },
  approved:                  { label: "Approved",           bg: "#F0FDF4", text: "#166534", icon: "check-square" },
  ticket_issued:             { label: "Ticket Issued",      bg: "#ECFEFF", text: "#0E7490", icon: "credit-card" },
  arrived:                   { label: "Arrived",            bg: "#ECFDF5", text: "#065F46", icon: "map-pin" },
  handedover:                { label: "Handed Over",        bg: "#EEF2FF", text: "#4338CA", icon: "user-check" },
  return_back_from_worksite: { label: "Returned",           bg: "#FFF7ED", text: "#C2410C", icon: "corner-up-left" },
  incomplete:                { label: "Incomplete",         bg: "#FEFCE8", text: "#A16207", icon: "alert-triangle" },
  cancelled:                 { label: "Cancelled",          bg: "#F8FAFC", text: "#475569", icon: "x-circle" },
  terminated:                { label: "Terminated",         bg: "#FFF1F2", text: "#BE123C", icon: "slash" },
  lost:                      { label: "Lost",               bg: "#FEF2F2", text: "#991B1B", icon: "help-circle" },
  employed:                  { label: "Employed",           bg: "#F0FDF4", text: "#14532D", icon: "briefcase" },
};

function getStatusMeta(s: string): StatusMeta {
  return STATUS_META[s as PassportStatus] ?? { label: s, bg: "#F8FAFC", text: "#475569", icon: "circle" };
}

// ─── Picker modal ─────────────────────────────────────────────────────────────

function PickerModal<T>({
  visible,
  title,
  items,
  selected,
  labelKey,
  onSelect,
  onClose,
  allowNone,
  noneLabel,
  searchPlaceholder,
}: {
  visible: boolean;
  title: string;
  items: T[];
  selected: string | number | null;
  labelKey: keyof T;
  onSelect: (item: T | null) => void;
  onClose: () => void;
  allowNone?: boolean;
  noneLabel?: string;
  searchPlaceholder?: string;
}) {
  const colors = useColors();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((it) =>
      String(it[labelKey] ?? "").toLowerCase().includes(q),
    );
  }, [items, search, labelKey]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[pickerStyles.overlay]}>
        <View
          style={[
            pickerStyles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={[pickerStyles.header, { borderBottomColor: colors.border }]}>
            <Text style={[pickerStyles.title, { color: colors.foreground }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View
            style={[
              pickerStyles.searchWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder ?? "Search…"}
              placeholderTextColor={colors.mutedForeground}
              style={[pickerStyles.searchInput, { color: colors.foreground }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(_, i) => String(i)}
            style={{ maxHeight: 340 }}
            ListHeaderComponent={
              allowNone ? (
                <Pressable
                  onPress={() => { onSelect(null); onClose(); setSearch(""); }}
                  style={[
                    pickerStyles.option,
                    selected == null && { backgroundColor: colors.secondary },
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[pickerStyles.optionLabel, { color: colors.mutedForeground, fontStyle: "italic" }]}>
                    {noneLabel ?? "None"}
                  </Text>
                  {selected == null && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const label = String(item[labelKey] ?? "");
              const isSelected = String((item as { id?: unknown }).id) === String(selected);
              return (
                <Pressable
                  onPress={() => { onSelect(item); onClose(); setSearch(""); }}
                  style={[
                    pickerStyles.option,
                    isSelected && { backgroundColor: colors.secondary },
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[pickerStyles.optionLabel, { color: colors.foreground }]}>{label}</Text>
                  {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function StatusPickerModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: string;
  onSelect: (s: PassportStatus) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View
          style={[
            pickerStyles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={[pickerStyles.header, { borderBottomColor: colors.border }]}>
            <Text style={[pickerStyles.title, { color: colors.foreground }]}>Set Status</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 440 }}>
            {STATUS_LIST.map((s) => {
              const m = STATUS_META[s];
              const isSelected = s === current;
              return (
                <Pressable
                  key={s}
                  onPress={() => { onSelect(s); onClose(); }}
                  style={[
                    pickerStyles.option,
                    isSelected && { backgroundColor: colors.secondary },
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[pickerStyles.statusDot, { backgroundColor: m.bg }]}>
                    <Feather name={m.icon} size={14} color={m.text} />
                  </View>
                  <Text style={[pickerStyles.optionLabel, { color: colors.foreground }]}>
                    {m.label}
                  </Text>
                  {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: { flex: 1, fontSize: 15, },
  statusDot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─── Form state ───────────────────────────────────────────────────────────────

type OcrField = "fullName" | "passportNumber" | "dateOfBirth" | "dateOfIssue" | "dateOfExpiry" | "nationality" | "address";
const OCR_FIELDS: { key: OcrField; label: string; multiline?: boolean }[] = [
  { key: "fullName",       label: "Full name" },
  { key: "passportNumber", label: "Passport number" },
  { key: "dateOfBirth",    label: "Date of birth" },
  { key: "dateOfIssue",    label: "Date of issue" },
  { key: "dateOfExpiry",   label: "Date of expiry" },
  { key: "nationality",    label: "Nationality" },
  { key: "address",        label: "Address", multiline: true },
];

interface FormState {
  fullName: string;
  passportNumber: string;
  dateOfBirth: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  nationality: string;
  address: string;
  status: string;
  companyId: number | null;
  clientId: number | null;
  workPermitNumber: string;
  agent: string;
  agencySalary: string;
  clientSalary: string;
}

function toForm(p: Passport): FormState {
  return {
    fullName:        p.fullName ?? "",
    passportNumber:  p.passportNumber ?? "",
    dateOfBirth:     p.dateOfBirth ?? "",
    dateOfIssue:     p.dateOfIssue ?? "",
    dateOfExpiry:    p.dateOfExpiry ?? "",
    nationality:     p.nationality ?? "",
    address:         p.address ?? "",
    status:          p.status ?? "processing",
    companyId:       p.companyId ?? null,
    clientId:        p.clientId ?? null,
    workPermitNumber: p.workPermitNumber ?? "",
    agent:           p.agent ?? "",
    agencySalary:    p.agencySalary ?? "",
    clientSalary:    p.clientSalary ?? "",
  };
}

const EMPTY_FORM: FormState = {
  fullName: "", passportNumber: "", dateOfBirth: "", dateOfIssue: "",
  dateOfExpiry: "", nationality: "", address: "", status: "processing",
  companyId: null, clientId: null, workPermitNumber: "", agent: "", agencySalary: "", clientSalary: "",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PassportDetailScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);

  const { data, isLoading, isError, error, refetch } = useGetPassport(id, {
    query: {
      enabled: !Number.isNaN(id),
      queryKey: getGetPassportQueryKey(id),
      refetchInterval: (q) => {
        const p = q.state.data as Passport | undefined;
        return p?.status === "processing" ? 2000 : false;
      },
    },
  });

  const { data: companiesRaw = [] } = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey() },
  });
  const companies = companiesRaw as Company[];

  const { data: clientsRaw = [] } = useListClients(undefined, {
    query: { queryKey: getListClientsQueryKey() },
  });
  const clients = clientsRaw as Client[];

  const updateMutation = useUpdatePassport();
  const deleteMutation = useDeletePassport();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  const [statusPicker, setStatusPicker] = useState(false);
  const [companyPicker, setCompanyPicker] = useState(false);
  const [clientPicker, setClientPicker] = useState(false);
  const [cardModal, setCardModal] = useState(false);

  const xpatParams = {
    workPermitNumber: data?.workPermitNumber ?? "",
    passportNumber: data?.passportNumber ?? "",
  };
  const hasXpat = !!(data?.workPermitNumber && data?.passportNumber);
  const { data: xpat, isLoading: xpatLoading } = useGetXpatWorkPermit(xpatParams, {
    query: {
      enabled: hasXpat,
      staleTime: 15 * 60 * 1000,
      queryKey: getGetXpatWorkPermitQueryKey(xpatParams),
    },
  });
  const photoSrc = buildPhotoSrc(xpat?.photoUrl);
  const cardSrc = hasXpat
    ? buildCardSrc(data.workPermitNumber!, data.passportNumber!)
    : null;

  useEffect(() => {
    if (data && !dirty) setForm(toForm(data));
  }, [data, dirty]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === form.companyId) ?? null,
    [companies, form.companyId],
  );
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === form.clientId) ?? null,
    [clients, form.clientId],
  );

  async function handleSave() {
    if (!data || !dirty) return;
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          fullName:        form.fullName || undefined,
          passportNumber:  form.passportNumber || undefined,
          dateOfBirth:     form.dateOfBirth || undefined,
          dateOfIssue:     form.dateOfIssue || undefined,
          dateOfExpiry:    form.dateOfExpiry || undefined,
          address:         form.address || undefined,
          nationality:     form.nationality || undefined,
          status:          form.status || undefined,
          companyId:       form.companyId,
          clientId:        form.clientId,
          workPermitNumber: form.workPermitNumber || null,
          agent:           form.agent || null,
          agencySalary:    form.agencySalary || null,
          clientSalary:    form.clientSalary || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/passports"] });
      setDirty(false);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete record?",
      "This will permanently remove this passport record.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id });
              await queryClient.invalidateQueries({ queryKey: ["/api/passports"] });
              if (Platform.OS !== "web") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
              router.back();
            } catch (err) {
              Alert.alert("Delete failed", err instanceof Error ? err.message : "Please try again.");
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Employee" }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Employee" }} />
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          {error instanceof Error ? error.message : "Record not found"}
        </Text>
        <Pressable onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const statusMeta = getStatusMeta(form.status);

  return (
    <>
      <Stack.Screen options={{ title: form.fullName || "Employee" }} />

      {/* Status picker modal */}
      <StatusPickerModal
        visible={statusPicker}
        current={form.status}
        onSelect={(s) => setField("status", s)}
        onClose={() => setStatusPicker(false)}
      />

      {/* Company picker modal */}
      <PickerModal<Company>
        visible={companyPicker}
        title="Select Company"
        items={companies}
        selected={form.companyId}
        labelKey="name"
        allowNone
        noneLabel="No company"
        searchPlaceholder="Search companies…"
        onSelect={(c) => setField("companyId", c?.id ?? null)}
        onClose={() => setCompanyPicker(false)}
      />

      {/* Client picker modal */}
      <PickerModal<Client>
        visible={clientPicker}
        title="Select Client"
        items={clients}
        selected={form.clientId}
        labelKey="name"
        allowNone
        noneLabel="No client"
        searchPlaceholder="Search clients…"
        onSelect={(c) => setField("clientId", c?.id ?? null)}
        onClose={() => setClientPicker(false)}
      />

      {/* Work permit card full-screen modal */}
      {cardSrc && (
        <Modal
          visible={cardModal}
          animationType="fade"
          transparent
          onRequestClose={() => setCardModal(false)}
          statusBarTranslucent
        >
          <Pressable
            style={xpatStyles.cardModalOverlay}
            onPress={() => setCardModal(false)}
          >
            <View style={xpatStyles.cardModalInner}>
              <Image
                source={{ uri: cardSrc }}
                style={xpatStyles.cardModalImage}
                resizeMode="contain"
              />
              <Pressable
                onPress={() => setCardModal(false)}
                style={xpatStyles.cardModalClose}
                hitSlop={12}
              >
                <Feather name="x" size={20} color="#fff" />
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Status row (tappable) ── */}
        <Pressable
          onPress={() => setStatusPicker(true)}
          style={({ pressed }) => [
            styles.statusCard,
            { backgroundColor: statusMeta.bg, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={[styles.statusIconWrap, { backgroundColor: "rgba(0,0,0,0.06)" }]}>
            <Feather name={statusMeta.icon} size={18} color={statusMeta.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: statusMeta.text }]}>{statusMeta.label}</Text>
            <Text style={[styles.statusHint, { color: statusMeta.text, opacity: 0.7 }]}>
              Tap to change status
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={statusMeta.text} style={{ opacity: 0.6 }} />
        </Pressable>

        {/* ── Section: Passport data ── */}
        <SectionHeader label="Passport Data" icon="file-text" colors={colors} />

        {OCR_FIELDS.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {field.label.toUpperCase()}
            </Text>
            <TextInput
              value={form[field.key]}
              onChangeText={(v) => setField(field.key, v)}
              placeholder={data.status === "processing" ? "Extracting…" : `Enter ${field.label.toLowerCase()}`}
              placeholderTextColor={colors.mutedForeground}
              multiline={field.multiline}
              autoCapitalize={field.key === "passportNumber" ? "characters" : "words"}
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  borderColor: colors.border,
                  minHeight: field.multiline ? 80 : 48,
                  textAlignVertical: field.multiline ? "top" : "center",
                },
              ]}
            />
          </View>
        ))}

        {/* ── Section: Operational ── */}
        <SectionHeader label="Operational" icon="briefcase" colors={colors} />

        {/* Company picker row */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>COMPANY</Text>
          <Pressable
            onPress={() => setCompanyPicker(true)}
            style={({ pressed }) => [
              styles.selectRow,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={[styles.selectText, { color: selectedCompany ? colors.foreground : colors.mutedForeground }]}
              numberOfLines={1}
            >
              {selectedCompany?.name ?? "Select company…"}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Client picker row */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CLIENT / EMPLOYER</Text>
          <Pressable
            onPress={() => setClientPicker(true)}
            style={({ pressed }) => [
              styles.selectRow,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={[styles.selectText, { color: selectedClient ? colors.foreground : colors.mutedForeground }]}
              numberOfLines={1}
            >
              {selectedClient?.name ?? "Select client…"}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Work permit number */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>WORK PERMIT NUMBER</Text>
          <TextInput
            value={form.workPermitNumber}
            onChangeText={(v) => setField("workPermitNumber", v)}
            placeholder="e.g. WP-123456"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, minHeight: 48 },
            ]}
          />
        </View>

        {/* Agent */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>AGENT</Text>
          <TextInput
            value={form.agent}
            onChangeText={(v) => setField("agent", v)}
            placeholder="Agent name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, minHeight: 48 },
            ]}
          />
        </View>

        {/* Agency salary */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>EMPLOYEE SALARY (MVR / month)</Text>
          <TextInput
            value={form.agencySalary}
            onChangeText={(v) => setField("agencySalary", v)}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            returnKeyType="done"
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, minHeight: 48 },
            ]}
          />
        </View>

        {/* Client billing rate */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CLIENT BILLING RATE (MVR / month)</Text>
          <TextInput
            value={form.clientSalary}
            onChangeText={(v) => setField("clientSalary", v)}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            returnKeyType="done"
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, minHeight: 48 },
            ]}
          />
          <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 3 }}>What you charge the client — used as billing rate on invoices</Text>
        </View>

        {/* Margin hint */}
        {(Number(form.agencySalary || 0) > 0 || Number(form.clientSalary || 0) > 0) && (() => {
          const margin = Number(form.clientSalary || 0) - Number(form.agencySalary || 0);
          const mc = margin > 0 ? "#059669" : margin < 0 ? "#DC2626" : colors.mutedForeground;
          return (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Monthly margin (billing − salary)</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: mc }}>
                {margin >= 0 ? "+" : ""}{margin.toFixed(2)} MVR
              </Text>
            </View>
          );
        })()}

        {/* ── Xpat Employee Data ── */}
        {hasXpat && (
          <>
            <SectionHeader label="Xpat Work Permit" icon="globe" colors={colors} />

            {xpatLoading && !xpat && (
              <View style={xpatStyles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[xpatStyles.loadingText, { color: colors.mutedForeground }]}>
                  Fetching Xpat data…
                </Text>
              </View>
            )}

            {xpat && (
              <>
                {/* ── Hero card: photo + name/status ── */}
                <View style={[xpatStyles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {photoSrc ? (
                    <Image
                      source={{ uri: photoSrc }}
                      style={xpatStyles.photo}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[xpatStyles.photoPlaceholder, { backgroundColor: colors.secondary }]}>
                      <Feather name="user" size={28} color={colors.mutedForeground} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[xpatStyles.empName, { color: colors.foreground }]} numberOfLines={2}>
                      {xpat.fullName ?? "—"}
                    </Text>
                    {xpat.occupationName ? (
                      <Text style={[xpatStyles.empSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {xpat.occupationName}
                      </Text>
                    ) : null}
                    <View style={[
                      xpatStyles.validBadge,
                      { backgroundColor: xpat.isValid?.toLowerCase() === "valid" ? "#DCFCE7" : "#FEE2E2" },
                    ]}>
                      <Feather
                        name={xpat.isValid?.toLowerCase() === "valid" ? "check-circle" : "x-circle"}
                        size={12}
                        color={xpat.isValid?.toLowerCase() === "valid" ? "#15803D" : "#DC2626"}
                      />
                      <Text style={[
                        xpatStyles.validText,
                        { color: xpat.isValid?.toLowerCase() === "valid" ? "#15803D" : "#DC2626" },
                      ]}>
                        {xpat.workPermitStateName ?? xpat.isValid ?? "Unknown"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ── Detail rows ── */}
                <View style={[xpatStyles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {[
                    { label: "Employer",        value: xpat.employerName },
                    { label: "Employer No.",     value: xpat.employerNumber },
                    { label: "Contact",          value: xpat.employerContactNumber },
                    { label: "Date of Birth",    value: fmtXpatDate(xpat.dateOfBirth) },
                    { label: "Nationality",      value: xpat.nationality },
                    { label: "Gender",           value: xpat.gender },
                    { label: "Contact No.",      value: xpat.contactNumber },
                    { label: "WP Issued",        value: fmtXpatDate(xpat.workPermitIssuedDate) },
                    { label: "WP Expiry",        value: fmtXpatDate(xpat.workPermitExpiry) },
                  ]
                    .filter((r) => r.value)
                    .map((row, i, arr) => (
                      <View
                        key={row.label}
                        style={[
                          xpatStyles.detailRow,
                          i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                        ]}
                      >
                        <Text style={[xpatStyles.detailLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                        <Text style={[xpatStyles.detailValue, { color: colors.foreground }]} numberOfLines={2}>
                          {row.value}
                        </Text>
                      </View>
                    ))}
                </View>

                {/* ── Work permit card thumbnail ── */}
                {cardSrc && (
                  <View style={{ gap: 6 }}>
                    <Text style={[xpatStyles.cardLabel, { color: colors.mutedForeground }]}>
                      WORK PERMIT CARD
                    </Text>
                    <Pressable
                      onPress={() => setCardModal(true)}
                      style={({ pressed }) => [
                        xpatStyles.cardThumbWrap,
                        { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Image
                        source={{ uri: cardSrc }}
                        style={xpatStyles.cardThumb}
                        resizeMode="contain"
                      />
                      <View style={[xpatStyles.cardOverlay, { backgroundColor: "rgba(0,0,0,0.32)" }]}>
                        <Feather name="maximize-2" size={18} color="#fff" />
                        <Text style={xpatStyles.cardOverlayText}>Tap to enlarge</Text>
                      </View>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ── Read-only info ── */}
        {(data.originalFilename || data.errorMessage) && (
          <>
            <SectionHeader label="Details" icon="info" colors={colors} />
            {data.originalFilename && (
              <InfoRow label="Original file" value={data.originalFilename} colors={colors} />
            )}
            {data.errorMessage && (
              <InfoRow label="Error" value={data.errorMessage} colors={colors} isError />
            )}
          </>
        )}

        {/* ── Actions ── */}
        <Pressable
          onPress={handleSave}
          disabled={!dirty || updateMutation.isPending}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: colors.primary,
              opacity: !dirty || updateMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
              marginTop: 8,
            },
          ]}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="save" size={18} color={colors.primaryForeground} />
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Save changes</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
          style={({ pressed }) => [
            styles.destructiveBtn,
            { borderColor: colors.destructive, opacity: deleteMutation.isPending ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="trash-2" size={18} color={colors.destructive} />
          <Text style={[styles.destructiveText, { color: colors.destructive }]}>Delete record</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  icon,
  colors,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[sectionHeaderStyles.row, { borderBottomColor: colors.border }]}>
      <Feather name={icon} size={14} color={colors.mutedForeground} />
      <Text style={[sectionHeaderStyles.text, { color: colors.mutedForeground }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    marginBottom: 6,
  },
  text: { fontSize: 11, letterSpacing: 0.8 },
});

function InfoRow({
  label,
  value,
  colors,
  isError,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  isError?: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: isError ? colors.destructive : colors.foreground,
          lineHeight: 18,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusLabel:   { fontSize: 15, },
  statusHint:    { fontSize: 11, marginTop: 1 },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
  },
  selectText: { flex: 1, fontSize: 15, },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText:  { fontSize: 15, },
  destructiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  destructiveText: { fontSize: 14, },
  errorText:  { fontSize: 14, textAlign: "center", },
  retryBtn:   { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText:  { fontSize: 14 },
});

const xpatStyles = StyleSheet.create({
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 13, },

  heroCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  photo: {
    width: 64,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  photoPlaceholder: {
    width: 64,
    height: 80,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  empName: { fontSize: 15, lineHeight: 20 },
  empSub:  { fontSize: 13, },
  validBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  validText: { fontSize: 12, },

  detailCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  detailLabel: { fontSize: 12, flex: 1 },
  detailValue: { fontSize: 13, flex: 2, textAlign: "right" },

  cardLabel: { fontSize: 11, letterSpacing: 0.5 },
  cardThumbWrap: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    height: 120,
  },
  cardThumb: { width: "100%", height: "100%" },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cardOverlayText: {
    color: "#fff",
    fontSize: 12,
  },

  cardModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  cardModalInner: { width: "100%", position: "relative" },
  cardModalImage: { width: "100%", height: 260, borderRadius: 12 },
  cardModalClose: {
    position: "absolute",
    top: -14,
    right: -14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
