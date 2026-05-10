import { Feather } from "@expo/vector-icons";
import {
  getListFilesQueryKey,
  useGetFilesStatus,
  useListFiles,
  type FileItem,
} from "@workspace/api-client-react";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams, Stack } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

function bytesToHuman(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function iconFor(item: FileItem): keyof typeof Feather.glyphMap {
  if (item.isFolder) return "folder";
  const mime = item.mimeType ?? "";
  const name = item.name.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(name)) return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "file-text";
  if (mime.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/.test(name)) return "film";
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/.test(name)) return "music";
  return "file";
}

type ViewMode = "list" | "grid";

export default function FilesIndexScreen() {
  const colors = useColors();
  const { path } = useLocalSearchParams<{ path?: string }>();
  const subPath = typeof path === "string" ? path : "";
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");

  const { data: status, isLoading: statusLoading } = useGetFilesStatus();
  const params = subPath ? { path: subPath } : undefined;
  const {
    data,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useListFiles(params, {
    query: {
      enabled: !!status?.connected,
      queryKey: getListFilesQueryKey(params),
      staleTime: 60_000,
    },
  });

  const items = data?.items ?? [];
  const breadcrumbs = data?.breadcrumbs ?? [{ name: "Files", path: "" }];
  const visible = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const headerTitle = breadcrumbs[breadcrumbs.length - 1]?.name || "Files";

  function openItem(item: FileItem) {
    if (item.isFolder) {
      router.push({ pathname: "/files", params: { path: item.path } });
    } else {
      router.push({ pathname: "/files/preview", params: { path: item.path, name: item.name } });
    }
  }

  function showItemActions(item: FileItem) {
    if (item.isFolder) {
      const options = ["Open folder", "Open in OneDrive", "Cancel"];
      runActionSheet(options, 2, (idx) => {
        if (idx === 0) openItem(item);
        else if (idx === 1 && item.webUrl) WebBrowser.openBrowserAsync(item.webUrl);
      });
      return;
    }
    const options = ["Preview", "Download / Share", "Open in OneDrive", "Cancel"];
    runActionSheet(options, 3, (idx) => {
      if (idx === 0) openItem(item);
      else if (idx === 1) router.push({ pathname: "/files/preview", params: { path: item.path, name: item.name, action: "share" } });
      else if (idx === 2 && item.webUrl) WebBrowser.openBrowserAsync(item.webUrl);
    });
  }

  function runActionSheet(options: string[], cancelIndex: number, cb: (idx: number) => void) {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        cb,
      );
    } else {
      Alert.alert(
        "Actions",
        undefined,
        options.map((label, idx) => ({
          text: label,
          onPress: () => cb(idx),
          style: idx === cancelIndex ? "cancel" : "default",
        })),
      );
    }
  }

  const numColumns = view === "grid" ? 3 : 1;
  const tileSize = (Dimensions.get("window").width - 16 * 2 - 12 * 2) / 3;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: headerTitle, headerBackTitle: "Back" }} />

      {/* Breadcrumbs */}
      <View style={[styles.breadcrumbBar, { borderBottomColor: colors.border }]}>
        <FlatList
          data={breadcrumbs}
          horizontal
          keyExtractor={(b, i) => `${b.path}-${i}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.breadcrumbList}
          renderItem={({ item: b, index }) => {
            const last = index === breadcrumbs.length - 1;
            return (
              <View style={styles.breadcrumbItem}>
                <Pressable
                  onPress={() =>
                    !last && router.replace({ pathname: "/files", params: b.path ? { path: b.path } : {} })
                  }
                  disabled={last}
                >
                  <Text
                    style={{
                      color: last ? colors.foreground : colors.primary,
                      fontFamily: last ? "Inter_600SemiBold" : "Inter_500Medium",
                      fontSize: 13,
                    }}
                  >
                    {b.name}
                  </Text>
                </Pressable>
                {!last && (
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.mutedForeground}
                    style={{ marginHorizontal: 6 }}
                  />
                )}
              </View>
            );
          }}
        />
      </View>

      {/* Search + view toggle */}
      <View style={styles.searchBar}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Filter in this folder"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>
        <View style={[styles.segment, { borderColor: colors.border }]}>
          {(["list", "grid"] as ViewMode[]).map((m) => {
            const active = view === m;
            return (
              <Pressable
                key={m}
                onPress={() => setView(m)}
                style={[
                  styles.segmentBtn,
                  { backgroundColor: active ? colors.primary : "transparent" },
                ]}
              >
                <Feather
                  name={m === "list" ? "list" : "grid"}
                  size={15}
                  color={active ? colors.primaryForeground : colors.mutedForeground}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Content */}
      {statusLoading ? (
        <Centered colors={colors}>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : !status?.connected ? (
        <Centered colors={colors}>
          <Feather name="alert-triangle" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>OneDrive not connected</Text>
          <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>
            Ask an administrator to connect OneDrive in the dashboard.
          </Text>
        </Centered>
      ) : isLoading ? (
        <Centered colors={colors}>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      ) : error ? (
        <Centered colors={colors}>
          <Feather name="alert-circle" size={28} color={colors.destructive} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn't load this folder</Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>Retry</Text>
          </Pressable>
        </Centered>
      ) : view === "grid" ? (
        <FlatList
          key="grid"
          data={visible}
          numColumns={numColumns}
          keyExtractor={(i) => i.id}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="folder" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No matches" : "Empty folder"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openItem(item)}
              onLongPress={() => showItemActions(item)}
              delayLongPress={300}
              style={({ pressed }) => [
                styles.tile,
                {
                  width: tileSize,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.tileIcon,
                  {
                    backgroundColor: item.isFolder ? "#fef3c7" : colors.secondary,
                  },
                ]}
              >
                {!item.isFolder && (item.mimeType?.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(item.name)) ? (
                  <ThumbImage path={item.path} />
                ) : (
                  <Feather
                    name={iconFor(item)}
                    size={28}
                    color={item.isFolder ? "#b45309" : colors.primary}
                  />
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[styles.tileName, { color: colors.foreground }]}
              >
                {item.name}
              </Text>
              <Text style={[styles.tileSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.isFolder ? "Folder" : bytesToHuman(item.size)}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          key="list"
          data={visible}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="folder" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No matches" : "Empty folder"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openItem(item)}
              onLongPress={() => showItemActions(item)}
              delayLongPress={300}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: item.isFolder ? "#fef3c7" : colors.secondary,
                  },
                ]}
              >
                <Feather
                  name={iconFor(item)}
                  size={18}
                  color={item.isFolder ? "#b45309" : colors.primary}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.rowTitle, { color: colors.foreground }]}
                >
                  {item.name}
                </Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {item.isFolder ? "Folder" : `${bytesToHuman(item.size)} · ${formatDate(item.lastModifiedAt)}`}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function ThumbImage({ path }: { path: string }) {
  const { Image } = require("expo-image");
  return (
    <Image
      source={{ uri: `${BASE_URL}/api/files/thumbnail?path=${encodeURIComponent(path)}&size=medium` }}
      style={{ width: "100%", height: "100%", borderRadius: 10 }}
      contentFit="cover"
      transition={120}
    />
  );
}

function Centered({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  breadcrumbBar: { borderBottomWidth: 1, paddingVertical: 10 },
  breadcrumbList: { paddingHorizontal: 16, alignItems: "center" },
  breadcrumbItem: { flexDirection: "row", alignItems: "center" },
  searchBar: { padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, padding: 0 },
  segment: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    height: 40,
  },
  segmentBtn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 12, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  rowSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  tile: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 6,
  },
  tileIcon: {
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileName: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 2 },
  tileSub: { fontFamily: "Inter_400Regular", fontSize: 11 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  empty: { alignItems: "center", padding: 48, gap: 10 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  emptyDetail: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, marginTop: 6 },
});
