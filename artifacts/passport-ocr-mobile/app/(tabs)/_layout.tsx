import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

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
              {focused && (
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
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="master"
        options={{
          title: "Master",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Feather name="users" size={22} color={color} />
              {focused && (
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
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: "Capture",
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
                name="camera"
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
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: "center" }}>
              <Feather name="file-text" size={22} color={color} />
              {focused && (
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
              )}
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
              {focused && (
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
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
