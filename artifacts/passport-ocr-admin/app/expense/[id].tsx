import { Feather } from "@/components/Icon";
import { CalendarPicker, todayISO } from "@/components/CalendarPicker";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Expense,
  type ExpenseCategory,
  getListExpenseCategoriesQueryKey,
  getListExpensesQueryKey,
  useCreateExpenseCategory,
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

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DateShortcut = "today" | "yesterday" | "custom";

function getShortcut(iso: string): DateShortcut {
  if (!iso) return "custom";
  if (iso === todayISO()) return "today";
  if (iso === yesterdayISO()) return "yesterday";
  return "custom";
}

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
  const [dateShortcut, setDateShortcut] = useState<DateShortcut>("custom");
  const [showCal, setShowCal] = useState(false);

  // Quick-add category
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const createCategoryMutation = useCreateExpenseCategory();

  useEffect(() => {
    if (expense && !hydrated) {
      setCategoryId(expense.categoryId);
      setAmount(expense.amount);
      const d = expense.expenseDate ?? "";
      setExpenseDate(d);
      setDateShortcut(getShortcut(d));
      setRemarks(expense.remarks ?? "");
      setHydrated(true);
    }
  }, [expense, hydrated]);

  function applyShortcut(s: DateShortcut) {
    setDateShortcut(s);
    if (s === "today") { setExpenseDate(todayISO()); setShowCal(false); }
    else if (s === "yesterday") { setExpenseDate(yesterdayISO()); setShowCal(false); }
    else setShowCal(true);
  }

  const updateMutation = useUpdateExpense();
  const deleteMutation = useDeleteExpense();

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
      Alert.alert("Could not save", err instanceof Error ? err.message : "Please try again.");
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
            Alert.alert("Delete failed", err instanceof Error ? err.message : "Please try again.");
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
        <Text style={[styles.errorText, { color: colors.foreground }]}>Expense not found</Text>
      </View>
    );
  }

  const canSave = categoryId != null && Number(amount) > 0;

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Amount hero ── */}
      <View style={[styles.amountCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.amountCurrency}>MVR</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="rgba(255,255,255,0.5)"
          keyboardType="decimal-pad"
          style={styles.amountInput}
          returnKeyType="done"
        />
        <Text style={styles.amountHint}>Tap to edit amount</Text>
      </View>

      {/* ── Category ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
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
                <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.secondaryForeground }]}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}

          {!addingCategory && (
            <Pressable
              onPress={() => setAddingCategory(true)}
              style={[styles.chip, styles.addCategoryChip, { borderColor: colors.primary, backgroundColor: colors.primary + "12" }]}
            >
              <Feather name="plus" size={13} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.primary }]}>New</Text>
            </Pressable>
          )}
        </View>

        {addingCategory && (
          <View style={[styles.newCatRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
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
            <Pressable onPress={() => { setAddingCategory(false); setNewCategoryName(""); }} hitSlop={8} style={styles.newCatCancel}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Date ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATE</Text>

        <View style={styles.shortcutRow}>
          {(["today", "yesterday", "custom"] as DateShortcut[]).map((s) => {
            const active = dateShortcut === s;
            const label = s === "today" ? "Today" : s === "yesterday" ? "Yesterday" : "Custom";
            return (
              <Pressable
                key={s}
                onPress={() => applyShortcut(s)}
                style={[
                  styles.shortcutChip,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                {s === "custom" && <Feather name="calendar" size={12} color={active ? colors.primaryForeground : colors.mutedForeground} />}
                <Text style={[styles.shortcutText, { color: active ? colors.primaryForeground : colors.secondaryForeground }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {expenseDate ? (
          <View style={[styles.dateDisplay, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Feather name="calendar" size={15} color={colors.primary} />
            <Text style={[styles.dateDisplayText, { color: colors.foreground }]}>{fmtDate(expenseDate)}</Text>
            {dateShortcut === "custom" && (
              <Pressable onPress={() => setShowCal((v) => !v)} hitSlop={8} style={{ marginLeft: "auto" }}>
                <Feather name={showCal ? "chevron-up" : "chevron-down"} size={15} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        ) : null}

        {showCal && (
          <CalendarPicker
            value={expenseDate}
            onChange={(d) => {
              setExpenseDate(d);
              setDateShortcut("custom");
              if (d) setShowCal(false);
            }}
          />
        )}
      </View>

      {/* ── Remarks ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>REMARKS</Text>
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Optional notes about this expense…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.remarksInput, { color: colors.foreground }]}
        />
        {remarks.length > 0 && (
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{remarks.length} chars</Text>
        )}
      </View>

      {/* ── Save ── */}
      <Pressable
        onPress={handleSave}
        disabled={updateMutation.isPending}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.primary, opacity: updateMutation.isPending ? 0.7 : pressed ? 0.85 : 1 },
        ]}
      >
        {updateMutation.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="save" size={18} color={colors.primaryForeground} />
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Save changes</Text>
          </>
        )}
      </Pressable>

      {/* ── Delete ── */}
      <Pressable
        onPress={handleDelete}
        disabled={deleteMutation.isPending}
        style={({ pressed }) => [
          styles.destructiveBtn,
          { borderColor: colors.destructive, opacity: deleteMutation.isPending ? 0.5 : pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="trash-2" size={18} color={colors.destructive} />
        <Text style={[styles.destructiveText, { color: colors.destructive }]}>Delete expense</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontSize: 14, textAlign: "center" },

  /* Amount hero */
  amountCard: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 4,
  },
  amountCurrency: { fontSize: 14, color: "rgba(255,255,255,0.75)", letterSpacing: 1, fontWeight: "600" },
  amountInput: {
    fontSize: 52,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    minWidth: 120,
    padding: 0,
  },
  amountHint: { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 },

  /* Section cards */
  sectionCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: "600" },

  /* Category chips */
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "500" },
  addCategoryChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  newCatRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  newCatInput: { flex: 1, fontSize: 14, padding: 0 },
  newCatBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  newCatCancel: { padding: 4 },

  /* Date */
  shortcutRow: { flexDirection: "row", gap: 8 },
  shortcutChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  shortcutText: { fontSize: 13, fontWeight: "500" },
  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateDisplayText: { fontSize: 15, fontWeight: "500" },

  /* Remarks */
  remarksInput: {
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: "top",
    padding: 0,
  },
  charCount: { fontSize: 11, textAlign: "right" },

  /* Buttons */
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 4,
  },
  btnText: { fontSize: 16, fontWeight: "600" },
  destructiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  destructiveText: { fontSize: 15, fontWeight: "500" },
});
