import { useEffect } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useRegisterPushToken } from "@workspace/api-client-react";

// Foreground behaviour: still show the banner + play sound when a push lands
// while the user is inside the app, instead of silently dropping it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("passport-updates", {
    name: "Passport updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3C8C78",
  });
}

async function getExpoPushToken(): Promise<string | null> {
  // Push only works on real devices, not simulators / Expo web.
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let granted = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.status;
  }
  if (granted !== "granted") return null;

  await ensureAndroidChannel();

  try {
    // Read the EAS projectId from app config so the token is properly linked
    // to this project in both Expo Go and production builds.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenResponse.data;
  } catch {
    return null;
  }
}

/**
 * Hook used by the root layout: when the user is authenticated, request
 * notification permissions, fetch the device's Expo push token, and register
 * it with the backend (which stores it against the current user's id).
 * On sign-out the caller can pass `enabled: false` to skip registration.
 */
export function usePushRegistration(enabled: boolean) {
  const registerMut = useRegisterPushToken();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const token = await getExpoPushToken();
      if (!token || cancelled) return;
      try {
        await registerMut.mutateAsync({
          data: {
            token,
            platform: (Platform.OS === "ios"
              ? "ios"
              : Platform.OS === "android"
                ? "android"
                : "web") as "ios" | "android" | "web",
          },
        });
      } catch {
        // Soft failure — push is a nice-to-have, never block the app.
      }
    })();

    // We intentionally do NOT unregister on cleanup. The whole point of push
    // is to deliver notifications when the app is closed, so the token must
    // outlive the component lifecycle. Dead tokens are pruned server-side
    // when Expo reports DeviceNotRegistered.
    return () => {
      cancelled = true;
    };
    // We intentionally only react to enabled changes; the mutation ref is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
