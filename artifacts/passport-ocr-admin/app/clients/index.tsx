import { Feather } from "@/components/Icon";
import {
  type Client,
  getListClientsQueryKey,
  type ListClientsParams,
  useListClients,
} from "@workspace/api-client-react";
import { router, Stack } from "expo-router";
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
import { useAuth } from "@/lib/auth";

export default function ClientsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const canAdd = user?.role === "superuser" || user?.role === "admin";

  const params = useMemo<ListClientsParams>(() => {
    const p: ListClientsParams = {};
    if (search.trim()) p.search = search.trim();
    return p;
  }, [search]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useListClients(params, {
      query: { queryKey: getListClientsQueryKey(params) },
    });

  const clients = (data ?? []) as Client[];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Clients" }} />
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
          placeholder="Search clients"
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
          data={clients}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={
            clients.length === 0 ? styles.emptyContent : styles.listContent
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
              <Feather name="users" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No clients
              </Text>
              {canAdd && (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Tap + to add your first client.
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ClientRow
              client={item}
              onPress={() => router.push(`/clients/${item.id}`)}
            />
          )}
        />
      )}

      {/* FAB — only visible to admin and superuser */}
      {canAdd && (
        <Pressable
          onPress={() => router.push("/clients/new")}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="plus" size={26} color={colors.primaryForeground} />
        </Pressable>
      )}
    </View>
  );
}

function ClientRow({
  client,
  onPress,
}: {
  client: Client;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
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
        <Text
          style={[styles.detail, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {client.contactPerson || client.email || client.phone || "—"}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  listContent: { padding: 16, gap: 10, paddingBottom: 100 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, },
  name: { fontSize: 15, },
  detail: { fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, },
  emptyText: { fontSize: 13, textAlign: "center" },
  errorText: { fontSize: 14, textAlign: "center", },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
