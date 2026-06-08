import { Feather } from "@/components/Icon";
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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
  icon: string;
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
type UploadFilter = "all" | "processing" | "active" | "attention";
type EditDraft = { id: number; title: string; notes: string; priority: string; dueDate: string };

// ── Flip user card (credit-card proportions) ──────────────────────────────────
const CARD_HEIGHT = 210;

function FlipUserCard() {
  const { user } = useAuth();
  const colors = useColors();
  const isBack = useRef(false);
  const flipAnim = useSharedValue(0);

  const initials = (user?.name ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0] ?? "").join("").toUpperCase();

  const roleLabel = user?.role ? (ROLE_LABEL[user.role] ?? user.role) : "—";
  const rStyle = user?.role
    ? (ROLE_COLOR[user.role] ?? { bg: "#FFFFFF18", text: "#FFFFFF99" })
    : { bg: "#FFFFFF18", text: "#FFFFFF99" };

  function toggle() {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    isBack.current = !isBack.current;
    flipAnim.value = withTiming(isBack.current ? 1 : 0, { duration: 500 });
  }

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flipAnim.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: "hidden",
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flipAnim.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: "hidden",
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
  }));

  return (
    <Pressable onPress={toggle} style={styles.cardWrapper}>
      {/* ── Front: credit card ───────────────── */}
      <Animated.View style={[styles.card, frontStyle]}>
        <LinearGradient
          colors={["#0B1A15", "#1A3D33", "#2A6B5A"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.cardOrb, { top: -50, right: -40, width: 170, height: 170, backgroundColor: "#4ADE8010" }]} />
        <View style={[styles.cardOrb, { bottom: -35, left: -25, width: 130, height: 130, backgroundColor: "#2DD4BF0B" }]} />

        {/* contactless symbol */}
        <View style={styles.cardTopRow}>
          <View style={{ transform: [{ rotate: "90deg" }] }}>
            <Feather name="wifi" size={20} color="#FFFFFF25" />
          </View>
        </View>

        {/* logo */}
        <Image
          source={require("../../assets/images/logo-transparent.png")}
          style={styles.cardLogo}
          resizeMode="contain"
          tintColor="#FFFFFF"
        />

        {/* spacer pushes bottom content down */}
        <View style={{ flex: 1 }} />

        {/* bottom area: dots + name */}
        <View style={styles.cardBottom}>
          <View style={styles.cardDotRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.cardDotGroup}>
                {[0, 1, 2, 3].map((j) => <View key={j} style={styles.cardDot} />)}
              </View>
            ))}
            <Text style={styles.cardDotId}>{String(user?.id ?? 0).padStart(4, "0")}</Text>
          </View>

          <View style={styles.cardNameRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHolderLabel}>CARD HOLDER</Text>
              <Text style={styles.cardName} numberOfLines={1}>{(user?.name ?? "—").toUpperCase()}</Text>
            </View>
            <View style={[styles.cardRolePill, { backgroundColor: "#FFFFFF20" }]}>
              <Text style={[styles.cardRoleText, { color: "#FFFFFF" }]}>{roleLabel}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── Back ─────────────────────────────── */}
      <Animated.View style={[styles.card, backStyle]}>
        <LinearGradient
          colors={["#0B1A15", "#1A3D33", "#0B1A15"]}
          start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.cardOrb, { bottom: -20, right: -15, width: 110, height: 110, backgroundColor: "#4ADE8010" }]} />

        {/* magnetic stripe */}
        <View style={[styles.cardMagStripe, { backgroundColor: "#1A3D33" }]} />

        <Text style={styles.cardBackTitle}>Account Details</Text>

        {([
          { icon: "user",         label: "Name",   value: user?.name  ?? "—" },
          { icon: "mail",         label: "Email",  value: user?.email ?? "—" },
          { icon: "shield",       label: "Role",   value: roleLabel },
          { icon: "check-circle", label: "Status", value: "Active" },
        ] as const).map((row) => (
          <View key={row.label} style={styles.cardInfoRow}>
            <Feather name={row.icon} size={11} color="#FFFFFF50" />
            <Text style={styles.cardInfoLabel}>{row.label}</Text>
            <Text style={styles.cardInfoValue} numberOfLines={1}>{row.value}</Text>
          </View>
        ))}

        <View style={styles.cardHintRow}>
          <Feather name="refresh-cw" size={10} color="#FFFFFF35" />
          <Text style={styles.cardHint}>Tap to flip back</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const role = user?.role ?? null;
  const firstName = user?.name?.split(" ")[0] ?? null;
  const isAdmin = role === "superuser" || role === "admin";

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

  // ── Upload filter + sorted candidates ────────────────────────────────────
  const [uploadFilter, setUploadFilter] = useState<UploadFilter>("all");

  const filteredPassports = useMemo(() => {
    const sorted = [...passports].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    if (uploadFilter === "processing") return sorted.filter((p) => STATUS_GROUPS.processing.includes(p.status ?? "processing"));
    if (uploadFilter === "active")     return sorted.filter((p) => STATUS_GROUPS.active.includes(p.status ?? ""));
    if (uploadFilter === "attention")  return sorted.filter((p) => STATUS_GROUPS.attention.includes(p.status ?? ""));
    return sorted;
  }, [passports, uploadFilter]);

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
      {/* ── Greeting ── */}
      <View style={styles.hero}>
        <Text style={[styles.greeting, { color: colors.foreground }]}>
          {getGreeting()}{firstName ? `, ${firstName}` : ""}
        </Text>
        <Text style={[styles.heroDate, { color: colors.mutedForeground }]}>
          {formatDate()}
        </Text>
      </View>

      {/* ── Credit card ── */}
      <FlipUserCard />

      {/* ── Task Management (above stats for quick visibility) ── */}
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

      {/* ── Candidate stat pills (2/row) ── */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : (
        <View style={styles.statPillRow}>
          {passportStats.map((s) => <StatPill key={s.label} stat={s} />)}
        </View>
      )}

      {/* ── Admin stat pills (2/row) ── */}
      {isAdmin && !adminOverviewLoading && adminStats.length > 0 && (
        <View style={styles.statPillRow}>
          {adminStats.map((s) => <StatPill key={s.label} stat={s} />)}
        </View>
      )}

      {/* ── Candidates with status filter tabs ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Candidates</Text>
          {passports.length > 8 && (
            <Pressable onPress={() => router.push("/(tabs)/master")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          )}
        </View>

        {/* Tab bar */}
        <View style={[styles.uploadFilterRow, { backgroundColor: colors.secondary }]}>
          {([
            { key: "all",        label: "All",        count: passports.length,                              color: colors.foreground },
            { key: "processing", label: "Processing",  count: (passportStats[1]?.value ?? 0) as number,     color: "#F59E0B" },
            { key: "active",     label: "Active",      count: (passportStats[2]?.value ?? 0) as number,     color: "#10B981" },
            { key: "attention",  label: "Attention",   count: (passportStats[3]?.value ?? 0) as number,     color: "#EF4444" },
          ] as const).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setUploadFilter(tab.key as UploadFilter)}
              style={[
                styles.uploadFilterBtn,
                uploadFilter === tab.key && { backgroundColor: colors.card, shadowColor: "#000" },
              ]}
            >
              <Text style={[styles.uploadFilterCount, { color: tab.color }]}>{tab.count}</Text>
              <Text style={[styles.uploadFilterLabel, {
                color: uploadFilter === tab.key ? colors.foreground : colors.mutedForeground,
              }]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Filtered list */}
        {isLoading ? null : filteredPassports.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {uploadFilter === "all" ? "No candidates yet" : `No ${uploadFilter} candidates`}
            </Text>
          </View>
        ) : (
          <View style={styles.recentList}>
            {filteredPassports.slice(0, 8).map((p) => (
              <RecentRow key={p.id} passport={p} onPress={() => router.push(`/passport/${p.id}`)} />
            ))}
          </View>
        )}
      </View>

      {/* ── Monthly revenue chart (admin only) ── */}
      {isAdmin && (
        <BillingChart
          docs={(billingData ?? []) as BillingDocumentSummary[]}
          expenses={(expensesData ?? []) as Expense[]}
        />
      )}
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

