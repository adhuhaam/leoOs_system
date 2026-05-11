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
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

const AVATAR_PALETTE = [
  { bg: "#FEE2E2", fg: "#B91C1C" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#DCFCE7", fg: "#15803D" },
  { bg: "#E0F2FE", fg: "#0369A1" },
  { bg: "#EDE9FE", fg: "#6D28D9" },
  { bg: "#FCE7F3", fg: "#BE185D" },
  { bg: "#CCFBF1", fg: "#0F766E" },
  { bg: "#FFEDD5", fg: "#C2410C" },
];

function colorFor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initialsFor(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

  // Always-fresh, unfiltered list used to derive the website picker options
  // so they stay complete even while the user is searching the main list.
  const { data: allData } = useListPasswords(
    {},
    { query: { queryKey: getListPasswordsQueryKey() } },
  );

  const entries = (data ?? []) as Password[];
  const allEntries = (allData ?? []) as Password[];

  const sections = useMemo(() => {
    const map = new Map<string, { label: string; data: Password[] }>();
    for (const e of entries) {
      const key = e.website.toLowerCase();
      const existing = map.get(key);
      if (existing) existing.data.push(e);
      else map.set(key, { label: e.website, data: [e] });
    }
    for (const g of map.values()) {
      g.data.sort((a, b) => a.owner.localeCompare(b.owner));
    }
    return Array.from(map.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((g) => ({ title: g.label, data: g.data }));
  }, [entries]);

  const websiteCount = useMemo(
    () => new Set(entries.map((e) => e.website.toLowerCase())).size,
    [entries],
  );
  const ownerCount = useMemo(
    () => new Set(entries.map((e) => e.owner.toLowerCase())).size,
    [entries],
  );

  // Distinct existing websites (preserve original casing of first occurrence).
  // Sourced from the unfiltered list so the picker stays complete during search.
  const websiteOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of allEntries) {
      const key = e.website.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, e.website.trim());
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [allEntries]);

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
      <View style={styles.statsRow}>
        <StatCard label="Entries" value={entries.length} colors={colors} />
        <StatCard label="Websites" value={websiteCount} colors={colors} />
        <StatCard label="Owners" value={ownerCount} colors={colors} />
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
            <View style={styles.emptyBox}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.primary + "22" },
                ]}
              >
                <Feather name="key" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No matches" : "Your vault is empty"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search
                  ? "Try a different search — websites, owners, and usernames are all searchable."
                  : "Tap the + button below to save your first credential."}
              </Text>
            </View>
          }
          renderSectionHeader={({ section }) => {
            const palette = colorFor(section.title.toLowerCase());
            return (
              <View style={styles.sectionHeader}>
                <View
                  style={[styles.sectionAvatar, { backgroundColor: palette.bg }]}
                >
                  <Text style={[styles.sectionAvatarText, { color: palette.fg }]}>
                    {initialsFor(section.title)}
                  </Text>
                </View>
                <Text
                  style={[styles.sectionTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {section.title}
                </Text>
                <View
                  style={[
                    styles.sectionBadge,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text
                    style={[styles.sectionBadgeText, { color: colors.foreground }]}
                  >
                    {section.data.length}
                  </Text>
                </View>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <PasswordRow
              entry={item}
              onEdit={() => setEditing(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
        />
      )}

      <Pressable
        onPress={() => setAddOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
            shadowColor: colors.primary,
          },
        ]}
        accessibilityLabel="Add password"
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </Pressable>

      <PasswordFormModal
        mode="create"
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={invalidate}
        websiteOptions={websiteOptions}
      />
      <PasswordFormModal
        mode="edit"
        entry={editing}
        visible={editing != null}
        onClose={() => setEditing(null)}
        onSaved={invalidate}
        websiteOptions={websiteOptions}
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
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
  const palette = colorFor(entry.owner.toLowerCase());

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied", `${label} copied to clipboard.`);
  };

  return (
    <View
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.rowHeader}>
        <View style={[styles.ownerAvatar, { backgroundColor: palette.bg }]}>
          <Text style={[styles.ownerAvatarText, { color: palette.fg }]}>
            {initialsFor(entry.owner)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.ownerLabel, { color: colors.mutedForeground }]}>
            Owner
          </Text>
          <Text
            style={[styles.ownerName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {entry.owner}
          </Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            style={[
              styles.actionBtn,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
            accessibilityLabel="Edit password"
          >
            <Feather name="edit-2" size={15} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.destructive + "15",
                borderColor: colors.destructive + "40",
              },
            ]}
            accessibilityLabel="Delete password"
          >
            <Feather name="trash-2" size={15} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          Username
        </Text>
        <View style={styles.fieldValueRow}>
          <Text
            style={[styles.fieldValue, { color: colors.foreground }]}
            numberOfLines={1}
          >
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
          <Text
            style={[
              styles.fieldValue,
              {
                color: colors.foreground,
                fontFamily: revealed ? "Inter_500Medium" : "Inter_700Bold",
                letterSpacing: revealed ? 0 : 2,
              },
            ]}
            numberOfLines={1}
          >
            {revealed
              ? entry.password
              : "•".repeat(Math.min(Math.max(entry.password.length, 6), 14))}
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
    </View>
  );
}

function PasswordFormModal({
  mode,
  entry,
  visible,
  onClose,
  onSaved,
  websiteOptions,
}: {
  mode: "create" | "edit";
  entry?: Password | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  websiteOptions: string[];
}) {
  const colors = useColors();
  const createMutation = useCreatePassword();
  const updateMutation = useUpdatePassword();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [websitePickerOpen, setWebsitePickerOpen] = useState(false);
  const entryId = mode === "edit" && entry ? entry.id : null;

  useEffect(() => {
    if (!visible) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, entryId]);

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

  const websitePalette = form.website
    ? colorFor(form.website.toLowerCase())
    : null;

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
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
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

        <ScrollView
          contentContainerStyle={styles.modalBody}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
              Website / application
            </Text>
            <Pressable
              onPress={() => setWebsitePickerOpen(true)}
              style={({ pressed }) => [
                styles.pickerBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {form.website && websitePalette ? (
                <View
                  style={[
                    styles.pickerAvatar,
                    { backgroundColor: websitePalette.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerAvatarText,
                      { color: websitePalette.fg },
                    ]}
                  >
                    {initialsFor(form.website)}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.pickerAvatar,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="globe" size={14} color={colors.mutedForeground} />
                </View>
              )}
              <Text
                style={[
                  styles.pickerValue,
                  {
                    color: form.website
                      ? colors.foreground
                      : colors.mutedForeground,
                  },
                ]}
                numberOfLines={1}
              >
                {form.website || "Pick or add a website / app"}
              </Text>
              <Feather
                name="chevron-down"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              Pick from your existing websites or type a new one to add it.
            </Text>
          </View>

          <FormField
            label="Owner"
            value={form.owner}
            onChangeText={(v) => setForm((s) => ({ ...s, owner: v }))}
            placeholder="Whose account this is"
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

        <WebsitePickerModal
          visible={websitePickerOpen}
          options={websiteOptions}
          currentValue={form.website}
          onClose={() => setWebsitePickerOpen(false)}
          onPick={(v) => {
            setForm((s) => ({ ...s, website: v }));
            setWebsitePickerOpen(false);
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function WebsitePickerModal({
  visible,
  options,
  currentValue,
  onClose,
  onPick,
}: {
  visible: boolean;
  options: string[];
  currentValue: string;
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  const colors = useColors();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const filtered = useMemo(
    () =>
      lower
        ? options.filter((o) => o.toLowerCase().includes(lower))
        : options,
    [options, lower],
  );
  const exactMatch = options.some((o) => o.toLowerCase() === lower);
  const showAddNew = trimmed.length > 0 && !exactMatch;

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
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[styles.modalCancel, { color: colors.primary }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Pick a website / app
          </Text>
          <View style={{ width: 56 }} />
        </View>

        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search or type a new one…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.pickerList}
          ListHeaderComponent={
            showAddNew ? (
              <Pressable
                onPress={() => onPick(trimmed)}
                style={({ pressed }) => [
                  styles.pickerOption,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.pickerOptionAvatar,
                    { backgroundColor: colors.primary + "22" },
                  ]}
                >
                  <Feather name="plus" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.pickerOptionLabel,
                      { color: colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    Use “{trimmed}” as new
                  </Text>
                  <Text
                    style={[
                      styles.pickerOptionMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Adds it to your list
                  </Text>
                </View>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const palette = colorFor(item.toLowerCase());
            const isSelected = currentValue.toLowerCase() === item.toLowerCase();
            return (
              <Pressable
                onPress={() => onPick(item)}
                style={({ pressed }) => [
                  styles.pickerOption,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.pickerOptionAvatar,
                    { backgroundColor: palette.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerOptionAvatarText,
                      { color: palette.fg },
                    ]}
                  >
                    {initialsFor(item)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.pickerOptionLabel,
                    { color: colors.foreground, flex: 1 },
                  ]}
                  numberOfLines={1}
                >
                  {item}
                </Text>
                {isSelected && (
                  <Feather name="check" size={18} color={colors.primary} />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            !showAddNew ? (
              <View style={styles.pickerEmpty}>
                <Text
                  style={[
                    styles.pickerEmptyText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {options.length === 0
                    ? "No saved websites yet — type one above to add it."
                    : "No matches. Type something new to add it."}
                </Text>
              </View>
            ) : null
          }
        />
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
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 26 },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
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
  listContent: { padding: 16, paddingBottom: 110, gap: 12 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  emptyBox: { alignItems: "center", gap: 12, paddingVertical: 24 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionAvatarText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    flexShrink: 1,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  row: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  ownerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerAvatarText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  ownerLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  ownerName: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 1 },
  rowActions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: 1, opacity: 0.7, marginVertical: 2 },
  fieldBlock: { gap: 4 },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  fieldValueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldValue: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  iconBtn: { padding: 6, borderRadius: 6 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
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
  helperText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
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
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerAvatarText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  pickerList: { padding: 16, gap: 8 },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  pickerOptionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerOptionAvatarText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  pickerOptionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pickerOptionMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  pickerEmpty: { padding: 24, alignItems: "center" },
  pickerEmptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
