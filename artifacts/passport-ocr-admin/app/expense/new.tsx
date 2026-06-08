import { Feather } from "@/components/Icon";
import { CalendarPicker, todayISO } from "@/components/CalendarPicker";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ExpenseCategory,
  getListExpenseCategoriesQueryKey,
  useCreateExpense,
  useCreateExpenseCategory,
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

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
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
  const [showCal, setShowCal] = useState(false);

  // Quick-add category
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const createCategoryMutation = useCreateExpenseCategory();

  useEffect(() => {
    if (categoryId == null && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categoryId, categories]);

  const createMutation = useCreateExpense();
  const valid = categoryId != null && Number(amount) > 0;

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const created = await createCategoryMutation.mutateAsync({ data: { name } });
      await qc.invalidateQueries({ queryKey: getListExpenseCategoriesQueryKey() });
      setCategoryId((created as ExpenseCategory).id);
      setNewCategoryName("");
      setAddingCategory(false);
    } catch (err) {
      Alert.alert("Could not create category", err instanceof Error ? err.message : "Please try again.");
    }
  }

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
                  { color: active ? colors.primaryForeground : colors.secondaryForeground },
                ]}
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}

        {/* Quick-add chip */}
        {!addingCategory ? (
          <Pressable
            onPress={() => setAddingCategory(true)}
            style={[styles.chip, styles.addCategoryChip, { borderColor: colors.primary, backgroundColor: colors.primary + "12" }]}
          >
            <Feather name="plus" size={13} color={colors.primary} />
            <Text style={[styles.chipText, { color: colors.primary }]}>New</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Inline new-category input */}
      {addingCategory && (
        <View style={[styles.newCatRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="Category name…"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            style={[styles.newCatInput, { color: colors.foreground }]}
            returnKeyType="done"
            onSubmitEditing={handleAddCategory}
          />
          <Pressable
            onPress={handleAddCategory}
            disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
            style={[styles.newCatBtn, { backgroundColor: colors.primary, opacity: newCategoryName.trim() ? 1 : 0.4 }]}
          >
            {createCategoryMutation.isPending
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Feather name="check" size={16} color={colors.primaryForeground} />}
          </Pressable>
          <Pressable
            onPress={() => { setAddingCategory(false); setNewCategoryName(""); }}
            hitSlop={8}
            style={styles.newCatCancel}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}

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
          },
        ]}
      />

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        DATE
      </Text>
      <Pressable
        onPress={() => setShowCal((v) => !v)}
        style={[styles.dateTrigger, { backgroundColor: colors.card, borderColor: expenseDate ? colors.primary : colors.border }]}
      >
        <Feather name="calendar" size={16} color={expenseDate ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.dateTriggerText, { color: expenseDate ? colors.foreground : colors.mutedForeground, flex: 1 }]}>
          {expenseDate ? fmtDate(expenseDate) : "Pick date"}
        </Text>
        {expenseDate ? (
          <Pressable onPress={(e) => { e.stopPropagation?.(); setExpenseDate(""); setShowCal(false); }} hitSlop={8}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        ) : (
          <Feather name={showCal ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
        )}
      </Pressable>
      {showCal && (
        <CalendarPicker
          value={expenseDate}
          onChange={(d) => { setExpenseDate(d); if (d) setShowCal(false); }}
        />
      )}

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
            opacity: !valid || createMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
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
  fieldLabel: { fontSize: 11, letterSpacing: 0.6, marginTop: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  addCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  newCatRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginTop: 4,
  },
  newCatInput: { flex: 1, fontSize: 14, padding: 0 },
  newCatBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  newCatCancel: { padding: 4 },
  helper: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  dateTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateTriggerText: { fontSize: 15 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  btnText: { fontSize: 15 },
});
