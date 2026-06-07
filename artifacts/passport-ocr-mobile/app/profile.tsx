import { Feather } from "@expo/vector-icons";
import { useChangePassword } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  const { user } = useAuth();
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
      Alert.alert(
        "Failed",
        err instanceof Error ? err.message : "Could not update password.",
      );
    }
  }

  const canSave =
    currentPassword.trim().length > 0 &&
    newPassword.length >= 6 &&
    confirmPassword.length > 0 &&
    !changePasswordMutation.isPending;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
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
            <Text style={[styles.screenTitle, { color: colors.foreground }]}>
              Profile
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Avatar card */}
          <View
            style={[
              styles.avatarCard,
              { backgroundColor: colors.card, shadowColor: "#000" },
            ]}
          >
            <View style={[styles.avatarCircle, { backgroundColor: colors.secondary }]}>
              {user?.name ? (
                <Text style={[styles.avatarInitials, { color: colors.foreground }]}>
                  {user.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0] ?? "")
                    .join("")
                    .toUpperCase()}
                </Text>
              ) : (
                <Feather name="user" size={36} color={colors.foreground} />
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                {user?.name ?? "LEO OS User"}
              </Text>
              {user?.email ? (
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>
                  {user.email}
                </Text>
              ) : null}
              <View style={[styles.rolePill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.roleText, { color: colors.mutedForeground }]}>
                  {user?.role ?? "Authenticated"}
                </Text>
              </View>
            </View>
          </View>

          {/* Change password section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Change Password
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Use a strong password of at least 6 characters.
            </Text>
          </View>

          <View style={styles.form}>
            {/* Current password */}
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

            {/* New password */}
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

            {/* Confirm new password */}
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

            {success && (
              <View
                style={[
                  styles.successBox,
                  { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
                ]}
              >
                <Feather name="check-circle" size={16} color="#10B981" />
                <Text style={[styles.successText, { color: "#065F46" }]}>
                  Password updated successfully.
                </Text>
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
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                  Update password
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 0.6 }}>
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
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
          style={[styles.input, { color: colors.foreground }]}
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
  scroll: { padding: 20, gap: 20, paddingBottom: 36 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },

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
  avatarInitials: { fontSize: 24, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 17, fontFamily: "Inter_700Bold" },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  rolePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  section: { gap: 4 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sectionSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  form: { gap: 14 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },

  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
