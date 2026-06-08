import { Feather } from "@/components/Icon";
import {
  type BillingDocument,
  type BillingItem,
  getGetBillingDocumentQueryKey,
  getListBillingDocumentsQueryKey,
  useGetBillingDocument,
  useUpdateBillingDocument,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "leomaldives.com";

function openPrint(id: number) {
  void WebBrowser.openBrowserAsync(`https://${DOMAIN}/billing/${id}/print`);
}

function fmtMVR(s: string | number): string {
  const n = typeof s === "string" ? Number(s) : s;
  return `MVR ${(isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

export default function BillingDetailScreen() {
  const colors = useColors();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);
  const queryClient = useQueryClient();

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { data, isLoading, isError, error, refetch } = useGetBillingDocument(
    id,
    {
      query: {
        enabled: !Number.isNaN(id),
        queryKey: getGetBillingDocumentQueryKey(id),
      },
    },
  );

  const updateMutation = useUpdateBillingDocument();

  const totals = useMemo(() => {
    const doc = data as BillingDocument | undefined;
    if (!doc) return { sub: 0, gst: 0, total: 0 };
    const sub = doc.items.reduce(
      (s, it) => s + Number(it.qty || 0) * Number(it.rate || 0),
      0,
    );
    const rate = Number(doc.gstRate || 0) / 100;
    if (doc.gstInclusive) {
      const base = sub / (1 + rate);
      const gst = sub - base;
      return { sub: base, gst, total: sub };
    }
    const gst = sub * rate;
    return { sub, gst, total: sub + gst };
  }, [data]);

  const handleStatusChange = (newStatus: string) => {
    setUpdatingStatus(true);
    updateMutation.mutate(
      {
        id,
        data: { status: newStatus } as Parameters<typeof updateMutation.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBillingDocumentQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey() });
          setStatusModalVisible(false);
          setUpdatingStatus(false);
        },
        onError: () => {
          setUpdatingStatus(false);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          {error instanceof Error ? error.message : "Document not found"}
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
    );
  }

  const doc = data as BillingDocument;
  const isInvoice = doc.kind === "invoice";
  const sc = statusColors(doc.status);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        <Stack.Screen
          options={{
            title: `${isInvoice ? "Invoice" : "Quote"} ${doc.number}`,
            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginRight: 4 }}>
                <Pressable onPress={() => openPrint(id)} hitSlop={10}>
                  <Feather name="external-link" size={20} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => router.push(`/billing/edit/${id}`)} hitSlop={10}>
                  <Feather name="edit-2" size={20} color={colors.primary} />
                </Pressable>
              </View>
            ),
          }}
        />

        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.kindBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.kindText, { color: colors.primary }]}>
              {isInvoice ? "INVOICE" : "QUOTE"}
            </Text>
          </View>
          <Text style={[styles.docNumber, { color: colors.foreground }]}>
            {doc.number}
          </Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            From {doc.companyName}
          </Text>

          {/* Status badge + change button */}
          <View style={styles.statusRow}>
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
            <Pressable
              onPress={() => setStatusModalVisible(true)}
              style={({ pressed }) => [
                styles.changeStatusBtn,
                {
                  backgroundColor: pressed ? colors.secondary : colors.secondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="edit-2" size={12} color={colors.mutedForeground} />
              <Text style={[styles.changeStatusText, { color: colors.mutedForeground }]}>
                Change
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Company details */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 0 }]}>
            Issued by
          </Text>
          <FieldRow label="Company" value={doc.companyName} />
          {(doc as any).companyAddress ? (
            <FieldRow label="Address" value={(doc as any).companyAddress} />
          ) : null}
          {(doc as any).companyPhone ? (
            <FieldRow label="Phone" value={(doc as any).companyPhone} />
          ) : null}
          {(doc as any).companyEmail ? (
            <FieldRow label="Email" value={(doc as any).companyEmail} />
          ) : null}
          {(doc as any).companyRegistrationNumber ? (
            <FieldRow label="Reg. No." value={(doc as any).companyRegistrationNumber} />
          ) : null}
          {(doc as any).companyBankName || (doc as any).companyBankAccountNumber ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.bankLabel, { color: colors.mutedForeground }]}>
                BANK DETAILS
              </Text>
              {(doc as any).companyBankName ? (
                <FieldRow label="Bank" value={(doc as any).companyBankName} />
              ) : null}
              {(doc as any).companyBankAccountHolder ? (
                <FieldRow label="Account holder" value={(doc as any).companyBankAccountHolder} />
              ) : null}
              {(doc as any).companyBankAccountNumber ? (
                <FieldRow label="Account No." value={(doc as any).companyBankAccountNumber} />
              ) : null}
              {(doc as any).companyBankSwiftCode ? (
                <FieldRow label="SWIFT / BIC" value={(doc as any).companyBankSwiftCode} />
              ) : null}
            </>
          ) : null}
        </View>

        {/* Customer details */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 0 }]}>
            Bill to
          </Text>
          <FieldRow label="Customer" value={doc.customerName} />
          {doc.customerAddress ? (
            <FieldRow label="Address" value={doc.customerAddress} />
          ) : null}
          {doc.customerTin ? (
            <FieldRow label="TIN" value={doc.customerTin} />
          ) : null}
          <FieldRow label="Issue date" value={doc.issueDate} />
          {doc.dueDate ? <FieldRow label="Due date" value={doc.dueDate} /> : null}
          {doc.terms ? <FieldRow label="Terms" value={doc.terms} /> : null}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Items
        </Text>
        <View style={{ gap: 8 }}>
          {doc.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </View>

        <View
          style={[
            styles.totals,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TotalRow label="Subtotal" value={fmtMVR(totals.sub)} />
          <TotalRow
            label={`GST (${doc.gstRate}%${doc.gstInclusive ? ", incl." : ""})`}
            value={fmtMVR(totals.gst)}
          />
          <View style={[styles.totalDivider, { backgroundColor: colors.border }]} />
          <TotalRow label="Total" value={fmtMVR(totals.total)} bold />
        </View>

        {doc.notes ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              NOTES
            </Text>
            <Text style={[styles.fieldValue, { color: colors.foreground }]}>
              {doc.notes}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Status picker modal */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setStatusModalVisible(false)}
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
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Current: {statusLabel(doc.status)}
            </Text>
            <View style={styles.modalOptions}>
              {STATUS_OPTIONS.map((opt) => {
                const sc2 = statusColors(opt.value);
                const isCurrent = opt.value === doc.status;
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
                      style={[
                        styles.optionDot,
                        { backgroundColor: sc2.text },
                      ]}
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
                    {updatingStatus && opt.value !== doc.status && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setStatusModalVisible(false)}
              style={[styles.cancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label.toUpperCase()}
      </Text>
      <Text style={[styles.fieldValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function ItemRow({ item }: { item: BillingItem }) {
  const colors = useColors();
  const lineTotal = Number(item.qty || 0) * Number(item.rate || 0);
  return (
    <View
      style={[
        styles.item,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemDesc, { color: colors.foreground }]}>
          {item.description}
        </Text>
        {item.detail ? (
          <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
            {item.detail}
          </Text>
        ) : null}
        <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
          {item.qty} × {fmtMVR(item.rate)}
        </Text>
      </View>
      <Text style={[styles.itemTotal, { color: colors.foreground }]}>
        {fmtMVR(lineTotal)}
      </Text>
    </View>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.totalRow}>
      <Text
        style={[
          styles.totalLabel,
          {
            color: bold ? colors.foreground : colors.mutedForeground,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.totalValue,
          {
            color: colors.foreground,
            fontSize: bold ? 18 : 14,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  header: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  kindBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  kindText: { fontSize: 11, letterSpacing: 0.8 },
  docNumber: { fontSize: 22, },
  muted: { fontSize: 12, },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, },
  changeStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  changeStatusText: { fontSize: 11, },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 10, letterSpacing: 0.6 },
  fieldValue: { fontSize: 14, },
  sectionTitle: { fontSize: 14, marginTop: 6 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  itemDesc: { fontSize: 14, },
  itemMeta: { fontSize: 12, marginTop: 2 },
  itemTotal: { fontSize: 14, },
  totals: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 14 },
  totalDivider: { height: 1, marginVertical: 4 },
  divider: { height: 1, marginVertical: 8 },
  bankLabel: { fontSize: 10, letterSpacing: 0.6, marginBottom: 4 },
  errorText: { fontSize: 14, textAlign: "center", },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14 },
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
  modalTitle: { fontSize: 17, marginBottom: 2 },
  modalSubtitle: { fontSize: 12, marginBottom: 8 },
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
  cancelText: { fontSize: 15, },
});
