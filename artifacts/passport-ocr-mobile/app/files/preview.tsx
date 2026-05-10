import { Feather } from "@expo/vector-icons";
import { getGetFileItemQueryKey, useGetFileItem } from "@workspace/api-client-react";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
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

export default function FilePreviewScreen() {
  const colors = useColors();
  const { path, name } = useLocalSearchParams<{ path: string; name?: string }>();
  const subPath = typeof path === "string" ? path : "";
  const filename = typeof name === "string" ? name : subPath.split("/").pop() || "file";
  const [busy, setBusy] = useState(false);

  const { data: detail, isLoading, error } = useGetFileItem(
    { path: subPath },
    {
      query: {
        enabled: !!subPath,
        queryKey: getGetFileItemQueryKey({ path: subPath }),
      },
    },
  );

  async function downloadAndShare() {
    if (!subPath || busy) return;
    setBusy(true);
    try {
      const url = downloadUrl(subPath);
      const target = `${FileSystem.cacheDirectory}${encodeURIComponent(filename)}`;
      const dl = await FileSystem.downloadAsync(url, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: detail?.mimeType ?? undefined,
          dialogTitle: filename,
        });
      } else {
        Alert.alert("Saved", `File saved to ${dl.uri}`);
      }
    } catch (err) {
      Alert.alert("Download failed", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const url = previewUrl(subPath);
  const kind = detail?.previewKind;

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
          <Image
            source={{ uri: url }}
            style={{ flex: 1, width: "100%" }}
            contentFit="contain"
            transition={150}
          />
        ) : kind === "pdf" || kind === "text" ? (
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
});
