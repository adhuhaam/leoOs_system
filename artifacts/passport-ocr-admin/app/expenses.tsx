import { Feather } from "@/components/Icon";
import {
  type Expense,
  type ExpenseCategory,
  getListExpenseCategoriesQueryKey,
  getListExpensesQueryKey,
  type ListExpensesParams,
  useListExpenseCategories,
  useListExpenses,
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

function formatMVR(s: string | number): string {
  const n = typeof s === "string" ? Number(s) : s;
  return `MVR ${(isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ExpensesScreen() {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");

  const params = useMemo<ListExpensesParams>(() => {
    const p: ListExpensesParams = {};
    if (search.trim()) p.search = search.trim();
    if (categoryId !== "all") p.categoryId = categoryId;
    return p;
  }, [search, categoryId]);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useListExpenses(params, {
      query: { queryKey: getListExpensesQueryKey(params) },
    });

  const { data: categories = [] } = useListExpenseCategories({
    query: { queryKey: getListExpenseCategoriesQueryKey() },
  });

  const expenses = (data ?? []) as Expense[];
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
            Total
          </Text>
          <Text style={[styles.totalValue, { color: colors.foreground }]}>
            {formatMVR(total)}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/expense/new")}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
            Add
          </Text>
        </Pressable>
      </View>

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
          placeholder="Search remarks or amount"
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

      <View style={styles.chipRow}>
        <CategoryChip
          label="All"
          active={categoryId === "all"}
          onPress={() => setCategoryId("all")}
        />
        {(categories as ExpenseCategory[]).map((c) => (
          <CategoryChip
            key={c.id}
            label={c.name}
            active={categoryId === c.id}
            onPress={() => setCategoryId(c.id)}
          />
        ))}
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
          data={expenses}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={
            expenses.length === 0 ? styles.emptyContent : styles.listContent
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
              <Feather name="dollar-sign" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No expenses
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap Add to log your first expense.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              onPress={() => router.push(`/expense/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
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
        {label}
      </Text>
    </Pressable>
  );
}

function ExpenseRow({
  expense,
  onPress,
}: {
  expense: Expense;
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
          shadowColor: "#000",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.rowCategory, { color: colors.foreground }]}>
          {expense.categoryName}
        </Text>
        {expense.remarks ? (
          <Text
            style={[styles.rowRemarks, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {expense.remarks}
          </Text>
        ) : null}
        {expense.expenseDate ? (
          <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>
            {expense.expenseDate}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowAmount, { color: colors.foreground }]}>
        {formatMVR(expense.amount)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  totalLabel: { fontSize: 11, letterSpacing: 0.5 },
  totalValue: { fontSize: 22, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addBtnText: { fontSize: 13, },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
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
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, },
  listContent: { padding: 16, gap: 10 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rowCategory: { fontSize: 15, },
  rowRemarks: { fontSize: 12, },
  rowDate: { fontSize: 11, },
  rowAmount: { fontSize: 16, },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, },
  emptyText: { fontSize: 14, textAlign: "center" },
  errorText: { fontSize: 14, textAlign: "center", },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14 },
});
