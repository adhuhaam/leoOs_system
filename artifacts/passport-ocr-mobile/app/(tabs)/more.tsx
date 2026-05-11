import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLogout } from "@workspace/api-client-react";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

type Item = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  detail?: string;
  route?: string;
};

export default function MoreScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const logoutMutation = useLogout();

  const items: Item[] = [
    { icon: "users", label: "Clients", detail: "Browse client directory", route: "/clients" },
    { icon: "dollar-sign", label: "Expenses", detail: "Track operational spend", route: "/expenses" },
  ];

  function handleLogout() {
    Alert.alert("Sign out?", "You will return to the login screen.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutMutation.mutateAsync();
          } catch {
            // ignore — clear client state regardless
          }
          await qc.clear();
          await refresh();
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>More</Text>

      <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {items.map((item, idx) => (
          <Pressable
            key={item.label}
            onPress={() => item.route && router.push(item.route as never)}
            style={({ pressed }) => [
              styles.row,
              {
                borderTopColor: colors.border,
                borderTopWidth: idx === 0 ? 0 : 1,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name={item.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                {item.label}
              </Text>
              {item.detail && (
                <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>
                  {item.detail}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={handleLogout}
        disabled={logoutMutation.isPending}
        style={({ pressed }) => [
          styles.logoutBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.destructive,
            opacity: logoutMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  heading: { fontSize: 24, fontFamily: "Inter_700Bold" },
  group: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowDetail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  logoutText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
