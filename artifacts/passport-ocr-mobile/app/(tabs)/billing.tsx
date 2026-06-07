import { Feather } from "@expo/vector-icons";
import {
  type BillingDocumentSummary,
  getListBillingDocumentsQueryKey,
  type ListBillingDocumentsParams,
  ListBillingDocumentsKind,
  useListBillingDocuments,
  useUpdateBillingDocument,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Tab = "all" | "invoice" | "quotation";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "invoice", label: "Invoices" },
  { key: "quotation", label: "Quotes" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "payment_received", label: "Payment Received" },
  { value: "completed", label: "Completed" },
];

function statusLabel(s: string): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? (s || "Draft");
}

function statusColors(s: string): { bg: string; text: string; border: string } {
  switch (s) {
    case "sent":
      return { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" };
    case "payment_received":
      return { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" };
    case "completed":
      return { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
    default:
      return { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0" };
  }
}

function formatMVR(s: string | number): string {
  const n = typeof s === "string" ? Number(s) : s;
  return `MVR ${(isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BillingScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [statusDoc, setStatusDoc] = useState<BillingDocumentSummary | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);


  const updateMutation = useUpdateBillingDocument();

  const params = useMemo<ListBillingDocumentsParams>(() => {
    const p: ListBillingDocumentsParams = {};
    if (tab !== "all") p.kind = tab as typeof ListBillingDocumentsKind[keyof typeof ListBillingDocumentsKind];
    if (search.trim()) p.search = search.trim();
    return p;
  }, [tab, search]);

  const { data, isLoading, isError, refetch, isFetching, error } =
    useListBillingDocuments(params, {
      query: { queryKey: getListBillingDocumentsQueryKey(params) },
    });

  const docs = (data ?? []) as BillingDocumentSummary[];

  const handleStatusChange = (newStatus: string) => {
    if (!statusDoc) return;
    setUpdatingStatus(true);
    updateMutation.mutate(
      {
        id: statusDoc.id,
        data: { status: newStatus } as Parameters<typeof updateMutation.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey() });
          setStatusDoc(null);
          setUpdatingStatus(false);
        },
        onError: () => {
          setUpdatingStatus(false);
        },
      },
    );
  };

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
          placeholder="Search by number or customer"
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

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.primary : colors.secondary,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: active
                      ? colors.primaryForeground
                      : colors.secondaryForeground,
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
          data={docs}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={
            docs.length === 0 ? styles.emptyContent : styles.listContent
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
              <Feather name="file-text" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No documents
              </Text>
              <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
                Invoices and quotes appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <DocCard
              doc={item}
              onPress={() => router.push(`/billing/${item.id}`)}
              onLongPress={() => setStatusDoc(item)}
            />
          )}
        />
      )}

      {/* Create FAB */}
      <Pressable
        onPress={async () => {
          if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          router.push("/billing/new");
        }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </Pressable>

      {/* Status picker modal — triggered by long-press on a card */}
      <Modal
        visible={statusDoc !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !updatingStatus && setStatusDoc(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !updatingStatus && setStatusDoc(null)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Change Status
            </Text>
            {statusDoc && (
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                {statusDoc.number} · Current: {statusLabel(statusDoc.status)}
              </Text>
            )}
            <View style={styles.modalOptions}>
              {STATUS_OPTIONS.map((opt) => {
                const sc2 = statusColors(opt.value);
                const isCurrent = opt.value === (statusDoc?.status ?? "");
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => !isCurrent && handleStatusChange(opt.value)}
                    disabled={isCurrent || updatingStatus}
                    style={({ pressed }) => [
                      styles.optionRow,
                      {
                        backgroundColor: isCurrent
                          ? sc2.bg
                          : pressed
                            ? colors.secondary
                            : "transparent",
                        borderColor: isCurrent ? sc2.border : colors.border,
                        opacity: updatingStatus && !isCurrent ? 0.5 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[styles.optionDot, { backgroundColor: sc2.text }]}
                    />
                    <Text
                      style={[
                        styles.optionLabel,
                        {
                          color: isCurrent ? sc2.text : colors.foreground,
                          fontFamily: isCurrent
                            ? "Inter_700Bold"
                            : "Inter_500Medium",
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isCurrent && (
                      <Feather name="check" size={16} color={sc2.text} />
                    )}
                    {updatingStatus && !isCurrent && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => !updatingStatus && setStatusDoc(null)}
              disabled={updatingStatus}
              style={[styles.cancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DocCard({
  doc,
  onPress,
  onLongPress,
}: {
  doc: BillingDocumentSummary;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const colors = useColors();
  const isInvoice = doc.kind === "invoice";
  const tint = isInvoice ? colors.primary : colors.mutedForeground;
  const sc = statusColors(doc.status);
  const sub = Number(doc.subtotal || 0);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          shadowColor: "#000",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.kindBadge, { backgroundColor: colors.secondary }]}>
          <Feather
            name={isInvoice ? "file-text" : "file"}
            size={12}
            color={tint}
          />
          <Text style={[styles.kindText, { color: tint }]}>
            {isInvoice ? "INVOICE" : "QUOTE"}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: sc.bg, borderColor: sc.border },
          ]}
        >
          <Text style={[styles.statusText, { color: sc.text }]}>
            {statusLabel(doc.status)}
          </Text>
        </View>
      </View>
      <Text style={[styles.docNumber, { color: colors.foreground }]}>
        {doc.number}
      </Text>
      <Text
        style={[styles.customer, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {doc.customerName}
      </Text>
      <Text style={[styles.companyName, { color: colors.mutedForeground }]}>
        From {doc.companyName}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
          {doc.issueDate}
        </Text>
        <Text style={[styles.amount, { color: colors.foreground }]}>
          {formatMVR(sub)}
        </Text>
      </View>
      <Text style={[styles.longPressHint, { color: colors.mutedForeground }]}>
        Hold to change status
      </Text>
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
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  listContent: { padding: 16, gap: 12 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    gap: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  kindBadge: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  kindText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  docNumber: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  customer: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  companyName: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  amount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  longPressHint: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },
  // modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
    gap: 4,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 2 },
  modalSubtitle: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  modalOptions: { gap: 6 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionDot: { width: 8, height: 8, borderRadius: 4 },
  optionLabel: { flex: 1, fontSize: 15 },
  cancelBtn: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
