import { Feather } from "@/components/Icon";
import {
  getGetAuthStatusQueryKey,
  useChangePassword,
  useListCompanies,
  useUpdateProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();

  // ── Edit Profile state ──────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [designation, setDesignation] = useState(user?.designation ?? "");
  const [companyId, setCompanyId] = useState<number | null>(user?.companyId ?? null);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const updateProfileMutation = useUpdateProfile();
  const { data: companiesData } = useListCompanies();
  const companies = companiesData ?? [];

  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setDesignation(user?.designation ?? "");
    setCompanyId(user?.companyId ?? null);
  }, [user?.name, user?.phone, user?.designation, user?.companyId]);

  async function handleSaveProfile() {
    if (!name.trim()) {
      Alert.alert("Required", "Full name cannot be empty.");
      return;
    }
    try {
      await updateProfileMutation.mutateAsync({
        data: {
          name: name.trim(),
          phone: phone.trim() || null,
          designation: designation.trim() || null,
          companyId: companyId ?? null,
        },
      });
      await qc.invalidateQueries({ queryKey: getGetAuthStatusQueryKey() });
      await refresh();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Could not update profile.");
    }
  }

  const profileDirty =
    (name.trim() !== (user?.name ?? "")) ||
    (phone.trim() !== (user?.phone ?? "")) ||
    (designation.trim() !== (user?.designation ?? "")) ||
    (companyId !== (user?.companyId ?? null));

  const canSaveProfile = name.trim().length > 0 && !updateProfileMutation.isPending;

  // ── Change Password state ────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [success, setSuccess] = useState(false);

  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const changePasswordMutation = useChangePassword();

  async function handleChangePassword() {
    if (!currentPassword.trim()) {
      Alert.alert("Missing field", "Enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Too short", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "New passwords do not match.");
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({
        data: { currentPassword: currentPassword.trim(), newPassword: newPassword },
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password updated", "Your password has been changed successfully.");
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Could not update password.");
    }
  }

  const passwordsMatch = newPassword.length >= 6 && confirmPassword === newPassword;
  const canSave =
    currentPassword.trim().length > 0 && passwordsMatch && !changePasswordMutation.isPending;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.screenTitle, { color: colors.foreground }]}>Profile</Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Avatar card */}
          <View style={[styles.avatarCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.secondary }]}>
              {user?.name ? (
                <Text style={[styles.avatarInitials, { color: colors.foreground }]}>
                  {user.name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase()}
                </Text>
              ) : (
                <Feather name="user" size={36} color={colors.foreground} />
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name ?? "LEO OS User"}</Text>
              {user?.email ? (
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
              ) : null}
              {user?.designation ? (
                <Text style={[styles.userDesig, { color: colors.mutedForeground }]}>{user.designation}</Text>
              ) : null}
              <View style={[styles.rolePill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.roleText, { color: colors.mutedForeground }]}>{user?.role ?? "Authenticated"}</Text>
              </View>
            </View>
          </View>

          {/* ── Edit Profile ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Edit Profile</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Update your personal details.
            </Text>
          </View>

          <View style={styles.form}>
            {/* Full name */}
            <ProfileField label="FULL NAME" icon="user">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="next"
                style={[styles.fieldInput, { color: colors.foreground }]}
              />
            </ProfileField>

            {/* Phone */}
            <ProfileField label="PHONE NUMBER" icon="phone">
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. +960 999 0000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                style={[styles.fieldInput, { color: colors.foreground }]}
              />
            </ProfileField>

            {/* Email — read-only */}
            <ProfileField label="EMAIL ADDRESS" icon="mail">
              <Text
                style={[styles.fieldInput, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {user?.email ?? "—"}
              </Text>
            </ProfileField>

            {/* Company */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, letterSpacing: 0.6 }}>COMPANY (OPTIONAL)</Text>
              <Pressable
                onPress={() => setCompanyPickerOpen(true)}
                style={[
                  styles.fieldRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="briefcase" size={16} color={colors.mutedForeground} />
                <Text
                  style={[styles.fieldInput, { color: selectedCompany ? colors.foreground : colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {selectedCompany ? selectedCompany.name : "Select a company…"}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Designation */}
            <ProfileField label="DESIGNATION" icon="award">
              <TextInput
                value={designation}
                onChangeText={setDesignation}
                placeholder="e.g. Visa Officer"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="done"
                style={[styles.fieldInput, { color: colors.foreground }]}
              />
            </ProfileField>

            {/* Success */}
            {profileSuccess && (
              <View style={[styles.successBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Feather name="check-circle" size={16} color="#10B981" />
                <Text style={[styles.successText, { color: "#065F46" }]}>Profile updated.</Text>
              </View>
            )}

            <Pressable
              onPress={handleSaveProfile}
              disabled={!canSaveProfile || !profileDirty}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: !canSaveProfile || !profileDirty ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}
            >
              {updateProfileMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save profile</Text>
              )}
            </Pressable>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* ── Change Password ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Change Password</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Use a strong password of at least 6 characters.
            </Text>
          </View>

          <View style={styles.form}>
            <PasswordField
              label="CURRENT PASSWORD"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Your current password"
              show={showCurrent}
              onToggleShow={() => setShowCurrent((v) => !v)}
              returnKeyType="next"
              onSubmitEditing={() => newRef.current?.focus()}
            />
            <PasswordField
              ref={newRef}
              label="NEW PASSWORD"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="At least 6 characters"
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <PasswordField
              ref={confirmRef}
              label="CONFIRM NEW PASSWORD"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat new password"
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              returnKeyType="go"
              onSubmitEditing={handleChangePassword}
            />

            {confirmPassword.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4 }}>
                <Feather
                  name={passwordsMatch ? "check-circle" : "x-circle"}
                  size={14}
                  color={passwordsMatch ? "#10B981" : "#EF4444"}
                />
                <Text style={{ fontSize: 12, color: passwordsMatch ? "#10B981" : "#EF4444" }}>
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </Text>
              </View>
            )}

            {success && (
              <View style={[styles.successBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Feather name="check-circle" size={16} color="#10B981" />
                <Text style={[styles.successText, { color: "#065F46" }]}>Password updated successfully.</Text>
              </View>
            )}

            <Pressable
              onPress={handleChangePassword}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: !canSave ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}
            >
              {changePasswordMutation.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Update password</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Company Picker Modal */}
      <Modal
        visible={companyPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCompanyPickerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCompanyPickerOpen(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Company</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* None option */}
              <Pressable
                onPress={() => { setCompanyId(null); setCompanyPickerOpen(false); }}
                style={[
                  styles.modalOption,
                  !companyId && { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
                <Text style={[styles.modalOptionText, { color: colors.mutedForeground }]}>None</Text>
                {!companyId && <Feather name="check" size={16} color={colors.primary} style={{ marginLeft: "auto" }} />}
              </Pressable>

              {companies.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setCompanyId(c.id); setCompanyPickerOpen(false); }}
                  style={[
                    styles.modalOption,
                    companyId === c.id && { backgroundColor: colors.primary + "18" },
                  ]}
                >
                  <Feather name="briefcase" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.modalOptionText, { color: colors.foreground }]} numberOfLines={1}>{c.name}</Text>
                  {companyId === c.id && <Feather name="check" size={16} color={colors.primary} style={{ marginLeft: "auto" }} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── ProfileField ─────────────────────────────────────────────────────────────

function ProfileField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, letterSpacing: 0.6 }}>{label}</Text>
      <View style={[styles.fieldRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name={icon as never} size={16} color={colors.mutedForeground} />
        {children}
      </View>
    </View>
  );
}

// ── PasswordField ─────────────────────────────────────────────────────────────

const PasswordField = React.forwardRef<
  TextInput,
  {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    show: boolean;
    onToggleShow: () => void;
    returnKeyType?: "next" | "go" | "done";
    onSubmitEditing?: () => void;
  }
>(({ label, value, onChange, placeholder, show, onToggleShow, returnKeyType, onSubmitEditing }, ref) => {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, letterSpacing: 0.6 }}>{label}</Text>
      <View style={[styles.fieldRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="lock" size={16} color={colors.mutedForeground} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          style={[styles.fieldInput, { color: colors.foreground }]}
        />
        <Pressable onPress={onToggleShow} hitSlop={8}>
          <Feather name={show ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
});

PasswordField.displayName = "PasswordField";

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 20, paddingBottom: 48 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 17 },

  avatarCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontSize: 24 },
  userName: { fontSize: 17 },
  userEmail: { fontSize: 12 },
  userDesig: { fontSize: 12, fontStyle: "italic" },
  rolePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  roleText: { fontSize: 11 },

  section: { gap: 4 },
  sectionTitle: { fontSize: 17 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },

  form: { gap: 14 },

  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  divider: {
    height: 1,
    marginVertical: 4,
  },

  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  successText: { fontSize: 13 },

  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { fontSize: 16 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 17, textAlign: "center" },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  modalOptionText: { fontSize: 15, flex: 1 },
});
