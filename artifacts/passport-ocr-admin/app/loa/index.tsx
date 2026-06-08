import { Feather } from "@expo/vector-icons";
import {
  getListLoaQueryKey,
  type Loa,
  useDeleteLoa,
  useListLoa,
} from "@workspace/api-client-react";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

const BASE_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function openLoaPrint(id: number) {
  const url = `${BASE_DOMAIN}/loa/${id}/print`;
  WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  });
}

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function LoaCard({
  loa,
  onView,
  onEdit,
  onDelete,
}: {
  loa: Loa;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const initials = (loa.candidateName ?? "?")
    .split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase() || "?";
  return (
    <Pressable
      onPress={onView}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, shadowColor: "#000", opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: "#6366F118" }]}>
        <Text style={[styles.avatarText, { color: "#6366F1" }]}>{initials}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.candidateName, { color: colors.foreground }]} numberOfLines={1}>
          {loa.candidateName || "Unnamed candidate"}
        </Text>
        <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {loa.companyName || "No company"} {loa.jobTitle ? `· ${loa.jobTitle}` : ""}
        </Text>
        <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
          {fmtDate(loa.createdAt)}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          onPress={onEdit}
          hitSlop={10}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function LoaListScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, isFetching, refetch } = useListLoa(undefined, {
    query: { queryKey: getListLoaQueryKey(), staleTime: 15_000 },
  });

  const deleteMutation = useDeleteLoa({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListLoaQueryKey() }),
    },
  });

  const loas = (data ?? []) as Loa[];

  const filtered = search.trim()
    ? loas.filter(
        (l) =>
          l.candidateName?.toLowerCase().includes(search.toLowerCase()) ||
          l.companyName?.toLowerCase().includes(search.toLowerCase()) ||
          l.jobTitle?.toLowerCase().includes(search.toLowerCase()),
      )
    : loas;

  function handleDelete(loa: Loa) {
    Alert.alert(
      "Delete LOA?",
      `Remove the appointment letter for ${loa.candidateName ?? "this candidate"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: loa.id }),
        },
      ],
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by candidate or company..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Count */}
      <Text style={[styles.countText, { color: colors.mutedForeground }]}>
        {filtered.length} {filtered.length === 1 ? "appointment" : "appointments"}
      </Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { borderColor: colors.border }]}>
              <Feather name="file-text" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No matches" : "No LOA entries"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search ? "Try a different search." : "Tap + to create your first appointment letter."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <LoaCard
              loa={item}
              onView={() => openLoaPrint(item.id)}
              onEdit={() => router.push(`/loa/${item.id}` as never)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/loa/new" as never)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, shadowColor: "#000" },
        ]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },

  countText: { fontSize: 12, fontFamily: "Inter_500Medium", marginHorizontal: 20, marginBottom: 8 },

  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cardContent: { flex: 1, gap: 2 },
  candidateName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionBtn: { padding: 6 },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
