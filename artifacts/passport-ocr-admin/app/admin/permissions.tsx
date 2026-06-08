import { Feather } from "@expo/vector-icons";
import {
  getListPermissionsQueryKey,
  useListPermissions,
  useUpdatePermissions,
} from "@workspace/api-client-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

const ROLES = ["admin", "company", "client", "employee", "agent"] as const;
type Role = (typeof ROLES)[number];

const MODULES = [
  { id: "masterlist", label: "Master List" },
  { id: "companies", label: "Companies" },
  { id: "clients", label: "Clients" },
  { id: "loa", label: "LOA" },
  { id: "billing", label: "Billing" },
  { id: "expenses", label: "Expenses" },
  { id: "passwords", label: "Passwords" },
  { id: "upload", label: "Upload" },
] as const;
type Module = (typeof MODULES)[number]["id"];

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin", company: "Company", client: "Client", employee: "Employee", agent: "Agent",
};
const ROLE_COLORS: Record<Role, string> = {
  admin: "#0F172A", company: "#047857", client: "#0369A1", employee: "#B45309", agent: "#BE185D",
};

type PermKey = `${Role}:${Module}`;
type PermEntry = { canView: boolean; canEdit: boolean; canDelete: boolean };
type Matrix = Map<PermKey, PermEntry>;

function key(role: Role, module: Module): PermKey { return `${role}:${module}` as PermKey; }

function buildMatrix(perms: { role: string; module: string; canView: boolean; canEdit: boolean; canDelete: boolean }[]): Matrix {
  const m = new Map<PermKey, PermEntry>();
  for (const p of perms) {
    m.set(`${p.role}:${p.module}` as PermKey, {
      canView: p.canView, canEdit: p.canEdit, canDelete: p.canDelete,
    });
  }
  return m;
}

function defaultEntry(): PermEntry { return { canView: false, canEdit: false, canDelete: false }; }

export default function PermissionsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role>("admin");
  const [matrix, setMatrix] = useState<Matrix>(new Map());
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useListPermissions({
    query: { queryKey: getListPermissionsQueryKey() },
  });

  useEffect(() => {
    if (data) {
      const raw = data as { role: string; module: string; canView: boolean; canEdit: boolean; canDelete: boolean }[];
      setMatrix(buildMatrix(raw));
    }
  }, [data]);

  const saveMutation = useUpdatePermissions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPermissionsQueryKey() });
        setDirty(false);
      },
      onError: (err: Error) => Alert.alert("Save failed", err.message),
    },
  });

  function toggle(role: Role, module: Module, field: keyof PermEntry) {
    setMatrix((prev) => {
      const next = new Map(prev);
      const k = key(role, module);
      const entry = { ...(next.get(k) ?? defaultEntry()) };
      entry[field] = !entry[field];
      if (field === "canEdit" && entry.canEdit) entry.canView = true;
      if (field === "canDelete" && entry.canDelete) entry.canView = true;
      if (field === "canView" && !entry.canView) {
        entry.canEdit = false; entry.canDelete = false;
      }
      next.set(k, entry);
      return next;
    });
    setDirty(true);
  }

  function handleSave() {
    const entries: { role: string; module: string; canView: boolean; canEdit: boolean; canDelete: boolean }[] = [];
    for (const role of ROLES) {
      for (const mod of MODULES) {
        const e = matrix.get(key(role, mod.id)) ?? defaultEntry();
        entries.push({ role, module: mod.id, ...e });
      }
    }
    saveMutation.mutate({ data: entries } as never);
  }

  const roleColor = ROLE_COLORS[selectedRole];
  const entry = useMemo(
    () => (mod: Module) => matrix.get(key(selectedRole, mod)) ?? defaultEntry(),
    [selectedRole, matrix],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Role selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.roleTabs, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.roleTabsContent}
      >
        {ROLES.map((r) => {
          const active = r === selectedRole;
          const rc = ROLE_COLORS[r];
          return (
            <Pressable
              key={r}
              onPress={() => setSelectedRole(r)}
              style={[
                styles.roleTab,
                active && { backgroundColor: rc + "18", borderColor: rc, borderWidth: 1 },
                !active && { backgroundColor: colors.secondary },
              ]}
            >
              <Text style={[styles.roleTabText, { color: active ? rc : colors.mutedForeground }]}>
                {ROLE_LABELS[r]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.roleHeader, { backgroundColor: roleColor + "12" }]}>
            <Feather name="shield" size={16} color={roleColor} />
            <Text style={[styles.roleHeaderText, { color: roleColor }]}>
              {ROLE_LABELS[selectedRole]} permissions
            </Text>
          </View>

          {/* Column headers */}
          <View style={[styles.headerRow, { borderColor: colors.border }]}>
            <Text style={[styles.headerModule, { color: colors.mutedForeground }]}>Module</Text>
            <Text style={[styles.headerPerm, { color: colors.mutedForeground }]}>View</Text>
            <Text style={[styles.headerPerm, { color: colors.mutedForeground }]}>Edit</Text>
            <Text style={[styles.headerPerm, { color: colors.mutedForeground }]}>Delete</Text>
          </View>

          <View style={[styles.table, { backgroundColor: colors.card, shadowColor: "#000" }]}>
            {MODULES.map((mod, idx) => {
              const e = entry(mod.id);
              const isLast = idx === MODULES.length - 1;
              return (
                <View
                  key={mod.id}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={[styles.modLabel, { color: colors.foreground }]}>{mod.label}</Text>
                  <Switch
                    value={e.canView}
                    onValueChange={() => toggle(selectedRole, mod.id, "canView")}
                    trackColor={{ true: roleColor }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                  <Switch
                    value={e.canEdit}
                    onValueChange={() => toggle(selectedRole, mod.id, "canEdit")}
                    trackColor={{ true: roleColor }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                  <Switch
                    value={e.canDelete}
                    onValueChange={() => toggle(selectedRole, mod.id, "canDelete")}
                    trackColor={{ true: roleColor }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Save bar */}
      {dirty && (
        <View style={[styles.saveBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.saveHint, { color: colors.mutedForeground }]}>Unsaved changes</Text>
          <Pressable
            onPress={handleSave}
            disabled={saveMutation.isPending}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: colors.primary, opacity: pressed || saveMutation.isPending ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.saveBtnText}>{saveMutation.isPending ? "Saving…" : "Save changes"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  roleTabs: { maxHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  roleTabsContent: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  roleTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  roleTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  container: { padding: 16, gap: 14, paddingBottom: 40 },

  roleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  roleHeaderText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 0,
  },
  headerModule: { flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  headerPerm: { width: 56, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },

  table: {
    borderRadius: 18,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  switch: { width: 56, transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },

  saveBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
