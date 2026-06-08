import { Feather } from "@expo/vector-icons";
import {
  getListBillingDocumentsQueryKey,
  getListClientsQueryKey,
  getListCompaniesQueryKey,
  getListExpensesQueryKey,
  getListPassportsQueryKey,
  getListTasksQueryKey,
  type BillingDocumentSummary,
  type Client,
  type Company,
  type Expense,
  type Passport,
  type Task,
  TaskPriority,
  TaskStatus,
  useCreateTask,
  useDeleteTask,
  useListBillingDocuments,
  useListClients,
  useListCompanies,
  useListExpenses,
  useListPassports,
  useListTasks,
  useUpdateTask,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMVR(n: number): string {
  if (n >= 1_000_000) return `MVR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `MVR ${(n / 1_000).toFixed(1)}K`;
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const ROLE_LABEL: Record<string, string> = {
  superuser: "Superuser",
  admin: "Admin",
  client: "Client",
  company: "Company",
  employee: "Employee",
  agent: "Agent",
};

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  superuser: { bg: "#7C3AED18", text: "#7C3AED" },
  admin:     { bg: "#0F172A18", text: "#0F172A" },
  client:    { bg: "#0EA5E918", text: "#0369A1" },
  company:   { bg: "#10B98118", text: "#047857" },
  employee:  { bg: "#F59E0B18", text: "#B45309" },
  agent:     { bg: "#EC489918", text: "#BE185D" },
};

type StatItem = {
  label: string;
  value: string | number;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  sub?: string;
};

const STATUS_GROUPS = {
  processing: ["processing"],
  active: ["arrived", "employed", "handedover", "approved", "ticket_issued"],
  attention: ["failed", "incomplete", "return_back_from_worksite", "cancelled", "terminated", "lost"],
  completed: ["completed"],
};

const PRIORITY_COLOR = { low: "#10B981", medium: "#F59E0B", high: "#EF4444" };
const DUE_COLOR = { overdue: "#EF4444", today: "#F59E0B", upcoming: "#6366F1" };

type TaskFilter = "all" | "today" | "upcoming" | "done";
type EditDraft = { id: number; title: string; notes: string; priority: string; dueDate: string };

export default function DashboardScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const role = user?.role ?? null;
  const firstName = user?.name?.split(" ")[0] ?? null;
  const isAdmin = role === "superuser" || role === "admin";
  const roleStyle = role ? (ROLE_COLOR[role] ?? { bg: colors.secondary, text: colors.mutedForeground }) : null;

  const canSeeCapture = role === "superuser" || role === "admin" || role === "company";
  const canSeeBilling = role === "superuser" || role === "admin" || role === "client" || role === "company";
  const canSeeMaster  = role !== "employee";

  // ── Passport stats (all roles) ──────────────────────────────────────────
  const { data, isLoading, isFetching, refetch } = useListPassports(undefined, {
    query: { queryKey: getListPassportsQueryKey(), staleTime: 30_000 },
  });
  const passports = (data ?? []) as Passport[];

  // ── Admin / superuser overview data ─────────────────────────────────────
  const { data: companiesData, isLoading: companiesLoading } = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey(), enabled: isAdmin },
  });
  const { data: clientsData, isLoading: clientsLoading } = useListClients(undefined, {
    query: { queryKey: getListClientsQueryKey(), enabled: isAdmin },
  });
  const { data: expensesData, isLoading: expensesLoading } = useListExpenses(undefined, {
    query: { queryKey: getListExpensesQueryKey(), enabled: isAdmin },
  });
  const { data: billingData, isLoading: billingLoading } = useListBillingDocuments(undefined, {
    query: { queryKey: getListBillingDocumentsQueryKey(), enabled: isAdmin },
  });

  const adminOverviewLoading =
    companiesLoading || clientsLoading || expensesLoading || billingLoading;

  // ── Passport status stats ────────────────────────────────────────────────
  const passportStats = useMemo<StatItem[]>(() => {
    let processing = 0, active = 0, attention = 0;
    for (const p of passports) {
      const s = p.status ?? "processing";
      if (STATUS_GROUPS.processing.includes(s)) processing++;
      else if (STATUS_GROUPS.active.includes(s)) active++;
      else if (STATUS_GROUPS.attention.includes(s)) attention++;
    }
    return [
      { label: "Employees", value: passports.length, icon: "users",          color: "#0F172A" },
      { label: "Processing", value: processing,       icon: "clock",          color: "#F59E0B" },
      { label: "Active",     value: active,           icon: "check-circle",   color: "#10B981" },
      { label: "Attention",  value: attention,        icon: "alert-triangle", color: "#EF4444" },
    ];
  }, [passports]);

  // ── Business overview stats (admin/superuser only) ───────────────────────
  const adminStats = useMemo<StatItem[]>(() => {
    if (!isAdmin) return [];

    const companyCount = ((companiesData ?? []) as Company[]).length;
    const clientCount  = ((clientsData  ?? []) as Client[]).length;

    const totalExpenses = ((expensesData ?? []) as Expense[]).reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0,
    );

    const allDocs = (billingData ?? []) as BillingDocumentSummary[];
    const paidDocs = allDocs.filter(
      (d) => d.status === "payment_received" || d.status === "completed",
    );
    const totalRevenue = paidDocs.reduce(
      (sum, d) => sum + (Number(d.subtotal) || 0),
      0,
    );
    const invoiceCount = allDocs.filter((d) => d.kind === "invoice").length;
    const paidCount    = paidDocs.length;

    return [
      {
        label: "Companies",
        value: companyCount,
        icon: "briefcase",
        color: "#6366F1",
      },
      {
        label: "Clients",
        value: clientCount,
        icon: "user",
        color: "#0EA5E9",
      },
      {
        label: "Total Expenses",
        value: fmtMVR(totalExpenses),
        icon: "trending-down",
        color: "#EF4444",
      },
      {
        label: "Revenue",
        value: fmtMVR(totalRevenue),
        icon: "dollar-sign",
        color: "#10B981",
        sub: `${paidCount} paid of ${invoiceCount} invoices`,
      },
    ];
  }, [isAdmin, companiesData, clientsData, expensesData, billingData]);

  // ── Tasks ────────────────────────────────────────────────────────────────
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const { data: tasksRaw } = useListTasks({
    query: { queryKey: getListTasksQueryKey(), staleTime: 15_000 },
  });
  const allTasks = useMemo(() => (tasksRaw ?? []) as Task[], [tasksRaw]);
  const topTasks = useMemo(() => allTasks.filter((t) => !t.parentId), [allTasks]);

  const todayStr = new Date().toISOString().slice(0, 10);

  function classifyTask(t: Task): "overdue" | "today" | "upcoming" | null {
    if (!t.dueDate) return null;
    if (t.dueDate < todayStr) return "overdue";
    if (t.dueDate === todayStr) return "today";
    return "upcoming";
  }

  const taskStats = useMemo(() => {
    const open = topTasks.filter((t) => t.status !== "done").length;
    const dueToday = topTasks.filter((t) => t.status !== "done" && t.dueDate === todayStr).length;
    const overdue = topTasks.filter((t) => t.status !== "done" && t.dueDate != null && t.dueDate < todayStr).length;
    const done = topTasks.filter((t) => t.status === "done").length;
    return { open, dueToday, overdue, done };
  }, [topTasks, todayStr]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === "all") return topTasks.filter((t) => t.status !== "done");
    if (taskFilter === "done") return topTasks.filter((t) => t.status === "done");
    if (taskFilter === "today") return topTasks.filter((t) => t.status !== "done" && t.dueDate === todayStr);
    if (taskFilter === "upcoming") return topTasks.filter((t) => t.status !== "done" && t.dueDate != null && t.dueDate > todayStr);
    return topTasks;
  }, [topTasks, taskFilter, todayStr]);

  const createTask = useCreateTask({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }) },
  });
  const updateTask = useUpdateTask({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }) },
  });
  const deleteTask = useDeleteTask({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }) },
  });

  function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    createTask.mutate({ data: { title } });
    setNewTaskTitle("");
  }

  function toggleTask(t: Task) {
    updateTask.mutate({ id: t.id, data: { status: t.status === "done" ? "todo" : "done" } });
  }

  function handleDeleteTask(t: Task) {
    Alert.alert("Delete task?", `"${t.title}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTask.mutate({ id: t.id }) },
    ]);
  }

  function openEdit(t: Task) {
    setEditDraft({ id: t.id, title: t.title, notes: t.notes ?? "", priority: t.priority, dueDate: t.dueDate ?? "" });
  }

  function saveEdit() {
    if (!editDraft) return;
    updateTask.mutate({
      id: editDraft.id,
      data: {
        title: editDraft.title || undefined,
        notes: editDraft.notes || null,
        priority: editDraft.priority as Task["priority"],
        dueDate: editDraft.dueDate || null,
      },
    });
    setEditDraft(null);
  }

  // ── Recent uploads ───────────────────────────────────────────────────────
  const recent = useMemo(
    () =>
      [...passports]
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 8),
    [passports],
  );

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={() => refetch()}
          tintColor={colors.primary}
        />
      }
    >
      {/* Hero greeting */}
      <View style={styles.hero}>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
          {getGreeting()}{firstName ? `, ${firstName}` : ""}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>LEO ADMIN</Text>
        <View style={styles.heroMeta}>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate()}
          </Text>
          {role && roleStyle && (
            <View style={[styles.rolePill, { backgroundColor: roleStyle.bg }]}>
              <Text style={[styles.roleText, { color: roleStyle.text }]}>
                {ROLE_LABEL[role] ?? role}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Passport stats grid */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Candidate Overview
        </Text>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {passportStats.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </View>
        )}
      </View>

      {/* Business overview — admin / superuser only */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Business Overview
          </Text>
          {adminOverviewLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {adminStats.map((s) => (
                <StatCard key={s.label} stat={s} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Quick Actions
        </Text>
        <View style={styles.actionsRow}>
          {canSeeCapture && (
            <ActionButton
              icon="camera"
              label="Capture"
              onPress={() => router.push("/(tabs)/upload")}
            />
          )}
          {canSeeMaster && (
            <ActionButton
              icon="users"
              label="Employees"
              onPress={() => router.push("/(tabs)/master")}
            />
          )}
          {canSeeBilling && (
            <ActionButton
              icon="file-text"
              label="Billing"
              onPress={() => router.push("/(tabs)/billing")}
            />
          )}
          <ActionButton
            icon="briefcase"
            label="Companies"
            onPress={() => router.push("/companies")}
          />
        </View>
      </View>

      {/* Recent uploads */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Recent Uploads
          </Text>
          {passports.length > 8 && (
            <Pressable onPress={() => router.push("/(tabs)/master")}>
              <Text style={[styles.seeAll, { color: colors.mutedForeground }]}>
                See all
              </Text>
            </Pressable>
          )}
        </View>

        {isLoading ? null : recent.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="inbox" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No uploads yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap Capture to scan your first passport.
            </Text>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recent.map((p) => (
              <RecentRow
                key={p.id}
                passport={p}
                onPress={() => router.push(`/passport/${p.id}`)}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Task Management ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tasks</Text>
          <Text style={[styles.taskCountBadge, { backgroundColor: colors.secondary, color: colors.mutedForeground }]}>
            {taskStats.open} open
          </Text>
        </View>

        {/* Task stat chips */}
        <View style={styles.taskStatRow}>
          {([
            { label: "Open",      value: taskStats.open,     color: "#0F172A" },
            { label: "Due Today", value: taskStats.dueToday, color: "#F59E0B" },
            { label: "Overdue",   value: taskStats.overdue,  color: "#EF4444" },
            { label: "Done",      value: taskStats.done,     color: "#10B981" },
          ] as const).map((s) => (
            <View key={s.label} style={[styles.taskStatChip, { backgroundColor: s.color + "12" }]}>
              <Text style={[styles.taskStatVal, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.taskStatLbl, { color: s.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Filter tabs */}
        <View style={[styles.taskFilterRow, { backgroundColor: colors.secondary, borderRadius: 12 }]}>
          {(["all", "today", "upcoming", "done"] as TaskFilter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setTaskFilter(f)}
              style={[
                styles.taskFilterBtn,
                taskFilter === f && { backgroundColor: colors.card, shadowColor: "#000" },
              ]}
            >
              <Text style={[styles.taskFilterText, { color: taskFilter === f ? colors.foreground : colors.mutedForeground }]}>
                {f === "all" ? "All" : f === "today" ? "Today" : f === "upcoming" ? "Upcoming" : "Done"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Quick-add */}
        <View style={[styles.addTaskRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.addTaskInput, { color: colors.foreground }]}
            placeholder="Add a task…"
            placeholderTextColor={colors.mutedForeground}
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            onSubmitEditing={handleAddTask}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleAddTask}
            disabled={!newTaskTitle.trim()}
            style={({ pressed }) => [
              styles.addTaskBtn,
              { backgroundColor: newTaskTitle.trim() ? colors.primary : colors.secondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="plus" size={18} color={newTaskTitle.trim() ? "#fff" : colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <View style={[styles.taskEmpty, { borderColor: colors.border }]}>
            <Feather name="check-circle" size={24} color={colors.mutedForeground} />
            <Text style={[styles.taskEmptyText, { color: colors.mutedForeground }]}>
              {taskFilter === "done" ? "No completed tasks" : taskFilter === "today" ? "Nothing due today" : taskFilter === "upcoming" ? "Nothing upcoming" : "All caught up!"}
            </Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {filteredTasks.map((t) => {
              const isDone = t.status === "done";
              const cls = classifyTask(t);
              const subtasks = allTasks.filter((s) => s.parentId === t.id);
              const subDone = subtasks.filter((s) => s.status === "done").length;
              return (
                <View key={t.id} style={[styles.taskRow, { backgroundColor: colors.card, shadowColor: "#000" }]}>
                  <Pressable onPress={() => toggleTask(t)} hitSlop={6} style={styles.taskCheckWrap}>
                    <View style={[
                      styles.taskCheck,
                      { borderColor: isDone ? "#10B981" : colors.border },
                      isDone && { backgroundColor: "#10B981" },
                    ]}>
                      {isDone && <Feather name="check" size={11} color="#fff" />}
                    </View>
                  </Pressable>
                  <Pressable style={styles.taskBody} onPress={() => openEdit(t)}>
                    <View style={styles.taskTitleRow}>
                      <Text
                        style={[styles.taskTitle, { color: isDone ? colors.mutedForeground : colors.foreground }, isDone && styles.taskDoneText]}
                        numberOfLines={2}
                      >
                        {t.title}
                      </Text>
                      <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLOR[t.priority as keyof typeof PRIORITY_COLOR] + "20" }]}>
                        <Text style={[styles.priorityText, { color: PRIORITY_COLOR[t.priority as keyof typeof PRIORITY_COLOR] }]}>
                          {t.priority}
                        </Text>
                      </View>
                    </View>
                    {t.notes ? (
                      <Text style={[styles.taskNotes, { color: colors.mutedForeground }]} numberOfLines={1}>{t.notes}</Text>
                    ) : null}
                    <View style={styles.taskMeta}>
                      {cls && !isDone && (
                        <View style={[styles.dueBadge, { backgroundColor: DUE_COLOR[cls] + "18" }]}>
                          <Feather name="calendar" size={10} color={DUE_COLOR[cls]} />
                          <Text style={[styles.dueText, { color: DUE_COLOR[cls] }]}>
                            {cls === "overdue" ? `Overdue · ${t.dueDate}` : cls === "today" ? "Due today" : t.dueDate}
                          </Text>
                        </View>
                      )}
                      {subtasks.length > 0 && (
                        <Text style={[styles.subtaskCount, { color: colors.mutedForeground }]}>
                          {subDone}/{subtasks.length} subtasks
                        </Text>
                      )}
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteTask(t)} hitSlop={8} style={styles.taskDeleteBtn}>
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>

    {/* Edit task modal */}
    <Modal
      visible={editDraft !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setEditDraft(null)}
    >
      {editDraft && (
        <View style={[styles.editModal, { backgroundColor: colors.background }]}>
          <View style={[styles.editHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setEditDraft(null)}>
              <Text style={[styles.editCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.editTitle, { color: colors.foreground }]}>Edit Task</Text>
            <Pressable onPress={saveEdit}>
              <Text style={[styles.editSave, { color: colors.primary }]}>Save</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Title</Text>
            <TextInput
              style={[styles.editInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={editDraft.title}
              onChangeText={(v) => setEditDraft((d) => d ? { ...d, title: v } : d)}
              autoFocus
            />
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <TextInput
              style={[styles.editInput, styles.editMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={editDraft.notes}
              onChangeText={(v) => setEditDraft((d) => d ? { ...d, notes: v } : d)}
              multiline
              numberOfLines={3}
              placeholder="Optional notes…"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {(["low", "medium", "high"] as const).map((p) => {
                const active = editDraft.priority === p;
                const pc = PRIORITY_COLOR[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => setEditDraft((d) => d ? { ...d, priority: p } : d)}
                    style={[
                      styles.priorityPill,
                      { backgroundColor: active ? pc + "20" : colors.secondary, borderColor: active ? pc : "transparent", borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.priorityPillText, { color: active ? pc : colors.mutedForeground }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.editInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={editDraft.dueDate}
              onChangeText={(v) => setEditDraft((d) => d ? { ...d, dueDate: v } : d)}
              placeholder="e.g. 2025-12-31"
              placeholderTextColor={colors.mutedForeground}
            />
          </ScrollView>
        </View>
      )}
    </Modal>
    </>
  );
}

function StatCard({ stat }: { stat: StatItem }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, shadowColor: "#000" },
      ]}
    >
      <View style={[styles.statIconWrap, { backgroundColor: stat.color + "18" }]}>
        <Feather name={stat.icon} size={18} color={stat.color} />
      </View>
      <Text
        style={[styles.statValue, { color: colors.foreground }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {stat.label}
      </Text>
      {stat.sub ? (
        <Text style={[styles.statSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {stat.sub}
        </Text>
      ) : null}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: colors.card,
          opacity: pressed ? 0.75 : 1,
          shadowColor: "#000",
        },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={20} color={colors.foreground} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "completed": return "#10B981";
    case "failed": return "#EF4444";
    case "arrived":
    case "employed":
    case "handedover": return "#3B82F6";
    case "processing": return "#F59E0B";
    case "applied":
    case "approved":
    case "ticket_issued": return "#8B5CF6";
    default: return "#94A3B8";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function RecentRow({
  passport,
  onPress,
}: {
  passport: Passport;
  onPress: () => void;
}) {
  const colors = useColors();
  const status = passport.status ?? "processing";
  const initials = (passport.fullName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0] ?? "")
    .join("")
    .toUpperCase();
  const sc = statusColor(status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentRow,
        {
          backgroundColor: colors.card,
          shadowColor: "#000",
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.recentAvatar, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.recentInitials, { color: colors.foreground }]}>
          {initials}
        </Text>
      </View>
      <View style={styles.recentContent}>
        <Text
          style={[styles.recentName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {passport.fullName || "Unnamed"}
        </Text>
        <Text
          style={[styles.recentNum, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {passport.passportNumber || "No passport #"}
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: sc + "18" }]}>
        <View style={[styles.statusDot, { backgroundColor: sc }]} />
        <Text style={[styles.statusPillText, { color: sc }]}>
          {statusLabel(status)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 32, gap: 28 },

  hero: { gap: 4, paddingTop: 8 },
  greeting: { fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  title: { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    flexWrap: "wrap",
  },
  date: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rolePill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  section: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },

  loadingBox: { height: 120, alignItems: "center", justifyContent: "center" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 18,
    padding: 16,
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  statSub: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: -2 },

  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },

  recentList: { gap: 8 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  recentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  recentInitials: { fontSize: 15, fontFamily: "Inter_700Bold" },
  recentContent: { flex: 1, gap: 2 },
  recentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  recentNum: { fontSize: 12, fontFamily: "Inter_400Regular" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  // ── Task styles ──────────────────────────────────────────────────────────
  taskCountBadge: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
  },
  taskStatRow: { flexDirection: "row", gap: 8 },
  taskStatChip: {
    flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 2,
  },
  taskStatVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  taskStatLbl: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },

  taskFilterRow: {
    flexDirection: "row", padding: 3, gap: 2,
  },
  taskFilterBtn: {
    flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 0,
  },
  taskFilterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  addTaskRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  addTaskInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 6 },
  addTaskBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  taskEmpty: {
    alignItems: "center", justifyContent: "center", gap: 8,
    padding: 28, borderRadius: 16, borderWidth: 1, borderStyle: "dashed",
  },
  taskEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  taskList: { gap: 8 },
  taskRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, borderRadius: 16,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  taskCheckWrap: { paddingTop: 2 },
  taskCheck: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  taskBody: { flex: 1, gap: 4 },
  taskTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  taskTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  taskDoneText: { textDecorationLine: "line-through", opacity: 0.5 },
  taskNotes: { fontSize: 12, fontFamily: "Inter_400Regular" },
  taskMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  dueBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  dueText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  subtaskCount: { fontSize: 10, fontFamily: "Inter_400Regular" },
  taskDeleteBtn: { padding: 4 },

  editModal: { flex: 1 },
  editHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editCancel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  editTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  editSave: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  editBody: { padding: 20, gap: 8, paddingBottom: 40 },
  editLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 },
  editInput: { fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  editMultiline: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityPill: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  priorityPillText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
