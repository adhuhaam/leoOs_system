import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPasswordsQueryKey,
  type ListPasswordsParams,
  type Password,
  useCreatePassword,
  useDeletePassword,
  useListPasswords,
  useUpdatePassword,
} from "@workspace/api-client-react";
import * as Clipboard from "expo-clipboard";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface FormState {
  website: string;
  owner: string;
  username: string;
  password: string;
}

const EMPTY_FORM: FormState = {
  website: "",
  owner: "",
  username: "",
  password: "",
};

export default function PasswordsScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Password | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const params = useMemo<ListPasswordsParams>(() => {
    const p: ListPasswordsParams = {};
    if (search.trim()) p.search = search.trim();
    return p;
  }, [search]);

  const { data, isLoading, isError, error, refetch, isFetching } = useListPasswords(
    params,
    { query: { queryKey: getListPasswordsQueryKey(params) } },
  );

  const entries = (data ?? []) as Password[];

  const sections = useMemo(() => {
    const map = new Map<string, { label: string; data: Password[] }>();
    for (const e of entries) {
      const key = e.website.toLowerCase();
      const existing = map.get(key);
      if (existing) existing.data.push(e);
      else map.set(key, { label: e.website, data: [e] });
    }
    return Array.from(map.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((g) => ({ title: g.label, data: g.data }));
  }, [entries]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListPasswordsQueryKey() });

  const deleteMutation = useDeletePassword();

  const confirmDelete = (entry: Password) => {
    Alert.alert(
      "Delete password?",
      `Remove the ${entry.owner} entry for ${entry.website}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(
              { id: entry.id },
              {
                onSuccess: () => invalidate(),
                onError: () => Alert.alert("Failed to delete"),
              },
            );
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
            Vault
          </Text>
          <Text style={[styles.totalValue, { color: colors.foreground }]}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </Text>
        </View>
        <Pressable
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
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
          placeholder="Search website, owner or username"
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
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={
            sections.length === 0 ? styles.emptyContent : styles.listContent
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
              <Feather name="key" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No passwords saved
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap Add to save your first credential.
              </Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Feather name="globe" size={14} color={colors.mutedForeground} />
              <Text
                style={[styles.sectionTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {section.title}
              </Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                ({section.data.length})
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <PasswordRow
              entry={item}
              onEdit={() => setEditing(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
        />
      )}

      <PasswordFormModal
        mode="create"
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={invalidate}
      />
      <PasswordFormModal
        mode="edit"
        entry={editing}
        visible={editing != null}
        onClose={() => setEditing(null)}
        onSaved={invalidate}
      />
    </View>
  );
}

function PasswordRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: Password;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const [revealed, setRevealed] = useState(false);

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied", `${label} copied to clipboard.`);
  };

  return (
    <View
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Text style={[styles.rowOwner, { color: colors.mutedForeground }]}>
        {entry.owner}
      </Text>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          Username
        </Text>
        <View style={styles.fieldValueRow}>
          <Text style={[styles.fieldValue, { color: colors.foreground }]} numberOfLines={1}>
            {entry.username}
          </Text>
          <Pressable
            onPress={() => copy(entry.username, "Username")}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Feather name="copy" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          Password
        </Text>
        <View style={styles.fieldValueRow}>
          <Text style={[styles.fieldValue, { color: colors.foreground }]} numberOfLines={1}>
            {revealed
              ? entry.password
              : "•".repeat(Math.min(entry.password.length, 12))}
          </Text>
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Feather
              name={revealed ? "eye-off" : "eye"}
              size={16}
              color={colors.primary}
            />
          </Pressable>
          <Pressable
            onPress={() => copy(entry.password, "Password")}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Feather name="copy" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="edit-2" size={14} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            Edit
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.destructive,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={[styles.actionText, { color: colors.destructive }]}>
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PasswordFormModal({
  mode,
  entry,
  visible,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  entry?: Password | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useColors();
  const createMutation = useCreatePassword();
  const updateMutation = useUpdatePassword();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);
  const wantedKey = visible
    ? mode === "edit" && entry
      ? `edit-${entry.id}`
      : "create"
    : null;
  if (snapshotKey !== wantedKey) {
    setSnapshotKey(wantedKey);
    if (mode === "edit" && entry) {
      setForm({
        website: entry.website,
        owner: entry.owner,
        username: entry.username,
        password: entry.password,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setShowPassword(false);
  }

  const handleSave = () => {
    const website = form.website.trim();
    const owner = form.owner.trim();
    const username = form.username.trim();
    const password = form.password;
    if (!website || !owner || !username || !password) {
      Alert.alert("All four fields are required.");
      return;
    }
    const payload = { website, owner, username, password };
    const onSuccess = () => {
      onSaved();
      onClose();
    };
    if (mode === "edit" && entry) {
      updateMutation.mutate(
        { id: entry.id, data: payload },
        { onSuccess, onError: () => Alert.alert("Failed to update") },
      );
    } else {
      createMutation.mutate(
        { data: payload },
        { onSuccess, onError: () => Alert.alert("Failed to add") },
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View
          style={[styles.modalHeader, { borderBottomColor: colors.border }]}
        >
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[styles.modalCancel, { color: colors.primary }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {mode === "edit" ? "Edit password" : "Add password"}
          </Text>
          <Pressable onPress={handleSave} disabled={isPending} hitSlop={10}>
            <Text
              style={[
                styles.modalSave,
                { color: colors.primary, opacity: isPending ? 0.4 : 1 },
              ]}
            >
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <FormField
            label="Website / application"
            value={form.website}
            onChangeText={(v) => setForm((s) => ({ ...s, website: v }))}
            placeholder="e.g. Gmail, Office 365"
            autoCapitalize="words"
          />
          <FormField
            label="Owner"
            value={form.owner}
            onChangeText={(v) => setForm((s) => ({ ...s, owner: v }))}
            placeholder="Who this account belongs to"
            autoCapitalize="words"
          />
          <FormField
            label="Username"
            value={form.username}
            onChangeText={(v) => setForm((s) => ({ ...s, username: v }))}
            placeholder="Username or email"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
              Password
            </Text>
            <View
              style={[
                styles.passwordInputRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={form.password}
                onChangeText={(v) => setForm((s) => ({ ...s, password: v }))}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.passwordInput, { color: colors.foreground }]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({
  label,
  ...inputProps
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  const colors = useColors();
  return (
    <View style={styles.formField}>
      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
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
  totalLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  totalValue: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  listContent: { padding: 16, gap: 12 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", flexShrink: 1 },
  sectionCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
  row: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  rowOwner: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  fieldBlock: { gap: 4 },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  fieldValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  iconBtn: { padding: 4 },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  errorText: { fontSize: 14, textAlign: "center", fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalCancel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  modalSave: { fontSize: 15, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 16, gap: 14 },
  formField: { gap: 6 },
  formLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