function StatPill({ stat }: { stat: StatItem }) {
  const colors = useColors();
  return (
    <View style={[styles.statPill, { backgroundColor: colors.card, shadowColor: "#000" }]}>
      <View style={[styles.statPillIcon, { backgroundColor: stat.color + "18" }]}>
        <Feather name={stat.icon} size={14} color={stat.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.statPillValue, { color: colors.foreground }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
        </Text>
        <Text style={[styles.statPillLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
          {stat.label}
        </Text>
      </View>
    </View>
  );
}

type ChartTab = "invoices" | "revenue" | "vs";

function BillingChart({ docs, expenses }: { docs: BillingDocumentSummary[]; expenses: Expense[] }) {
  const colors = useColors();
  const [tab, setTab] = useState<ChartTab>("invoices");

  const months = useMemo(() => {
    const arr: { key: string; label: string; count: number; revenue: number; expense: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en", { month: "short" });
      arr.push({ key, label, count: 0, revenue: 0, expense: 0 });
    }
    for (const doc of docs) {
      const issued = (doc.issueDate ?? "").slice(0, 7);
      const bucket = arr.find((m) => m.key === issued);
      if (!bucket) continue;
      bucket.count += 1;
      if (doc.status === "payment_received" || doc.status === "completed") {
        bucket.revenue += Number(doc.subtotal) || 0;
      }
    }
    for (const exp of expenses) {
      const dated = (exp.expenseDate ?? "").slice(0, 7);
      const bucket = arr.find((m) => m.key === dated);
      if (!bucket) continue;
      bucket.expense += Number(exp.amount) || 0;
    }
    return arr;
  }, [docs, expenses]);

  const BAR_MAX_H = 72;
  const totalCount   = months.reduce((s, m) => s + m.count,   0);
  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expense, 0);
  const netPL = totalRevenue - totalExpenses;

  const values = months.map((m) => (tab === "invoices" ? m.count : m.revenue));
  const vsMax  = Math.max(...months.map((m) => Math.max(m.revenue, m.expense)), 1);
  const maxVal = tab === "vs" ? vsMax : Math.max(...values, 1);

  function fmtVal(v: number) {
    if (tab === "invoices") return v > 0 ? String(v) : "";
    if (v === 0) return "";
    return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v));
  }

  const COLOR_HIGH = "#6366F1";
  const COLOR_MID  = "#818CF8";
  const COLOR_LOW  = "#A5B4FC";

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Monthly Billing</Text>
      </View>

      {/* Row 1: invoices + revenue */}
      <View style={styles.chartSummaryRow}>
        <View style={[styles.chartSummaryPill, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartSummaryVal, { color: "#6366F1" }]}>{totalCount}</Text>
          <Text style={[styles.chartSummaryLbl, { color: colors.mutedForeground }]}>Invoices Created</Text>
        </View>
        <View style={[styles.chartSummaryPill, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartSummaryVal, { color: "#10B981" }]}
            numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtMVR(totalRevenue)}
          </Text>
          <Text style={[styles.chartSummaryLbl, { color: colors.mutedForeground }]}>Payment Received</Text>
        </View>
      </View>

      {/* Row 2: expenses + net P&L */}
      <View style={styles.chartSummaryRow}>
        <View style={[styles.chartSummaryPill, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartSummaryVal, { color: "#EF4444" }]}
            numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtMVR(totalExpenses)}
          </Text>
          <Text style={[styles.chartSummaryLbl, { color: colors.mutedForeground }]}>Total Expenses</Text>
        </View>
        <View style={[styles.chartSummaryPill, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartSummaryVal, { color: netPL >= 0 ? "#10B981" : "#EF4444" }]}
            numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {netPL >= 0 ? "+" : "−"}{fmtMVR(Math.abs(netPL))}
          </Text>
          <Text style={[styles.chartSummaryLbl, { color: colors.mutedForeground }]}>Net Profit</Text>
        </View>
      </View>

      {/* Tab toggle */}
      <View style={[styles.chartTabRow, { backgroundColor: colors.secondary }]}>
        {([
          ["invoices", "Invoices"],
          ["revenue",  "Revenue"],
          ["vs",       "Income vs Exp"],
        ] as [ChartTab, string][]).map(([t, label]) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.chartTab, tab === t && { backgroundColor: colors.card, shadowColor: "#000" }]}
          >
            <Text style={[styles.chartTabText, {
              color: tab === t
                ? t === "vs" ? colors.foreground : "#6366F1"
                : colors.mutedForeground,
            }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Bars */}
      <View style={[styles.chartCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
        {tab === "vs" ? (
          <>
            {/* Legend */}
            <View style={styles.vsLegend}>
              <View style={styles.vsLegendItem}>
                <View style={[styles.vsLegendDot, { backgroundColor: "#10B981" }]} />
                <Text style={[styles.vsLegendText, { color: colors.mutedForeground }]}>Income</Text>
              </View>
              <View style={styles.vsLegendItem}>
                <View style={[styles.vsLegendDot, { backgroundColor: "#EF4444" }]} />
                <Text style={[styles.vsLegendText, { color: colors.mutedForeground }]}>Expense</Text>
              </View>
            </View>
            {/* Grouped bars — two bars per month */}
            <View style={styles.chartBars}>
              {months.map((m) => {
                const incH = m.revenue > 0 ? Math.max(4, (m.revenue / vsMax) * BAR_MAX_H) : 0;
                const expH = m.expense > 0 ? Math.max(4, (m.expense / vsMax) * BAR_MAX_H) : 0;
                return (
                  <View key={m.key} style={styles.chartCol}>
                    <View style={styles.vsBarRow}>
                      <View style={[styles.vsBarTrack, { backgroundColor: colors.secondary }]}>
                        <View style={[styles.vsBar, { height: incH, backgroundColor: "#10B981" }]} />
                      </View>
                      <View style={[styles.vsBarTrack, { backgroundColor: colors.secondary }]}>
                        <View style={[styles.vsBar, { height: expH, backgroundColor: "#EF4444" }]} />
                      </View>
                    </View>
                    <Text style={[styles.chartMonthLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.chartBars}>
            {months.map((m, idx) => {
              const v = values[idx] ?? 0;
              const pct = v / maxVal;
              const barH = Math.max(4, pct * BAR_MAX_H);
              const barColor = pct > 0.6 ? COLOR_HIGH : pct > 0.2 ? COLOR_MID : COLOR_LOW;
              return (
                <View key={m.key} style={styles.chartCol}>
                  <Text style={[styles.chartValLabel, { color: colors.mutedForeground }]}>
                    {fmtVal(v)}
                  </Text>
                  <View style={[styles.chartBarTrack, { backgroundColor: colors.secondary }]}>
                    <View style={[styles.chartBar, { height: barH, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.chartMonthLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
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
  container: { padding: 20, paddingBottom: 32, gap: 24 },

  hero: { gap: 3, paddingTop: 8 },
  greeting: { fontSize: 23, fontWeight: "700", letterSpacing: -0.5 },
  heroDate: { fontSize: 13, marginTop: 1 },

  // ── Credit card ───────────────────────────────────────────────────────────
  cardWrapper: { height: CARD_HEIGHT },
  card: {
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    padding: 20,
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  cardOrb: { position: "absolute", borderRadius: 999 },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  cardLogo: { position: "absolute", width: 140, height: 52, left: 14, top: 16, zIndex: 1 },
  cardBottom: { gap: 6 },
  // card number dots
  cardDotRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardDotGroup: { flexDirection: "row", gap: 3 },
  cardDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#FFFFFF65" },
  cardDotId: { fontSize: 14, fontWeight: "600", color: "#FFFFFF", letterSpacing: 2 },
  // name row
  cardNameRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  cardHolderLabel: { fontSize: 7.5, color: "#FFFFFF45", letterSpacing: 1.5, marginBottom: 2 },
  cardName: { fontSize: 13, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.3 },
  cardRolePill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, flexShrink: 0, backgroundColor: "#FFFFFF20" },
  cardRoleText: { fontSize: 10, fontWeight: "600", color: "#FFFFFF" },
  // back face
  cardMagStripe: { height: 34, backgroundColor: "#00000060", marginHorizontal: -20, marginTop: -6 },
  cardBackTitle: { fontSize: 13, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.2, marginTop: 6 },
  cardInfoRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  cardInfoLabel: { fontSize: 10, color: "#FFFFFF50", width: 50 },
  cardInfoValue: { flex: 1, fontSize: 11, color: "#FFFFFFCC", fontWeight: "500" },
  cardHintRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardHint: { fontSize: 10, color: "#FFFFFF38" },

  // ── Compact stat pills ────────────────────────────────────────────────────
  statPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statPill: {
    width: "47%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 10,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  statPillIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statPillValue: { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  statPillLabel: { fontSize: 10, marginTop: 1 },

  rolePill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  roleText: { fontSize: 11 },

  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17 },
  seeAll: { fontSize: 13 },

  loadingBox: { height: 80, alignItems: "center", justifyContent: "center" },

  // ── Upload filter tabs ────────────────────────────────────────────────────
  uploadFilterRow: { flexDirection: "row", padding: 3, borderRadius: 14, gap: 2 },
  uploadFilterBtn: {
    flex: 1, paddingVertical: 9, paddingHorizontal: 3, alignItems: "center", borderRadius: 11,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 0,
  },
  uploadFilterCount: { fontSize: 18, fontWeight: "700", letterSpacing: -0.5 },
  uploadFilterLabel: { fontSize: 9, marginTop: 2 },

  // ── Billing chart ─────────────────────────────────────────────────────────
  chartSummaryRow: { flexDirection: "row", gap: 10 },
  chartSummaryPill: {
    flex: 1, borderRadius: 14, padding: 14, gap: 2,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  chartSummaryVal: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  chartSummaryLbl: { fontSize: 11 },
  chartTabRow: {
    flexDirection: "row", borderRadius: 12, padding: 3, gap: 2,
  },
  chartTab: {
    flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  chartTabText: { fontSize: 12, fontWeight: "600" },
  chartCard: {
    borderRadius: 18, padding: 16,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 108 },
  chartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  chartValLabel: { fontSize: 9, textAlign: "center" },
  chartBarTrack: { width: "100%", height: 72, borderRadius: 8, justifyContent: "flex-end", overflow: "hidden" },
  chartBar: { width: "100%", borderRadius: 8 },
  chartMonthLabel: { fontSize: 10, textAlign: "center" },

  // ── Income vs Expense grouped bars ───────────────────────────────────────
  vsLegend: { flexDirection: "row", gap: 14, marginBottom: 10 },
  vsLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  vsLegendDot: { width: 8, height: 8, borderRadius: 4 },
  vsLegendText: { fontSize: 11 },
  vsBarRow: {
    flexDirection: "row",
    gap: 2,
    width: "100%",
    height: 72,
    alignItems: "flex-end",
  },
  vsBarTrack: {
    flex: 1,
    height: 72,
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  vsBar: { width: "100%", borderRadius: 6 },

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
  recentInitials: { fontSize: 15, },
  recentContent: { flex: 1, gap: 2 },
  recentName: { fontSize: 14, },
  recentNum: { fontSize: 12, },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusPillText: { fontSize: 10, },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },

  // ── Task styles ──────────────────────────────────────────────────────────
  taskCountBadge: {
    fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
  },
  taskStatRow: { flexDirection: "row", gap: 8 },
  taskStatChip: {
    flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 2,
  },
  taskStatVal: { fontSize: 20, },
  taskStatLbl: { fontSize: 9, textTransform: "uppercase" },

  taskFilterRow: {
    flexDirection: "row", padding: 3, gap: 2,
  },
  taskFilterBtn: {
    flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 0,
  },
  taskFilterText: { fontSize: 12, },

  addTaskRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  addTaskInput: { flex: 1, fontSize: 15, paddingVertical: 6 },
  addTaskBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  taskEmpty: {
    alignItems: "center", justifyContent: "center", gap: 8,
    padding: 28, borderRadius: 16, borderWidth: 1, borderStyle: "dashed",
  },
  taskEmptyText: { fontSize: 13, },

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
  taskTitle: { flex: 1, fontSize: 14, },
  taskDoneText: { textDecorationLine: "line-through", opacity: 0.5 },
  taskNotes: { fontSize: 12, },
  taskMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 10, textTransform: "uppercase" },
  dueBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  dueText: { fontSize: 10, },
  subtaskCount: { fontSize: 10, },
  taskDeleteBtn: { padding: 4 },

  editModal: { flex: 1 },
  editHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editCancel: { fontSize: 15, },
  editTitle: { fontSize: 17, },
  editSave: { fontSize: 15, },
  editBody: { padding: 20, gap: 8, paddingBottom: 40 },
  editLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 },
  editInput: { fontSize: 15, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  editMultiline: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityPill: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  priorityPillText: { fontSize: 13, },
});
