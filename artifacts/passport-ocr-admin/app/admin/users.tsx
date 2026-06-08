import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  useUpdateUser,
  useDeleteUser,
  useCreateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

const ROLES = ["superuser", "admin", "client", "company", "employee", "agent"] as const;
type Role = (typeof ROLES)[number];

const ROLE_COLORS: Record<Role, string> = {
  superuser: "#7C3AED",
  admin: "#2563EB",
  client: "#0891B2",
  company: "#0D9488",
  employee: "#65A30D",
  agent: "#D97706",
};

type AddUserForm = {
  email: string;
  name: string;
  password: string;
  role: Role;
};

const EMPTY_FORM: AddUserForm = {
  email: "",
  name: "",
  password: "",
  role: "agent",
};

export default function AdminUsersScreen() {
  const colors = useColors();
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const { data: users, isLoading, refetch } = useListUsers();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const createMutation = useCreateUser();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddUserForm>(EMPTY_FORM);

  const canManage = me?.role === "superuser" || me?.role === "admin";

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function confirmApprove(id: number, name: string) {
    Alert.alert("Approve account?", `${name} will be able to sign in once approved.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          await updateMutation.mutateAsync({ id, data: { isApproved: true } });
          await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
      },
    ]);
  }

  function confirmRevoke(id: number, name: string) {
    Alert.alert("Revoke access?", `${name} will no longer be able to sign in.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          await updateMutation.mutateAsync({ id, data: { isApproved: false } });
          await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
      },
    ]);
  }

  function confirmDelete(id: number, name: string) {
    if (id === me?.id) {
      Alert.alert("Cannot delete", "You cannot delete your own account.");
      return;
    }
    Alert.alert("Delete account?", `This will permanently delete ${name}'s account.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteMutation.mutateAsync({ id });
          await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
      },
    ]);
  }

  function showRolePicker(id: number, name: string, currentRole: string) {
    if (me?.role !== "superuser" && currentRole === "superuser") {
      Alert.alert("Insufficient permissions", "Only superusers can change the superuser role.");
      return;
    }
    const allowed = me?.role === "superuser" ? ROLES : ROLES.filter((r) => r !== "superuser");
    Alert.alert(`Change role for ${name}`, "Select a new role:", [
      ...allowed.map((r) => ({
        text: `${r === currentRole ? "✓ " : ""}${r}`,
        onPress: async () => {
          if (r === currentRole) return;
          await updateMutation.mutateAsync({ id, data: { role: r } });
          await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleAddUser() {
    if (!addForm.email.trim()) {
      Alert.alert("Required", "Email is required.");
      return;
    }
    if (!addForm.name.trim()) {
      Alert.alert("Required", "Name is required.");
      return;
    }
    if (!addForm.password.trim()) {
      Alert.alert("Required", "Password is required.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          email: addForm.email.trim(),
          name: addForm.name.trim(),
          password: addForm.password,
          role: addForm.role,
          isApproved: true,
        },
      });
      await qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setAddForm(EMPTY_FORM);
      setShowAddModal(false);
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  const roleColor = (r: string) => ROLE_COLORS[r as Role] ?? colors.mutedForeground;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>User Management</Text>
        {canManage ? (
          <Pressable
            onPress={() => setShowAddModal(true)}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name="user-plus" size={22} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {(users ?? []).map((u) => {
            const isSuperuser = u.role === "superuser";
            const canActOnUser = !isSuperuser || me?.role === "superuser";

            return (
              <View
                key={u.id}
                style={[styles.card, { backgroundColor: colors.card, shadowColor: "#000" }]}
              >
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: colors.foreground }]}>{u.name || "—"}</Text>
                    <Text style={[styles.cardEmail, { color: colors.mutedForeground }]}>{u.email}</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor(u.role) + "22" }]}>
                    <Text style={[styles.roleBadgeText, { color: roleColor(u.role) }]}>{u.role}</Text>
                  </View>
                </View>

                {/* Status */}
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: u.isApproved ? "#22C55E" : "#F59E0B" },
                    ]}
                  />
                  <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                    {u.isApproved ? "Approved" : "Pending approval"}
                  </Text>
                </View>

                {/* Actions */}
                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  {/* Role button — read-only label for superusers visible to non-superusers */}
                  {canActOnUser ? (
                    <Pressable
                      onPress={() => showRolePicker(u.id, u.name || u.email, u.role)}
                      style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Feather name="shield" size={14} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>Role</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.actionBtn, { opacity: 0.35 }]}>
                      <Feather name="shield" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Role</Text>
                    </View>
                  )}

                  {/* Approve / Revoke — hidden for superusers unless actor is superuser */}
                  {canActOnUser ? (
                    !u.isApproved ? (
                      <Pressable
                        onPress={() => confirmApprove(u.id, u.name || u.email)}
                        style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Feather name="check" size={14} color="#22C55E" />
                        <Text style={[styles.actionText, { color: "#22C55E" }]}>Approve</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => confirmRevoke(u.id, u.name || u.email)}
                        style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Feather name="x" size={14} color={colors.destructive} />
                        <Text style={[styles.actionText, { color: colors.destructive }]}>Revoke</Text>
                      </Pressable>
                    )
                  ) : (
                    <View style={[styles.actionBtn, { opacity: 0 }]}>
                      <Feather name="lock" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Protected</Text>
                    </View>
                  )}

                  {/* Delete — hidden for superusers unless actor is superuser */}
                  {canActOnUser ? (
                    <Pressable
                      onPress={() => confirmDelete(u.id, u.name || u.email)}
                      style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                      <Text style={[styles.actionText, { color: colors.destructive }]}>Delete</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.actionBtn, { opacity: 0.35 }]}>
                      <Feather name="lock" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Protected</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {!isLoading && (users ?? []).length === 0 && (
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users yet</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Add User Modal ── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowAddModal(false)} hitSlop={10}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add User</Text>
            <Pressable
              onPress={handleAddUser}
              disabled={createMutation.isPending}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: createMutation.isPending ? 0.5 : pressed ? 0.6 : 1 })}
            >
              {createMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {([
              { key: "name" as const, label: "Full name", required: true },
              { key: "email" as const, label: "Email", required: true, keyboard: "email-address" as const },
              { key: "password" as const, label: "Password", required: true, secure: true },
            ] as { key: keyof AddUserForm; label: string; required?: boolean; keyboard?: "email-address"; secure?: boolean }[]).map((f) => (
              <View key={f.key} style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  {f.label.toUpperCase()}
                  {f.required && <Text style={{ color: colors.destructive }}> *</Text>}
                </Text>
                <TextInput
                  value={addForm[f.key] as string}
                  onChangeText={(v) => setAddForm((p) => ({ ...p, [f.key]: v }))}
                  placeholder={f.label}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType={f.keyboard ?? "default"}
                  autoCapitalize={f.keyboard === "email-address" ? "none" : "words"}
                  secureTextEntry={f.secure}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      color: colors.foreground,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
            ))}

            {/* Role picker */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ROLE</Text>
              <View style={styles.roleGrid}>
                {(me?.role === "superuser" ? ROLES : ROLES.filter((r) => r !== "superuser")).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setAddForm((p) => ({ ...p, role: r }))}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor:
                          addForm.role === r
                            ? roleColor(r) + "22"
                            : colors.secondary,
                        borderColor:
                          addForm.role === r ? roleColor(r) : colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        { color: addForm.role === r ? roleColor(r) : colors.mutedForeground },
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12, paddingBottom: 32 },

  card: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cardEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },

  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  actions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 6,
  },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  empty: { alignItems: "center", gap: 12, paddingVertical: 60 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },

  // Modal
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalCancel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  modalSave: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalBody: { padding: 20, gap: 16, paddingBottom: 40 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    height: 48,
  },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roleChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
