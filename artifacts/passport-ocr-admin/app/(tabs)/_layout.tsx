import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

/**
 * Tab visibility by role:
 *
 *  Tab        superuser  admin  agent  client  company  employee
 *  Dashboard  ✓          ✓      ✓      ✓       ✓        ✓
 *  Master     ✓          ✓      ✓      ✓       ✓        –
 *  Process    ✓          ✓      ✓      –       –        –
 *  Billing    ✓          ✓      –      ✓       ✓        –
 *  More       ✓          ✓      ✓      ✓       ✓        ✓
 */
const CAN_SEE_MASTER  = new Set(["superuser", "admin", "agent", "client", "company"]);
const CAN_SEE_UPLOAD  = new Set(["superuser", "admin", "agent"]);
const CAN_SEE_BILLING = new Set(["superuser", "admin", "client", "company"]);

export default function TabLayout() {
  const colors = useColors();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";
  const role = user?.role ?? "";

  const dot = (color: string, focused: boolean) =>
    focused ? (
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
          marginTop: 2,
          position: "absolute",
          bottom: -6,
        }}
      />
    ) : null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          color: colors.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 17,
        },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          ...(isWeb ? { height: 72 } : {}),
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          marginTop: -2,
        },
        tabBarItemStyle: { paddingTop: 6, paddingBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Feather name="home" size={22} color={color} />
              {dot(color, focused)}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="master"
        options={{
          title: "Master",
          href: CAN_SEE_MASTER.has(role) ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Feather name="users" size={22} color={color} />
              {dot(color, focused)}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="upload"
        options={{
          title: "Process",
          href: CAN_SEE_UPLOAD.has(role) ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: focused ? colors.primary : colors.secondary,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: focused ? 0.2 : 0,
                shadowRadius: 6,
                elevation: focused ? 4 : 0,
              }}
            >
              <Feather
                name="zap"
                size={22}
                color={focused ? colors.primaryForeground : colors.mutedForeground}
              />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />

      <Tabs.Screen
        name="billing"
        options={{
          title: "Billing",
          href: CAN_SEE_BILLING.has(role) ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Feather name="file-text" size={22} color={color} />
              {dot(color, focused)}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Feather name="grid" size={22} color={color} />
              {dot(color, focused)}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
