import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ExpenseCategory,
  getListExpenseCategoriesQueryKey,
  useCreateExpense,
  useListExpenseCategories,
} from "@workspace/api-client-react";
import { router } from "expo-router";
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewExpenseScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { data: categoriesData = [] } = useListExpenseCategories({
    query: { queryKey: getListExpenseCategoriesQueryKey() },
  });
  const categories = categoriesData as ExpenseCategory[];

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (categoryId == null && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categoryId, categories]);

  const createMutation = useCreateExpense();
  const valid = categoryId != null && Number(amount) > 0;

  async function onSubmit() {
    if (!valid) return;
    try {
      await createMutation.mutateAsync({
        data: {
          categoryId: categoryId!,
          amount: amount,
          expenseDate: expenseDate || undefined,
          remarks: remarks || undefined,
        },
      });
      await qc.invalidateQueries();
      router.back();
    } catch (err) {
      Alert.alert(
        "Could not save",
        err instanceof Error ? err.message : "Please try again.",
      );
    }
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
        {categories.length === 0 ? (
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            Create a category on the web dashboard first.
          </Text>
        ) : (
          categories.map((c) => {
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
          })
        )}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        AMOUNT (MVR)
      </Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        placeholderTextColor={colors.mutedForeground}
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
        placeholder="Optional notes"
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
        onPress={onSubmit}
        disabled={!valid || createMutation.isPending}
        style={({ pressed }) => [
          styles.btn,
          {
            backgroundColor: colors.primary,
            opacity:
              !valid || createMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="check" size={18} color={colors.primaryForeground} />
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
              Save expense
            </Text>
          </>
        )}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8, paddingBottom: 40 },
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
  helper: { fontSize: 13, fontFamily: "Inter_400Regular" },
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
});
