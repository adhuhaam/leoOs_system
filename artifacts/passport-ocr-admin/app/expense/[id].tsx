import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Expense,
  type ExpenseCategory,
  getListExpenseCategoriesQueryKey,
  getListExpensesQueryKey,
  useDeleteExpense,
  useListExpenseCategories,
  useListExpenses,
  useUpdateExpense,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useColors } from "@/hooks/useColors";

export default function ExpenseDetailScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);

  const { data: expensesData = [], isLoading } = useListExpenses(undefined, {
    query: { queryKey: getListExpensesQueryKey() },
  });
  const { data: categoriesData = [] } = useListExpenseCategories({
    query: { queryKey: getListExpenseCategoriesQueryKey() },
  });

  const expense = (expensesData as Expense[]).find((e) => e.id === id);
  const categories = categoriesData as ExpenseCategory[];

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (expense && !hydrated) {
      setCategoryId(expense.categoryId);
      setAmount(expense.amount);
      setExpenseDate(expense.expenseDate ?? "");
      setRemarks(expense.remarks ?? "");
      setHydrated(true);
    }
  }, [expense, hydrated]);

  const updateMutation = useUpdateExpense();
  const deleteMutation = useDeleteExpense();

  async function handleSave() {
    if (!expense || categoryId == null || !amount) return;
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          categoryId,
          amount,
          expenseDate: expenseDate || null,
          remarks: remarks || null,
        },
      });
      await qc.invalidateQueries();
      Alert.alert("Saved", "Expense updated.");
    } catch (err) {
      Alert.alert(
        "Could not save",
        err instanceof Error ? err.message : "Please try again.",
      );
    }
  }

  function handleDelete() {
    Alert.alert("Delete expense?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id });
            await qc.invalidateQueries();
            router.back();
          } catch (err) {
            Alert.alert(
              "Delete failed",
              err instanceof Error ? err.message : "Please try again.",
            );
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          Expense not found
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        CATEGORY
      </Text>
      <View style={styles.chipRow}>
        {categories.map((c) => {
          const active = categoryId === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
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
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        AMOUNT (MVR)
      </Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.foreground,
            fontSize: 22,
            fontFamily: "Inter_700Bold",
          },
        ]}
      />

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        DATE
      </Text>
      <TextInput
        value={expenseDate}
        onChangeText={setExpenseDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
      />

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        REMARKS
      </Text>
      <TextInput
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Optional"
        placeholderTextColor={colors.mutedForeground}
        multiline
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.foreground,
            minHeight: 80,
            textAlignVertical: "top",
          },
        ]}
      />

      <Pressable
        onPress={handleSave}
        disabled={updateMutation.isPending}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: colors.primary,
            opacity: updateMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {updateMutation.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="save" size={18} color={colors.primaryForeground} />
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
              Save changes
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={handleDelete}
        disabled={deleteMutation.isPending}
        style={({ pressed }) => [
          styles.destructiveBtn,
          {
            borderColor: colors.destructive,
            opacity: deleteMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="trash-2" size={18} color={colors.destructive} />
        <Text style={[styles.destructiveText, { color: colors.destructive }]}>
          Delete expense
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginTop: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  destructiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  destructiveText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
});
