import { useEffect } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
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
  await Notifications.setNotificationChannelAsync("default", {
    name: "Task updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#6366f1",
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
    // Without a projectId Expo will fall back to legacy tokens, which is fine
    // for Expo Go but we still try to read the configured one if present.
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    return tokenResponse.data;
  } catch {
    return null;
  }
}

/**
 * Hook used by the root layout: when the user is authenticated, request
 * notification permissions, fetch the device's Expo push token, and register
 * it with the backend. On sign-out the caller can pass `enabled: false` to
 * unregister.
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
