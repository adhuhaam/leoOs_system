import { Feather } from "@expo/vector-icons";
import {
  type Company,
  getListCompaniesQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { router, Stack } from "expo-router";
import React, { useState } from "react";
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

export default function CompaniesScreen() {
  const colors = useColors();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error, refetch, isFetching } =
    useListCompanies(undefined, {
      query: { queryKey: getListCompaniesQueryKey() },
    });

  const companies = ((data ?? []) as Company[]).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Companies" }} />

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
          placeholder="Search companies"
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
          <ActivityIndicator color={colors.primary} size="large" />
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
          data={companies}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={
            companies.length === 0 ? styles.emptyContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            companies.length > 0 ? (
              <Text style={[styles.count, { color: colors.mutedForeground }]}>
                {companies.length} {companies.length === 1 ? "company" : "companies"}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="briefcase" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No companies</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Add companies from the web dashboard.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CompanyRow
              company={item}
              onPress={() => router.push(`/companies/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function CompanyRow({
  company,
  onPress,
}: {
  company: Company;
  onPress: () => void;
}) {
  const colors = useColors();
  const initial = (company.name ?? "?")[0]?.toUpperCase() ?? "?";

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
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {company.name ?? "Unnamed company"}
        </Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {[company.country, company.email].filter(Boolean).join(" · ") || "No details"}
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
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  listContent: { padding: 16, paddingTop: 8 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  count: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
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
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  detail: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
