import { Feather } from "@/components/Icon";
import {
  type Client,
  getListClientsQueryKey,
  useListClients,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardTypeOptions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useColors } from "@/hooks/useColors";

export type LineItemDraft = {
  description: string;
  detail: string;
  qty: string;
  rate: string;
};

export type BillingFormState = {
  kind: "invoice" | "quotation";
  clientId: number | null;
  customerName: string;
  customerAddress: string;
  customerTin: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  gstRate: string;
  gstInclusive: boolean;
  notes: string;
  status: string;
  items: LineItemDraft[];
};

export const EMPTY_FORM: BillingFormState = {
  kind: "invoice",
  clientId: null,
  customerName: "",
  customerAddress: "",
  customerTin: "",
  issueDate: "",
  dueDate: "",
  terms: "",
  gstRate: "0",
  gstInclusive: false,
  notes: "",
  status: "draft",
  items: [{ description: "", detail: "", qty: "1", rate: "" }],
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "payment_received", label: "Payment Received" },
  { value: "completed", label: "Completed" },
];

function statusLabel(s: string) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? (s || "Draft");
}

function fmtMVR(n: number) {
  return `MVR ${(isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface Props {
  initialValues?: Partial<BillingFormState>;
  onSubmit: (form: BillingFormState) => Promise<void>;
  isSaving: boolean;
  submitLabel: string;
}

export default function BillingDocumentForm({
  initialValues,
  onSubmit,
  isSaving,
  submitLabel,
}: Props) {
  const colors = useColors();
  const [form, setForm] = useState<BillingFormState>({
    ...EMPTY_FORM,
    ...initialValues,
    items:
      initialValues?.items && initialValues.items.length > 0
        ? initialValues.items
        : EMPTY_FORM.items,
  });

  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const { data: clientsRaw = [] } = useListClients(undefined, {
    query: { queryKey: getListClientsQueryKey() },
  });
  const clients = clientsRaw as Client[];

  const filteredClients = useMemo(
    () =>
      clientSearch
        ? clients.filter((c) =>
            (c.name ?? "").toLowerCase().includes(clientSearch.toLowerCase()),
          )
        : clients,
    [clients, clientSearch],
  );

  const selectedClient = clients.find((c) => c.id === form.clientId) ?? null;

  const setF = <K extends keyof BillingFormState>(key: K, value: BillingFormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const setItem = (idx: number, key: keyof LineItemDraft, value: string) => {
    setForm((s) => {
      const items = [...s.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...s, items };
    });
  };

  const addItem = () =>
    setForm((s) => ({
      ...s,
      items: [...s.items, { description: "", detail: "", qty: "1", rate: "" }],
    }));

  const removeItem = (idx: number) => {
    if (form.items.length <= 1) {
      Alert.alert("Required", "At least one line item is required.");
      return;
    }
    setForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));
  };

  const totals = useMemo(() => {
    const sub = form.items.reduce(
      (acc, it) => acc + Number(it.qty || 0) * Number(it.rate || 0),
      0,
    );
    const rate = Number(form.gstRate || 0) / 100;
    if (form.gstInclusive) {
      const base = sub / (1 + rate);
      return { sub: base, gst: sub - base, total: sub };
    }
    const gst = sub * rate;
    return { sub, gst, total: sub + gst };
  }, [form.items, form.gstRate, form.gstInclusive]);

  const handleSubmit = async () => {
    if (!form.customerName.trim()) {
      Alert.alert("Required", "Customer name is required.");
      return;
    }
    if (!form.issueDate.trim()) {
      Alert.alert("Required", "Issue date is required (YYYY-MM-DD).");
      return;
    }
    const hasEmptyDesc = form.items.some((it) => !it.description.trim());
    if (hasEmptyDesc) {
      Alert.alert("Required", "All line items must have a description.");
      return;
    }
    try {
      await onSubmit(form);
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: 48 }]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      {/* Kind selector */}
      <View style={styles.section}>
        <Label text="Type" />
        <View style={styles.kindRow}>
          {(["invoice", "quotation"] as const).map((k) => {
            const active = form.kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => setF("kind", k)}
                style={[
                  styles.kindBtn,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Feather
                  name={k === "invoice" ? "file-text" : "file"}
                  size={16}
                  color={active ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.kindBtnText,
                    { color: active ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {k === "invoice" ? "Invoice" : "Quotation"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Client */}
      <View style={styles.section}>
        <Label text="Client" />
        <Pressable
          onPress={() => setClientModalVisible(true)}
          style={[
            styles.pickerBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.pickerBtnText,
              {
                color: selectedClient ? colors.foreground : colors.mutedForeground,
                flex: 1,
              },
            ]}
            numberOfLines={1}
          >
            {selectedClient?.name ?? "Select client…"}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Label text="Status" />
        <Pressable
          onPress={() => setStatusModalVisible(true)}
          style={[
            styles.pickerBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.pickerBtnText, { color: colors.foreground, flex: 1 }]}>
            {statusLabel(form.status)}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Customer */}
      <View style={styles.section}>
        <Label text="Customer Name *" />
        <Field
          value={form.customerName}
          onChangeText={(v) => setF("customerName", v)}
          placeholder="Full name or company"
          autoCapitalize="words"
        />
      </View>
      <View style={styles.section}>
        <Label text="Customer Address" />
        <Field
          value={form.customerAddress}
          onChangeText={(v) => setF("customerAddress", v)}
          placeholder="Optional"
          multiline
        />
      </View>
      <View style={styles.section}>
        <Label text="Customer TIN" />
        <Field
          value={form.customerTin}
          onChangeText={(v) => setF("customerTin", v)}
          placeholder="Tax identification number"
          autoCapitalize="characters"
        />
      </View>

      {/* Dates */}
      <View style={styles.row2}>
        <View style={[styles.section, { flex: 1 }]}>
          <Label text="Issue Date *" />
          <Field
            value={form.issueDate}
            onChangeText={(v) => setF("issueDate", v)}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={[styles.section, { flex: 1 }]}>
          <Label text="Due Date" />
          <Field
            value={form.dueDate}
            onChangeText={(v) => setF("dueDate", v)}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      {/* Terms */}
      <View style={styles.section}>
        <Label text="Payment Terms" />
        <Field
          value={form.terms}
          onChangeText={(v) => setF("terms", v)}
          placeholder="e.g. Net 30"
        />
      </View>

      {/* GST */}
      <View style={styles.row2}>
        <View style={[styles.section, { flex: 1 }]}>
          <Label text="GST Rate (%)" />
          <Field
            value={form.gstRate}
            onChangeText={(v) => setF("gstRate", v)}
            placeholder="0"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={[styles.section, { flex: 1 }]}>
          <Label text="GST Inclusive" />
          <View
            style={[
              styles.toggleRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
              {form.gstInclusive ? "Yes" : "No"}
            </Text>
            <Switch
              value={form.gstInclusive}
              onValueChange={(v) => setF("gstInclusive", v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>

      {/* Line items */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Label text="Line Items *" />
          <Pressable onPress={addItem} style={styles.addItemBtn}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[styles.addItemText, { color: colors.primary }]}>Add</Text>
          </Pressable>
        </View>

        {form.items.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.itemCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.itemHeader}>
              <Text style={[styles.itemNum, { color: colors.mutedForeground }]}>
                #{idx + 1}
              </Text>
              <Pressable onPress={() => removeItem(idx)} hitSlop={10}>
                <Feather name="trash-2" size={15} color={colors.destructive} />
              </Pressable>
            </View>

            <Field
              value={item.description}
              onChangeText={(v) => setItem(idx, "description", v)}
              placeholder="Description *"
              autoCapitalize="sentences"
            />
            <Field
              value={item.detail}
              onChangeText={(v) => setItem(idx, "detail", v)}
              placeholder="Detail (optional)"
              autoCapitalize="sentences"
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Label text="Qty" />
                <Field
                  value={item.qty}
                  onChangeText={(v) => setItem(idx, "qty", v)}
                  placeholder="1"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="Rate (MVR)" />
                <Field
                  value={item.rate}
                  onChangeText={(v) => setItem(idx, "rate", v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Label text="Amount" />
                <View
                  style={[
                    styles.amountBox,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.amountText, { color: colors.foreground }]}>
                    {fmtMVR(Number(item.qty || 0) * Number(item.rate || 0))}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View
        style={[
          styles.totalsBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TotalRow label="Subtotal" value={fmtMVR(totals.sub)} colors={colors} />
        <TotalRow
          label={`GST (${form.gstRate || "0"}%${form.gstInclusive ? ", incl." : ""})`}
          value={fmtMVR(totals.gst)}
          colors={colors}
        />
        <View style={[styles.totalDivider, { backgroundColor: colors.border }]} />
        <TotalRow label="Total" value={fmtMVR(totals.total)} bold colors={colors} />
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Label text="Notes" />
        <Field
          value={form.notes}
          onChangeText={(v) => setF("notes", v)}
          placeholder="Any additional notes…"
          multiline
          minHeight={80}
        />
      </View>

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={isSaving}
        style={({ pressed }) => [
          styles.submitBtn,
          {
            backgroundColor: colors.primary,
            opacity: isSaving ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {isSaving ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="save" size={18} color={colors.primaryForeground} />
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
              {submitLabel}
            </Text>
          </>
        )}
      </Pressable>

      {/* Client picker modal */}
      <Modal
        visible={clientModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setClientModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalNav, { borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Select Client
            </Text>
            <Pressable
              onPress={() => { setClientModalVisible(false); setClientSearch(""); }}
              hitSlop={12}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="Search…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {clientSearch.length > 0 && (
              <Pressable onPress={() => setClientSearch("")} hitSlop={8}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={filteredClients}
            keyExtractor={(c) => String(c.id)}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => {
              const selected = item.id === form.clientId;
              return (
                <Pressable
                  onPress={() => {
                    setForm((s) => ({
                      ...s,
                      clientId: item.id,
                      customerName: item.name ?? s.customerName,
                      customerAddress: item.address ?? s.customerAddress,
                      customerTin: item.tin ?? s.customerTin,
                    }));
                    setClientModalVisible(false);
                    setClientSearch("");
                  }}
                  style={({ pressed }) => [
                    styles.companyRow,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.companyName,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.contactPerson ? (
                      <Text
                        style={[
                          styles.clientSub,
                          { color: selected ? colors.primaryForeground + "cc" : colors.mutedForeground },
                        ]}
                        numberOfLines={1}
                      >
                        {item.contactPerson}
                      </Text>
                    ) : null}
                  </View>
                  {selected && (
                    <Feather name="check" size={16} color={colors.primaryForeground} />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No clients found
              </Text>
            }
          />
        </View>
      </Modal>

      {/* Status picker modal */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setStatusModalVisible(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Status
            </Text>
            {STATUS_OPTIONS.map((opt) => {
              const active = opt.value === form.status;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { setF("status", opt.value); setStatusModalVisible(false); }}
                  style={({ pressed }) => [
                    styles.statusRow,
                    {
                      backgroundColor: active
                        ? colors.primary + "22"
                        : pressed
                          ? colors.secondary
                          : "transparent",
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusRowText,
                      {
                        color: active ? colors.primary : colors.foreground,
                        flex: 1,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
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
    </KeyboardAwareScrollView>
  );
}

function Label({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.label, { color: colors.mutedForeground }]}>
      {text.toUpperCase()}
    </Text>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  minHeight,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  minHeight?: number;
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      keyboardType={keyboardType ?? "default"}
      autoCapitalize={autoCapitalize ?? "sentences"}
      style={[
        styles.input,
        {
          backgroundColor: colors.card,
          color: colors.foreground,
          borderColor: colors.border,
          minHeight: minHeight ?? (multiline ? 72 : 46),
          textAlignVertical: multiline ? "top" : "center",
        },
      ]}
    />
  );
}

function TotalRow({
  label,
  value,
  bold,
  colors,
}: {
  label: string;
  value: string;
  bold?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.totalRow}>
      <Text
        style={[
          styles.totalLabel,
          { color: bold ? colors.foreground : colors.mutedForeground, },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.totalValue,
          { color: colors.foreground, fontSize: bold ? 18 : 14 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  section: { gap: 6 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  row2: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  label: { fontSize: 11, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  kindRow: { flexDirection: "row", gap: 10 },
  kindBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  kindBtnText: { fontSize: 14, },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  pickerBtnText: { fontSize: 15, },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 46,
  },
  toggleLabel: { fontSize: 15, },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addItemText: { fontSize: 13, },
  itemCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemNum: { fontSize: 12, },
  amountBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
  },
  amountText: { fontSize: 13, },
  totalsBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 13 },
  totalValue: {},
  totalDivider: { height: 1, marginVertical: 2 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
  },
  submitText: { fontSize: 15, },
  // Company modal
  modalContainer: { flex: 1 },
  modalNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  companyName: { flex: 1, fontSize: 15, },
  clientSub: { fontSize: 12, marginTop: 2 },
  emptyText: { textAlign: "center", marginTop: 20, fontSize: 14, },
  // Status modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
    gap: 6,
  },
  sheetTitle: { fontSize: 17, marginBottom: 6 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusRowText: { fontSize: 15 },
  cancelBtn: { marginTop: 8, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  cancelText: { fontSize: 15, },
});
