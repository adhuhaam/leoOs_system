import { Feather } from "@expo/vector-icons";
import {
  getListFilesQueryKey,
  useGetFilesStatus,
  useListFiles,
  type FileItem,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams, Stack } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

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

export default function FilesIndexScreen() {
  const colors = useColors();
  const { path } = useLocalSearchParams<{ path?: string }>();
  const subPath = typeof path === "string" ? path : "";
  const [search, setSearch] = useState("");

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

      {/* Search */}
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
      ) : (
        <FlatList
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
  searchBar: { padding: 12 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, padding: 0 },
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  empty: { alignItems: "center", padding: 48, gap: 10 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  emptyDetail: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, marginTop: 6 },
});
