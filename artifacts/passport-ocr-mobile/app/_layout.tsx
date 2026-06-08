import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { useColors } from "@/hooks/useColors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/lib/auth";
import { usePushRegistration } from "@/lib/push";

SplashScreen.preventAutoHideAsync();

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthed } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Register this device for push notifications once the user is signed in.
  usePushRegistration(isAuthed);

  useEffect(() => {
    if (isLoading) return;
    const isAuthPage = segments[0] === "login" || segments[0] === "signup";
    if (!isAuthed && !isAuthPage) {
      router.replace("/login");
    } else if (isAuthed && isAuthPage) {
      router.replace("/");
    }
  }, [isLoading, isAuthed, segments, router]);

  return <>{children}</>;
}

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          fontFamily: "Inter_700Bold",
          fontSize: 17,
          color: colors.foreground,
        },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerBackTitleStyle: { fontFamily: "Inter_500Medium" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen
        name="passport/[id]"
        options={{ title: "Passport", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="clients/index"
        options={{ title: "Clients", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="clients/[id]"
        options={{ title: "Client", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="companies/index"
        options={{ title: "Companies", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="companies/[id]"
        options={{ title: "Company", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="billing/[id]"
        options={{ title: "Document", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="expenses"
        options={{ title: "Expenses", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="expense/new"
        options={{ title: "New expense", presentation: "modal" }}
      />
      <Stack.Screen
        name="expense/[id]"
        options={{ title: "Expense", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="passwords"
        options={{ title: "Passwords", headerBackTitle: "Back" }}
      />
      <Stack.Screen
        name="admin/users"
        options={{ title: "User Management", headerBackTitle: "More" }}
      />
      <Stack.Screen
        name="admin/system-settings"
        options={{ title: "System Settings", headerBackTitle: "More" }}
      />
      <Stack.Screen
        name="companies/new"
        options={{ title: "New Company", presentation: "modal" }}
      />
      <Stack.Screen
        name="clients/new"
        options={{ title: "New Client", presentation: "modal" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <AuthGate>
                  <RootLayoutNav />
                </AuthGate>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
