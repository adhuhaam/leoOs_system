import { Feather } from "@/components/Icon";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Item = {
  icon: string;
  label: string;
  detail?: string;
  route?: string;
};

const ROLE_LABEL: Record<string, string> = {
  superuser: "Superuser",
  admin: "Admin",
  client: "Client",
  company: "Company",
  employee: "Employee",
  agent: "Agent",
};

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  superuser: { bg: "#7C3AED18", text: "#7C3AED" },
  admin:     { bg: "#0F172A18", text: "#0F172A" },
  client:    { bg: "#0EA5E918", text: "#0369A1" },
  company:   { bg: "#10B98118", text: "#047857" },
  employee:  { bg: "#F59E0B18", text: "#B45309" },
  agent:     { bg: "#EC489918", text: "#BE185D" },
};

const TOOL_ITEMS: Item[] = [
  { icon: "file-text", label: "LOA", detail: "Letters of Appointment", route: "/loa" },
  { icon: "briefcase", label: "Companies", detail: "Manage employer companies", route: "/companies" },
  { icon: "users", label: "Clients", detail: "Browse client directory", route: "/clients" },
  { icon: "dollar-sign", label: "Expenses", detail: "Track operational spend", route: "/expenses" },
  { icon: "key", label: "Passwords", detail: "Shared password vault", route: "/passwords" },
];

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const role = user?.role ?? null;
  const roleStyle = role ? (ROLE_COLOR[role] ?? { bg: colors.secondary, text: colors.mutedForeground }) : null;

  const isAdmin = role === "admin" || role === "superuser";
  const ADMIN_ITEMS: Item[] = isAdmin ? [
    { icon: "users", label: "User Management", detail: "Approve & manage accounts", route: "/admin/users" },
    { icon: "shield", label: "Permissions", detail: "Role-based access control", route: "/admin/permissions" },
    { icon: "settings", label: "System Settings", detail: "System configuration", route: "/admin/system-settings" },
  ] : [];

  async function doLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore errors — auth context clears state regardless
    } finally {
      setLoggingOut(false);
    }
    router.replace("/login");
  }

  function ItemRow({ item, idx }: { item: Item; idx: number }) {
    return (
      <Pressable
        key={item.label}
        onPress={() => item.route && router.push(item.route as never)}
        style={({ pressed }) => [
          styles.row,
          {
            borderTopColor: colors.border,
            borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
          <Feather name={item.icon as never} size={18} color={colors.foreground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>{item.label}</Text>
          {item.detail && (
            <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>{item.detail}</Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <Pressable
        onPress={() => router.push("/profile")}
        style={({ pressed }) => [
          styles.profileCard,
          { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1, shadowColor: "#000" },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Feather name="user" size={22} color={colors.foreground} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {user?.name ?? "My Profile"}
          </Text>
          <Text style={[styles.profileSub, { color: colors.mutedForeground }]}>
            {user?.email ?? "View profile & change password"}
          </Text>
          {role && roleStyle && (
            <View style={[styles.rolePill, { backgroundColor: roleStyle.bg }]}>
              <Text style={[styles.roleText, { color: roleStyle.text }]}>
                {ROLE_LABEL[role] ?? role}
              </Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      {/* Tools group */}
      <View style={styles.groupHeader}>
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>TOOLS</Text>
      </View>
      <View style={[styles.group, { backgroundColor: colors.card, shadowColor: "#000" }]}>
        {TOOL_ITEMS.map((item, idx) => (
          <ItemRow key={item.label} item={item} idx={idx} />
        ))}
      </View>

      {/* Admin group (superuser + admin only) */}
      {ADMIN_ITEMS.length > 0 && (
        <>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>ADMIN</Text>
          </View>
          <View style={[styles.group, { backgroundColor: colors.card, shadowColor: "#000" }]}>
            {ADMIN_ITEMS.map((item, idx) => (
              <ItemRow key={item.label} item={item} idx={idx} />
            ))}
          </View>
        </>
      )}

      {/* Sign out — inline confirm to avoid Alert (blocked in iframe preview) */}
      {confirmLogout ? (
        <View style={[styles.confirmBox, { backgroundColor: colors.card, borderColor: "#FCA5A5", shadowColor: "#000" }]}>
          <Text style={[styles.confirmText, { color: colors.foreground }]}>Sign out of LEO ADMIN?</Text>
          <View style={styles.confirmRow}>
            <Pressable
              onPress={() => setConfirmLogout(false)}
              style={({ pressed }) => [
                styles.confirmCancel,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.confirmCancelText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={doLogout}
              disabled={loggingOut}
              style={({ pressed }) => [
                styles.confirmSignOut,
                { opacity: loggingOut ? 0.5 : pressed ? 0.82 : 1 },
              ]}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmSignOutText}>Sign out</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setConfirmLogout(true)}
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              backgroundColor: colors.card,
              borderColor: "#FCA5A5",
              opacity: pressed ? 0.82 : 1,
              shadowColor: "#000",
            },
          ]}
        >
          <Feather name="log-out" size={17} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign out</Text>
        </Pressable>
      )}

      <Text style={[styles.version, { color: colors.mutedForeground }]}>LEO ADMIN · v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10, paddingBottom: 32 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    marginBottom: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { fontSize: 15, },
  profileSub: { fontSize: 12, },
  rolePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  roleText: { fontSize: 11, },

  groupHeader: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 2 },
  groupLabel: { fontSize: 11, letterSpacing: 0.8 },

  group: {
    borderRadius: 18,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 15, },
  rowDetail: { fontSize: 12, marginTop: 1 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutText: { fontSize: 15, },

  confirmBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
    gap: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  confirmText: { fontSize: 14, textAlign: "center" },
  confirmRow: { flexDirection: "row", gap: 10 },
  confirmCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmCancelText: { fontSize: 14, },
  confirmSignOut: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#EF4444",
  },
  confirmSignOutText: { fontSize: 14, color: "#fff" },

  version: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
  },
});
