import { Feather } from "@expo/vector-icons";
import {
  type Client,
  type BillingDocumentSummary,
  type Passport,
  getListClientsQueryKey,
  getListPassportsQueryKey,
  getListBillingDocumentsQueryKey,
  useListClients,
  useListPassports,
  useListBillingDocuments,
} from "@workspace/api-client-react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Tab = "candidates" | "billing";

function fmtMVR(s: string | number): string {
  const n = typeof s === "string" ? Number(s) : s;
  return `MVR ${(isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    payment_received: "Payment Received",
    completed: "Completed",
  };
  return map[s] ?? (s || "Draft");
}

export default function ClientDetailScreen() {
  const colors = useColors();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);
  const [tab, setTab] = useState<Tab>("candidates");

  const { data: clientsData, isLoading: clientsLoading } = useListClients(undefined, {
    query: { queryKey: getListClientsQueryKey() },
  });

  const client = ((clientsData ?? []) as Client[]).find((c) => c.id === id);

  const clientIdStr = String(id);
  const { data: candidatesData = [], isLoading: candidatesLoading } = useListPassports(
    { clientId: clientIdStr },
    { query: { queryKey: getListPassportsQueryKey({ clientId: clientIdStr }), enabled: !!client } },
  );

  // Fetch all accessible billing docs then filter client-side.
  // Many invoices/quotations were created with only customerName set and
  // clientId = null, so a pure FK filter misses them. We match by either
  // the FK or a case-insensitive customerName match.
  const { data: allDocsData = [], isLoading: docsLoading } = useListBillingDocuments(
    {},
    { query: { queryKey: getListBillingDocumentsQueryKey(), enabled: !!client } },
  );

  const clientDocs = useMemo<BillingDocumentSummary[]>(() => {
    if (!client) return [];
    const normalizedName = client.name.trim().toLowerCase();
    return (allDocsData as BillingDocumentSummary[])
      .filter(
        (d) =>
          d.clientId === id ||
          d.customerName.trim().toLowerCase() === normalizedName,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allDocsData, id, client]);

  const candidates = candidatesData as Passport[];

  if (clientsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="user-x" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          Client not found
        </Text>
      </View>
    );
  }

  const firstContact = client.contactPerson || client.email || client.phone || null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: client.name }} />

      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {client.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {client.name}
          </Text>
          {firstContact ? (
            <Text style={[styles.subtext, { color: colors.mutedForeground }]} numberOfLines={1}>
              {firstContact}
            </Text>
          ) : null}
        </View>
        {(client.phone || client.email) && (
          <View style={styles.quickActions}>
            {client.phone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${client.phone}`)}
                style={[styles.quickBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Feather name="phone" size={16} color={colors.primary} />
              </Pressable>
            )}
            {client.email && (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${client.email}`)}
                style={[styles.quickBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Feather name="mail" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["candidates", "billing"] as Tab[]).map((t) => {
          const active = t === tab;
          const count = t === "candidates" ? candidates.length : clientDocs.length;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tabBtn,
                active && [styles.tabBtnActive, { borderBottomColor: colors.primary }],
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: active ? colors.primary : colors.mutedForeground },
                ]}
              >
                {t === "candidates" ? "Candidates" : "Invoices & Quotes"}
              </Text>
              <View
                style={[
                  styles.tabCount,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    {
                      color: active ? colors.primaryForeground : colors.mutedForeground,
                    },
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {tab === "candidates" ? (
        candidatesLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : candidates.length === 0 ? (
          <View style={styles.center}>
            <Feather name="users" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No candidates
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Allocate passport records to this client to see them here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={candidates}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <CandidateRow
                passport={item}
                onPress={() => router.push(`/passport/${item.id}`)}
              />
            )}
          />
        )
      ) : docsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : clientDocs.length === 0 ? (
        <View style={styles.center}>
          <Feather name="file-text" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No documents
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No invoices or quotations found for this client.
          </Text>
        </View>
      ) : (
        <FlatList
          data={clientDocs}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <BillingRow
              doc={item}
              onPress={() => router.push(`/billing/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function CandidateRow({
  passport,
  onPress,
}: {
  passport: Passport;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.candidateRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.candidateAvatar, { backgroundColor: colors.secondary }]}>
        <Feather name="user" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.candidateName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {passport.fullName || "—"}
        </Text>
        <Text style={[styles.candidateMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {[passport.passportNumber, passport.nationality]
            .filter(Boolean)
            .join(" · ") || "No details"}
        </Text>
      </View>
      {passport.dateOfExpiry ? (
        <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>
          Exp {passport.dateOfExpiry}
        </Text>
      ) : null}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function BillingRow({
  doc,
  onPress,
}: {
  doc: BillingDocumentSummary;
  onPress: () => void;
}) {
  const colors = useColors();
  const sc = statusColors(doc.status);
  const isInvoice = doc.kind === "invoice";
  const sub = Number(doc.subtotal || 0);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.billingRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.billingIcon,
          {
            backgroundColor: isInvoice ? "#6366F1" : "#F59E0B",
          },
        ]}
      >
        <Feather
          name={isInvoice ? "file-text" : "file"}
          size={14}
          color="#FFF"
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.billingTopRow}>
          <Text style={[styles.billingNumber, { color: colors.foreground }]}>
            {doc.number}
          </Text>
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
        <Text style={[styles.billingDate, { color: colors.mutedForeground }]}>
          {doc.issueDate}
        </Text>
      </View>
      <Text style={[styles.billingAmount, { color: colors.foreground }]}>
        {fmtMVR(sub)}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  subtext: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  quickActions: { flexDirection: "row", gap: 8 },
  quickBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    marginTop: 14,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {},
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCountText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  listContent: { padding: 16, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, textAlign: "center", fontFamily: "Inter_500Medium" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  // candidate row
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  candidateAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  candidateName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  candidateMeta: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  expiryText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  // billing row
  billingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  billingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  billingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  billingNumber: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  billingDate: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  billingAmount: { fontSize: 13, fontFamily: "Inter_700Bold" },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
});
