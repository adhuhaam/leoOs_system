import { Feather } from "@expo/vector-icons";
import { getGetFileItemQueryKey, useGetFileItem } from "@workspace/api-client-react";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { useColors } from "@/hooks/useColors";

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

function bytesToHuman(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function previewUrl(path: string): string {
  return `${BASE_URL}/api/files/preview?path=${encodeURIComponent(path)}`;
}
function downloadUrl(path: string): string {
  return `${BASE_URL}/api/files/download?path=${encodeURIComponent(path)}`;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  // Use chunked encoding to avoid call stack overflow on big files.
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  // global.btoa exists in React Native's runtime.
  return globalThis.btoa(bin);
}

export default function FilePreviewScreen() {
  const colors = useColors();
  const { path, name, action } = useLocalSearchParams<{ path: string; name?: string; action?: string }>();
  const subPath = typeof path === "string" ? path : "";
  const filename = typeof name === "string" ? name : subPath.split("/").pop() || "file";
  const [busy, setBusy] = useState(false);
  const autoShareDone = useRef(false);

  const { data: detail, isLoading, error } = useGetFileItem(
    { path: subPath },
    {
      query: {
        enabled: !!subPath,
        queryKey: getGetFileItemQueryKey({ path: subPath }),
        staleTime: 5 * 60_000,
      },
    },
  );

  async function downloadAndShare() {
    if (!subPath || busy) return;
    setBusy(true);
    try {
      const url = downloadUrl(subPath);
      // Use the standard authenticated fetch (credentials: "include") rather
      // than FileSystem.downloadAsync, because the API requires our session
      // cookie and downloadAsync doesn't carry the JS cookie jar reliably
      // across iOS/Android. We then write the downloaded bytes to the app's
      // document directory and hand the file URI to expo-sharing — on iOS
      // this shows the OS share sheet (Quick Look opens PDFs in the OS
      // viewer); on Android the OS app chooser handles it.
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
      const target = `${dir}${encodeURIComponent(filename)}`;
      await FileSystem.writeAsStringAsync(target, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(target, {
          mimeType: detail?.mimeType ?? undefined,
          dialogTitle: filename,
        });
      } else {
        Alert.alert("Saved", `File saved to ${target}`);
      }
    } catch (err) {
      Alert.alert("Download failed", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function openInOneDrive() {
    if (!detail?.webUrl) return;
    await WebBrowser.openBrowserAsync(detail.webUrl);
  }

  // PDFs: open the inline preview URL in the system browser
  // (SFSafariViewController on iOS, Custom Tabs on Android). These share
  // cookies with the system store, so the requireAuth session cookie set
  // by our login fetch is carried through automatically.
  async function openPdfInOs() {
    await WebBrowser.openBrowserAsync(`${BASE_URL}/api/files/preview?path=${encodeURIComponent(subPath)}`);
  }

  const url = previewUrl(subPath);
  const kind = detail?.previewKind;

  // Honor `action=share` from the long-press menu in the list view.
  useEffect(() => {
    if (action === "share" && !autoShareDone.current && detail) {
      autoShareDone.current = true;
      void downloadAndShare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, detail]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: filename, headerBackTitle: "Files" }} />

      <View style={[styles.viewer, { backgroundColor: "#0a0a0a" }]}>
        {isLoading || !kind ? (
          <ActivityIndicator color={colors.primary} />
        ) : error ? (
          <View style={styles.fallback}>
            <Feather name="alert-circle" size={32} color="#fff" />
            <Text style={styles.fallbackText}>Couldn't load preview</Text>
          </View>
        ) : kind === "image" ? (
          // ScrollView with maximumZoomScale gives a free, native pinch-to-zoom
          // and pan on both iOS and Android (Android via maximumZoomScale + the
          // built-in pinch handling). For more advanced gesture handling we'd
          // pull in react-native-gesture-handler, but this is sufficient for
          // photo previews.
          <ScrollView
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={{ flex: 1 }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom
            pinchGestureEnabled
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: url }}
              style={{ flex: 1, width: "100%" }}
              contentFit="contain"
              transition={150}
            />
          </ScrollView>
        ) : kind === "pdf" ? (
          <View style={styles.fallback}>
            <Feather name="file-text" size={36} color="#fff" />
            <Text style={styles.fallbackText}>PDF document</Text>
            <Text style={styles.fallbackHint}>Open in the system viewer or OneDrive</Text>
            <Pressable
              onPress={openPdfInOs}
              style={({ pressed }) => [
                styles.inlineBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="external-link" size={14} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
                Open PDF
              </Text>
            </Pressable>
          </View>
        ) : kind === "text" ? (
          <WebView
            source={{ uri: url }}
            sharedCookiesEnabled
            style={{ flex: 1, backgroundColor: "#fff" }}
            originWhitelist={["*"]}
          />
        ) : (
          <View style={styles.fallback}>
            <Feather name="file" size={36} color="#fff" />
            <Text style={styles.fallbackText}>No inline preview for this file type</Text>
            <Text style={styles.fallbackHint}>Use Download / Share below</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={[styles.metaPanel, { backgroundColor: colors.card, borderTopColor: colors.border }]}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      >
        <View>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Name</Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]} numberOfLines={2}>
            {filename}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Size</Text>
            <Text style={[styles.metaValue, { color: colors.foreground }]}>
              {bytesToHuman(detail?.size ?? null)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Type</Text>
            <Text
              style={[styles.metaValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
              numberOfLines={1}
            >
              {detail?.mimeType ?? "—"}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={downloadAndShare}
          disabled={busy || !subPath}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.primary,
              opacity: pressed || busy ? 0.85 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather
                name={Platform.OS === "ios" ? "share" : "download"}
                size={16}
                color={colors.primaryForeground}
              />
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
                Download / Share
              </Text>
            </>
          )}
        </Pressable>

        {detail?.webUrl ? (
          <Pressable
            onPress={openInOneDrive}
            style={({ pressed }) => [
              styles.actionBtnSecondary,
              { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="external-link" size={15} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
              Open in OneDrive
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, alignItems: "center", justifyContent: "center" },
  fallback: { alignItems: "center", gap: 8, padding: 32 },
  fallbackText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  fallbackHint: { color: "#bbb", fontFamily: "Inter_400Regular", fontSize: 12 },
  metaPanel: { maxHeight: 240, borderTopWidth: 1 },
  metaLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 16 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  inlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 12,
  },
});
