import { Feather } from "@/components/Icon";
import {
  getListBillingDocumentsQueryKey,
  getListClientsQueryKey,
  getListCompaniesQueryKey,
  getListExpensesQueryKey,
  getListPassportsQueryKey,
  getListSalaryRecordsQueryKey,
  getListTasksQueryKey,
  type BillingDocumentSummary,
  type Client,
  type Company,
  type Expense,
  type Passport,
  type SalaryRecord,
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
  useListSalaryRecords,
  useListTasks,
  useUpdateTask,
} from "@workspace/api-client-react";
import QRCode from "react-native-qrcode-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
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

function fmtDueDateLabel(dueDate: string | null | undefined, todayStr: string): string {
  if (!dueDate) return "";
  const diffDays = Math.round(
    (new Date(dueDate + "T12:00:00").getTime() - new Date(todayStr + "T12:00:00").getTime()) / 86400000
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === 2) return "In 2 days";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 6) return new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
  return new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
const TASK_STATUS_CONFIG = {
  todo:        { label: "To Do",       color: "#94A3B8", icon: "circle"       as const },
  in_progress: { label: "In Progress", color: "#F59E0B", icon: "clock"        as const },
  done:        { label: "Done",        color: "#10B981", icon: "check-circle" as const },
};

type TaskFilter = "all" | "today" | "overdue" | "upcoming" | "done";
type UploadFilter = "all" | "processing" | "active" | "attention";
type EditDraft = { id: number; title: string; notes: string; priority: string; dueDate: string; status: string };

// ── Flip user card (credit-card proportions) ──────────────────────────────────
const CARD_HEIGHT = 210;

const CARD_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function FlipUserCard() {
  const { user } = useAuth();
  const colors = useColors();
  const isBack = useRef(false);
  const flipAnim = useSharedValue(0);

  const { data: companiesData } = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey(), staleTime: 5 * 60_000 },
  });
  const companyName = (companiesData ?? []).find((c) => c.id === user?.companyId)?.name ?? null;

  const isEmployee = user?.role === "employee";
  const { data: employeePassportsRaw } = useListPassports(undefined, {
    query: { queryKey: getListPassportsQueryKey(), enabled: isEmployee && !!user?.linkedEntityId, staleTime: 5 * 60_000 },
  });
  const linkedPassport = isEmployee && user?.linkedEntityId
    ? ((employeePassportsRaw ?? []) as Passport[]).find((p) => p.id === Number(user.linkedEntityId)) ?? null
    : null;

  const initials = (user?.name ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0] ?? "").join("").toUpperCase();

  const roleLabel = user?.role ? (ROLE_LABEL[user.role] ?? user.role) : "—";
  const rStyle = user?.role
    ? (ROLE_COLOR[user.role] ?? { bg: "#FFFFFF18", text: "#FFFFFF99" })
    : { bg: "#FFFFFF18", text: "#FFFFFF99" };

  const qrUrl = CARD_DOMAIN && user?.id
    ? `https://${CARD_DOMAIN}/u/${user.id}`
    : null;

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

        {/* top-right: QR code or contactless symbol */}
        <View style={styles.cardTopRow}>
          {qrUrl ? (
            <View style={styles.cardQrWrap}>
              <QRCode
                value={qrUrl}
                size={52}
                color="#FFFFFF"
                backgroundColor="transparent"
              />
            </View>
          ) : (
            <View style={{ transform: [{ rotate: "90deg" }] }}>
              <Feather name="wifi" size={20} color="#FFFFFF25" />
            </View>
          )}
        </View>

        {/* user name + designation + company (absolute, left side) */}
        <View style={styles.cardNameDisplay}>
          <Text style={styles.cardDisplayName} numberOfLines={1}>
            {(user?.name ?? "").toUpperCase()}
          </Text>
          {(user?.designation || companyName) ? (
            <View style={{ marginTop: 4, gap: 1 }}>
              {user?.designation ? (
                <Text style={styles.cardSubText} numberOfLines={1}>{user.designation}</Text>
              ) : null}
              {companyName ? (
                <Text style={styles.cardSubText} numberOfLines={1}>{companyName}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* spacer pushes bottom content down */}
        <View style={{ flex: 1 }} />

        {/* bottom area: dots + name */}
        <View style={styles.cardBottom}>
          {/* phone row (yellow area) */}
          <View style={styles.cardDotRow}>
            <Feather name="phone" size={10} color="#FFFFFF45" />
            <Text style={styles.cardPhoneText} numberOfLines={1}>
              {user?.phone ? user.phone : "—"}
            </Text>
          </View>

          {/* email + role pill row (blue area) */}
          <View style={styles.cardNameRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHolderLabel}>EMAIL</Text>
              <Text style={styles.cardName} numberOfLines={1}>{user?.email ?? "—"}</Text>
            </View>
            <View style={[styles.cardRolePill, { backgroundColor: "#FFFFFF15" }]}>
              <Text style={[styles.cardRoleText, { color: "#FFFFFF99" }]}>{roleLabel}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── Back: contact card ───────────────── */}
      <Animated.View style={[styles.card, backStyle]}>
        <LinearGradient
          colors={["#0B1A15", "#1A3D33", "#0B1A15"]}
          start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.cardOrb, { top: -40, left: -30, width: 140, height: 140, backgroundColor: "#4ADE8008" }]} />
        <View style={[styles.cardOrb, { bottom: -20, right: -15, width: 110, height: 110, backgroundColor: "#2DD4BF0A" }]} />

        {/* top: avatar circle + name */}
        <View style={styles.cardBackHeader}>
          <View style={styles.cardBackAvatar}>
            <Text style={styles.cardBackInitials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardBackName} numberOfLines={1}>{(user?.name ?? "—").toUpperCase()}</Text>
            {user?.designation ? (
              <Text style={styles.cardBackDesig} numberOfLines={1}>{user.designation}</Text>
            ) : null}
          </View>
          <View style={[styles.cardRolePill, { backgroundColor: rStyle.bg }]}>
            <Text style={[styles.cardRoleText, { color: rStyle.text }]}>{roleLabel}</Text>
          </View>
        </View>

        {/* contact rows */}
        <View style={styles.cardContactRows}>
          {user?.phone ? (
            <View style={styles.cardContactRow}>
              <Feather name="phone" size={11} color="#4ADE80" />
              <Text style={styles.cardContactLabel}>Phone</Text>
              <Text style={styles.cardContactValue} numberOfLines={1}>{user.phone}</Text>
            </View>
          ) : (
            <View style={styles.cardContactRow}>
              <Feather name="phone" size={11} color="#FFFFFF30" />
              <Text style={styles.cardContactLabel}>Phone</Text>
              <Text style={[styles.cardContactValue, { color: "#FFFFFF35" }]}>Not set — edit profile</Text>
            </View>
          )}
          <View style={styles.cardContactRow}>
            <Feather name="mail" size={11} color="#FFFFFF50" />
            <Text style={styles.cardContactLabel}>Email</Text>
            <Text style={styles.cardContactValue} numberOfLines={1}>{user?.email ?? "—"}</Text>
          </View>
          {linkedPassport && (
            <>
              <View style={[styles.cardContactRow, { borderTopWidth: 1, borderTopColor: "#FFFFFF12", marginTop: 4, paddingTop: 8 }]}>
                <Feather name="user" size={11} color="#4ADE80" />
                <Text style={styles.cardContactLabel}>Passport Name</Text>
                <Text style={styles.cardContactValue} numberOfLines={1}>{linkedPassport.fullName ?? "—"}</Text>
              </View>
              <View style={styles.cardContactRow}>
                <Feather name="book-open" size={11} color="#FFFFFF50" />
                <Text style={styles.cardContactLabel}>Passport No.</Text>
                <Text style={styles.cardContactValue} numberOfLines={1}>{linkedPassport.passportNumber ?? "—"}</Text>
              </View>
              {linkedPassport.nationality ? (
                <View style={styles.cardContactRow}>
                  <Feather name="globe" size={11} color="#FFFFFF50" />
                  <Text style={styles.cardContactLabel}>Nationality</Text>
                  <Text style={styles.cardContactValue} numberOfLines={1}>{linkedPassport.nationality}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

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
  const insets = useSafeAreaInsets();

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
  const { data: salaryData } = useListSalaryRecords(undefined, {
    query: { queryKey: getListSalaryRecordsQueryKey(), enabled: isAdmin, staleTime: 30_000 },
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
      (d) => d.status === "payment_received",
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
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [showCalInModal, setShowCalInModal] = useState(false);

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
    if (taskFilter === "done") return topTasks.filter((t) => t.status === "done");
    if (taskFilter === "today") return topTasks.filter((t) => t.status !== "done" && t.dueDate === todayStr);
    if (taskFilter === "overdue") return topTasks.filter((t) => t.status !== "done" && t.dueDate != null && t.dueDate < todayStr);
    if (taskFilter === "upcoming") return topTasks.filter((t) => t.status !== "done" && t.dueDate != null && t.dueDate > todayStr);
    const open = topTasks.filter((t) => t.status !== "done");
    return [...open].sort((a, b) => {
      const aOv = a.dueDate && a.dueDate < todayStr ? 0 : 1;
      const bOv = b.dueDate && b.dueDate < todayStr ? 0 : 1;
      return aOv - bOv;
    });
  }, [topTasks, taskFilter, todayStr]);

  const filterCounts = useMemo(() => ({
    all:      topTasks.filter((t) => t.status !== "done").length,
    today:    topTasks.filter((t) => t.status !== "done" && t.dueDate === todayStr).length,
    overdue:  topTasks.filter((t) => t.status !== "done" && t.dueDate != null && t.dueDate < todayStr).length,
    upcoming: topTasks.filter((t) => t.status !== "done" && t.dueDate != null && t.dueDate > todayStr).length,
    done:     topTasks.filter((t) => t.status === "done").length,
  }), [topTasks, todayStr]);

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
    createTask.mutate({ data: { title, priority: newTaskPriority, dueDate: newTaskDueDate || null } });
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setNewTaskPriority("medium");
  }

  function cycleTaskStatus(t: Task) {
    const next: Task["status"] = t.status === "todo" ? "in_progress" : t.status === "in_progress" ? "done" : "todo";
    void Haptics.impactAsync(next === "done" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    updateTask.mutate({ id: t.id, data: { status: next } });
  }

  function cyclePriority(t: Task) {
    const next: Task["priority"] = t.priority === "low" ? "medium" : t.priority === "medium" ? "high" : "low";
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTask.mutate({ id: t.id, data: { priority: next } });
  }

  function clearDoneTasks() {
    const doneTasks = topTasks.filter((t) => t.status === "done");
    if (!doneTasks.length) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Clear completed?", `Remove ${doneTasks.length} completed task${doneTasks.length === 1 ? "" : "s"} permanently.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Clear all", style: "destructive", onPress: () => doneTasks.forEach((t) => deleteTask.mutate({ id: t.id })) },
    ]);
  }

  function handleDeleteTask(t: Task) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete task?", `"${t.title}" will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTask.mutate({ id: t.id }) },
    ]);
  }

  function openEdit(t: Task) {
    setShowCalInModal(false);
    setEditDraft({ id: t.id, title: t.title, notes: t.notes ?? "", priority: t.priority, dueDate: t.dueDate ?? "", status: t.status });
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
        status: editDraft.status as Task["status"],
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
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}
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
      {role !== "employee" && <View style={[styles.dashCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tasks</Text>
          <Text style={[styles.taskCountBadge, { backgroundColor: colors.secondary, color: colors.mutedForeground }]}>
            {taskStats.open} open
          </Text>
        </View>

        {/* Task stat chips — tap to filter */}
        <View style={styles.taskStatRow}>
          {([
            { label: "Open",      value: taskStats.open,     color: "#0F172A", filter: "all"     as TaskFilter },
            { label: "Due Today", value: taskStats.dueToday, color: "#F59E0B", filter: "today"   as TaskFilter },
            { label: "Overdue",   value: taskStats.overdue,  color: "#EF4444", filter: "overdue" as TaskFilter },
            { label: "Done",      value: taskStats.done,     color: "#10B981", filter: "done"    as TaskFilter },
          ]).map((s) => {
            const active = taskFilter === s.filter;
            return (
              <Pressable
                key={s.label}
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTaskFilter(active ? "all" : s.filter); }}
                style={({ pressed }) => [
                  styles.taskStatChip,
                  { backgroundColor: s.color + (active ? "20" : "12"), opacity: pressed ? 0.8 : 1 },
                  active && { borderWidth: 1.5, borderColor: s.color },
                ]}
              >
                <Text style={[styles.taskStatVal, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.taskStatLbl, { color: s.color }]}>{s.label}</Text>
                {active && <View style={[styles.statChipActiveDot, { backgroundColor: s.color }]} />}
              </Pressable>
            );
          })}
        </View>

        {/* Filter tabs with counts */}
        <View style={[styles.taskFilterRow, { backgroundColor: colors.secondary, borderRadius: 12 }]}>
          {([
            { key: "all",      label: "All",      count: filterCounts.all,      accent: colors.foreground },
            { key: "today",    label: "Today",    count: filterCounts.today,    accent: "#F59E0B" },
            { key: "overdue",  label: "Overdue",  count: filterCounts.overdue,  accent: "#EF4444" },
            { key: "upcoming", label: "Upcoming", count: filterCounts.upcoming, accent: "#6366F1" },
            { key: "done",     label: "Done",     count: filterCounts.done,     accent: "#10B981" },
          ] as const).map((f) => {
            const active = taskFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTaskFilter(f.key); }}
                style={[styles.taskFilterBtn, active && { backgroundColor: colors.card, shadowColor: "#000" }]}
              >
                <Text style={[styles.taskFilterText, { color: active ? colors.foreground : colors.mutedForeground, fontWeight: active ? "700" : "400" }]}>
                  {f.label}
                </Text>
                {f.count > 0 && (
                  <View style={[styles.filterCountBadge, { backgroundColor: active ? f.accent + "20" : colors.muted }]}>
                    <Text style={[styles.filterCountText, { color: active ? f.accent : colors.mutedForeground }]}>{f.count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Quick-add */}
        <View style={{ gap: 8 }}>
          <View style={[styles.addTaskRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
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
          {newTaskTitle.trim() ? (
            <View style={styles.quickAddOptions}>
              <View style={styles.quickPriorityRow}>
                {(["low", "medium", "high"] as const).map((p) => {
                  const active = newTaskPriority === p;
                  const pc = PRIORITY_COLOR[p];
                  return (
                    <Pressable
                      key={p}
                      onPress={() => { setNewTaskPriority(p); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={[styles.quickPriorityBtn, { backgroundColor: active ? pc + "20" : colors.secondary, borderWidth: 1, borderColor: active ? pc : "transparent" }]}
                    >
                      <View style={[styles.quickPriorityDot, { backgroundColor: pc }]} />
                      <Text style={[styles.quickPriorityText, { color: active ? pc : colors.mutedForeground }]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.quickDateRow}>
                {([
                  { label: "No date", value: "" },
                  { label: "Today", value: todayStr },
                  { label: "Tomorrow", value: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
                  { label: "Next week", value: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) },
                ] as const).map((opt) => {
                  const active = newTaskDueDate === opt.value;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => { setNewTaskDueDate(opt.value); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={[styles.quickDateBtn, { backgroundColor: active ? colors.primary + "15" : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : "transparent" }]}
                    >
                      <Text style={[styles.quickDateText, { color: active ? colors.primary : colors.mutedForeground }]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <View style={[styles.taskEmpty, { borderColor: colors.border }]}>
            <Feather name="check-circle" size={24} color={colors.mutedForeground} />
            <Text style={[styles.taskEmptyText, { color: colors.mutedForeground }]}>
              {taskFilter === "done" ? "No completed tasks" : taskFilter === "today" ? "Nothing due today" : taskFilter === "overdue" ? "No overdue tasks 🎉" : taskFilter === "upcoming" ? "Nothing upcoming" : "All caught up!"}
            </Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {filteredTasks.map((t) => {
              const isDone = t.status === "done";
              const isInProgress = t.status === "in_progress";
              const cls = classifyTask(t);
              const subtasks = allTasks.filter((s) => s.parentId === t.id);
              const subDone = subtasks.filter((s) => s.status === "done").length;
              const pc = PRIORITY_COLOR[t.priority as keyof typeof PRIORITY_COLOR] ?? "#94A3B8";
              return (
                <Pressable
                  key={t.id}
                  onLongPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Alert.alert(t.title, t.notes ?? (t.dueDate ? `Due: ${fmtDueDateLabel(t.dueDate, todayStr)}` : ""), [
                      { text: "Edit Task", onPress: () => openEdit(t) },
                      {
                        text: isInProgress ? "Mark To Do" : "Mark In Progress",
                        onPress: () => updateTask.mutate({ id: t.id, data: { status: isInProgress ? "todo" : "in_progress" } }),
                      },
                      ...(!t.dueDate ? [{ text: "Due Today", onPress: () => updateTask.mutate({ id: t.id, data: { dueDate: todayStr } }) }] : []),
                      ...(!t.dueDate ? [{ text: "Due Tomorrow", onPress: () => updateTask.mutate({ id: t.id, data: { dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) } }) }] : []),
                      { text: "Delete", style: "destructive" as const, onPress: () => handleDeleteTask(t) },
                      { text: "Cancel", style: "cancel" as const },
                    ]);
                  }}
                  style={({ pressed }) => [
                    styles.taskRow,
                    { backgroundColor: colors.secondary, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.986 : 1 }] },
                    isInProgress && { borderLeftWidth: 3, borderLeftColor: "#F59E0B" },
                  ]}
                >
                  <Pressable onPress={() => cycleTaskStatus(t)} hitSlop={10} style={styles.taskCheckWrap}>
                    {isInProgress && !isDone ? (
                      <View style={[styles.taskCheck, { borderColor: "#F59E0B", backgroundColor: "#F59E0B15" }]}>
                        <Feather name="clock" size={10} color="#F59E0B" />
                      </View>
                    ) : (
                      <View style={[styles.taskCheck, { borderColor: isDone ? "#10B981" : colors.border }, isDone && { backgroundColor: "#10B981" }]}>
                        {isDone && <Feather name="check" size={11} color="#fff" />}
                      </View>
                    )}
                  </Pressable>
                  <Pressable style={styles.taskBody} onPress={() => openEdit(t)}>
                    <View style={styles.taskTitleRow}>
                      <Text style={[styles.taskTitle, { color: isDone ? colors.mutedForeground : colors.foreground }, isDone && styles.taskDoneText]} numberOfLines={2}>
                        {t.title}
                      </Text>
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); cyclePriority(t); }}
                        hitSlop={8}
                        style={[styles.priorityBadge, { backgroundColor: pc + "20" }]}
                      >
                        <View style={[styles.priorityDot, { backgroundColor: pc }]} />
                        <Text style={[styles.priorityText, { color: pc }]}>{t.priority.toUpperCase()}</Text>
                      </Pressable>
                    </View>
                    {t.notes ? (
                      <Text style={[styles.taskNotes, { color: colors.mutedForeground }]} numberOfLines={1}>{t.notes}</Text>
                    ) : null}
                    <View style={styles.taskMeta}>
                      {cls && !isDone && (
                        <View style={[styles.dueBadge, { backgroundColor: DUE_COLOR[cls] + "18" }]}>
                          <Feather name="calendar" size={10} color={DUE_COLOR[cls]} />
                          <Text style={[styles.dueText, { color: DUE_COLOR[cls] }]}>{fmtDueDateLabel(t.dueDate, todayStr)}</Text>
                        </View>
                      )}
                      {isInProgress && !isDone && (
                        <View style={[styles.dueBadge, { backgroundColor: "#F59E0B18" }]}>
                          <Feather name="zap" size={10} color="#F59E0B" />
                          <Text style={[styles.dueText, { color: "#F59E0B" }]}>In Progress</Text>
                        </View>
                      )}
                      {subtasks.length > 0 && (
                        <View style={styles.subtaskMeta}>
                          <Text style={[styles.subtaskCount, { color: colors.mutedForeground }]}>{subDone}/{subtasks.length}</Text>
                          <View style={[styles.subtaskTrack, { backgroundColor: colors.border }]}>
                            <View style={[styles.subtaskFill, { backgroundColor: "#10B981", width: `${Math.round(subDone / subtasks.length * 100)}%` as any }]} />
                          </View>
                        </View>
                      )}
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteTask(t)} hitSlop={10} style={styles.taskDeleteBtn}>
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Clear done bulk action */}
        {taskFilter === "done" && filterCounts.done > 0 && (
          <Pressable
            onPress={clearDoneTasks}
            style={({ pressed }) => [styles.clearDoneBtn, { backgroundColor: "#EF444415", opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name="trash-2" size={13} color="#EF4444" />
            <Text style={[styles.clearDoneBtnText, { color: "#EF4444" }]}>
              Clear {filterCounts.done} completed task{filterCounts.done === 1 ? "" : "s"}
            </Text>
          </Pressable>
        )}
      </View>
      </View>}

      {/* ── Overview stats card ── */}
      {role !== "employee" && <View style={[styles.dashCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Overview</Text>
          </View>
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : (
            <View style={styles.statPillRow}>
              {passportStats.map((s) => <StatPill key={s.label} stat={s} />)}
            </View>
          )}
          {isAdmin && !adminOverviewLoading && adminStats.length > 0 && (
            <View style={styles.statPillRow}>
              {adminStats.map((s) => <StatPill key={s.label} stat={s} />)}
            </View>
          )}
        </View>
      </View>}

      {/* ── Candidates with status filter tabs ── */}
      {role !== "employee" && <View style={[styles.dashCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
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
          <View style={[styles.emptyCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
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
      </View>}

      {/* ── Monthly revenue chart (admin only) ── */}
      {isAdmin && (
        <View style={[styles.dashCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <BillingChart
            docs={(billingData ?? []) as BillingDocumentSummary[]}
            expenses={(expensesData ?? []) as Expense[]}
            salaries={(salaryData ?? []) as SalaryRecord[]}
            passports={passports}
          />
        </View>
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
        <KeyboardAvoidingView
          style={[styles.editModal, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.editHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setEditDraft(null)}>
              <Text style={[styles.editCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.editTitle, { color: colors.foreground }]}>Edit Task</Text>
            <Pressable onPress={saveEdit}>
              <Text style={[styles.editSave, { color: colors.primary }]}>Save</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.editBody}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Title</Text>
            <TextInput
              style={[styles.editInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={editDraft.title}
              onChangeText={(v) => setEditDraft((d) => d ? { ...d, title: v } : d)}
              onFocus={() => setShowCalInModal(false)}
              autoFocus
            />
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <TextInput
              style={[styles.editInput, styles.editMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={editDraft.notes}
              onChangeText={(v) => setEditDraft((d) => d ? { ...d, notes: v } : d)}
              onFocus={() => setShowCalInModal(false)}
              multiline
              numberOfLines={3}
              placeholder="Optional notes…"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Status</Text>
            <View style={styles.statusRow}>
              {(["todo", "in_progress", "done"] as const).map((s) => {
                const cfg = TASK_STATUS_CONFIG[s];
                const active = editDraft.status === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => { setEditDraft((d) => d ? { ...d, status: s } : d); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={[styles.statusPillBtn, { backgroundColor: active ? cfg.color + "20" : colors.secondary, borderColor: active ? cfg.color : "transparent", borderWidth: 1 }]}
                  >
                    <Feather name={cfg.icon} size={13} color={active ? cfg.color : colors.mutedForeground} />
                    <Text style={[styles.statusPillBtnText, { color: active ? cfg.color : colors.mutedForeground }]}>{cfg.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {(["low", "medium", "high"] as const).map((p) => {
                const active = editDraft.priority === p;
                const pc = PRIORITY_COLOR[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => { setEditDraft((d) => d ? { ...d, priority: p } : d); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={[styles.priorityPill, { backgroundColor: active ? pc + "20" : colors.secondary, borderColor: active ? pc : "transparent", borderWidth: 1 }]}
                  >
                    <View style={[styles.quickPriorityDot, { backgroundColor: pc }]} />
                    <Text style={[styles.priorityPillText, { color: active ? pc : colors.mutedForeground }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Due Date</Text>
            <Pressable
              onPress={() => { setShowCalInModal((v) => !v); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.datePickerBtn, { backgroundColor: colors.card, borderColor: editDraft.dueDate ? colors.primary : colors.border }]}
            >
              <Feather name="calendar" size={16} color={editDraft.dueDate ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.datePickerBtnText, { color: editDraft.dueDate ? colors.foreground : colors.mutedForeground }]}>
                {editDraft.dueDate ? fmtDueDateLabel(editDraft.dueDate, todayStr) + " · " + editDraft.dueDate : "Pick a date"}
              </Text>
              {editDraft.dueDate ? (
                <Pressable onPress={(e) => { e.stopPropagation(); setEditDraft((d) => d ? { ...d, dueDate: "" } : d); setShowCalInModal(false); }} hitSlop={8}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              ) : (
                <Feather name={showCalInModal ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
              )}
            </Pressable>
            {showCalInModal && (
              <CalendarPicker
                value={editDraft.dueDate}
                onChange={(d) => { setEditDraft((dr) => dr ? { ...dr, dueDate: d } : dr); if (d) setShowCalInModal(false); }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Modal>
    </>
  );
}

function CalendarPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const colors = useColors();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const sel = value ? new Date(value + "T12:00:00") : null;
  const [viewYear, setViewYear] = useState(sel?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(sel?.getMonth() ?? today.getMonth());

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function toStr(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <View style={[styles.calWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.calHeader}>
        <Pressable onPress={prevMonth} hitSlop={14} style={styles.calNavBtn}>
          <Feather name="chevron-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.calMonthLabel, { color: colors.foreground }]}>{MONTHS[viewMonth]} {viewYear}</Text>
        <Pressable onPress={nextMonth} hitSlop={14} style={styles.calNavBtn}>
          <Feather name="chevron-right" size={18} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.calDowRow}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <Text key={d} style={[styles.calDow, { color: colors.mutedForeground }]}>{d}</Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.calCell} />;
          const ds = toStr(day);
          const isToday = ds === todayStr;
          const isSelected = ds === value;
          const isPast = ds < todayStr;
          return (
            <Pressable
              key={i}
              style={[
                styles.calCell,
                isSelected && { backgroundColor: colors.primary, borderRadius: 20 },
                !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 20 },
              ]}
              onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(ds === value ? "" : ds); }}
            >
              <Text style={[styles.calDayText, { color: isSelected ? "#fff" : isToday ? colors.primary : isPast ? colors.mutedForeground : colors.foreground, opacity: isPast && !isSelected ? 0.5 : 1 }]}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value ? (
        <Pressable onPress={() => onChange("")} style={styles.calClear}>
          <Text style={[styles.calClearText, { color: colors.mutedForeground }]}>Clear date</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatPill({ stat }: { stat: StatItem }) {
  const colors = useColors();
  return (
    <View style={[styles.statPill, { backgroundColor: colors.secondary }]}>
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

function AnimatedBar({
  targetH,
  gradTop,
  gradBot,
  trackColor,
}: {
  targetH: number;
  gradTop: string;
  gradBot: string;
  trackColor: string;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withTiming(targetH, { duration: 500 });
  }, [targetH]);
  const animStyle = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={[styles.chartBarTrack, { backgroundColor: trackColor }]}>
      <Animated.View style={[styles.chartBar, animStyle, { overflow: "hidden" }]}>
        <LinearGradient
          colors={[gradTop, gradBot]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function AnimatedVsBar({
  targetH,
  color,
  trackColor,
}: {
  targetH: number;
  color: string;
  trackColor: string;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withTiming(targetH, { duration: 500 });
  }, [targetH]);
  const animStyle = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={[styles.vsBarTrack, { backgroundColor: trackColor }]}>
      <Animated.View style={[styles.vsBar, animStyle, { backgroundColor: color }]} />
    </View>
  );
}

type ChartTab = "invoices" | "expenses" | "vs";
type ChartPeriod = 3 | 6 | 12;

function BillingChart({ docs, expenses, salaries, passports }: { docs: BillingDocumentSummary[]; expenses: Expense[]; salaries: SalaryRecord[]; passports: Passport[] }) {
  const colors = useColors();
  const [tab, setTab] = useState<ChartTab>("invoices");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState<ChartPeriod>(12);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const years = [currentYear - 2, currentYear - 1, currentYear];

  const months = useMemo(() => {
    const endMonth = selectedYear === currentYear ? currentMonth : 12;
    const startMonth = Math.max(1, endMonth - period + 1);
    const arr: { key: string; label: string; monthNum: number; count: number; revenue: number; expense: number; margin: number }[] = [];
    for (let m = startMonth; m <= endMonth; m++) {
      const key = `${selectedYear}-${String(m).padStart(2, "0")}`;
      const label = new Date(selectedYear, m - 1, 1).toLocaleString("en", { month: "short" });
      arr.push({ key, label, monthNum: m, count: 0, revenue: 0, expense: 0, margin: 0 });
    }
    // Build set of payment_received invoice IDs for filtering salary records
    const paidInvoiceIds = new Set(
      docs
        .filter((d) => d.status === "payment_received")
        .map((d) => d.id),
    );

    for (const doc of docs) {
      const docKey = (doc.issueDate ?? "").slice(0, 7);
      const bucket = arr.find((b) => b.key === docKey);
      if (!bucket) continue;
      bucket.count += 1;
      if (doc.status === "payment_received") {
        bucket.revenue += Number(doc.subtotal) || 0;
      }
    }
    for (const exp of expenses) {
      const expKey = (exp.expenseDate ?? "").slice(0, 7);
      const bucket = arr.find((b) => b.key === expKey);
      if (!bucket) continue;
      bucket.expense += Number(exp.amount) || 0;
    }

    // Build passport map: id → { employeeType, clientSalary (monthly billing rate),
    //                             agencySalary (monthly cost rate agreed with employee) }
    const passportRateMap = new Map<number, { empType: string; clientRate: number; agencyRate: number; agentRate: number }>();
    for (const p of passports) {
      const pp = p as unknown as { employeeType?: string; clientSalary?: string | number; agencySalary?: string | number };
      passportRateMap.set(p.id, {
        empType:     pp.employeeType ?? "casual",
        clientRate:  Number(pp.clientSalary  || 0),
        agencyRate:  Number(pp.agencySalary  || 0),
        agentRate:   Number((pp as unknown as { agentRate?: string }).agentRate || 0),
      });
    }

    for (const sal of salaries) {
      if (sal.year !== selectedYear) continue;
      // Only include salary records linked to payment_received invoices
      const invId = (sal as unknown as { invoiceId?: number | null }).invoiceId;
      if (invId != null && !paidInvoiceIds.has(invId)) continue;
      const bucket = arr.find((b) => b.monthNum === sal.month);
      if (!bucket) continue;
      const passport = passportRateMap.get(sal.passportId);
      const empType  = passport?.empType ?? "casual";
      const days     = Number((sal as unknown as { daysWorked?: number }).daysWorked || 0);
      if (empType === "casual") {
        // profit = (client billing rate − employee agreed daily rate) × days worked
        // both clientSalary and agencySalary are stored as daily rates on the passport
        const clientRate = passport?.clientRate ?? 0;
        const agencyRate = passport?.agencyRate ?? 0;
        bucket.margin += (clientRate - agencyRate) * days;
      } else if (empType === "recruitment") {
        // one-time profit = agent amount − client rate (NOT multiplied by days)
        const agentAmount = passport?.agentRate ?? 0;
        const clientRate  = passport?.clientRate ?? 0;
        bucket.margin += agentAmount - clientRate;
      } else {
        // org_employed: employee cost borne by client company — full billing is profit
        bucket.margin += Number(sal.clientSalary || 0);
      }
    }
    return arr;
  }, [docs, expenses, salaries, passports, selectedYear, period, currentYear, currentMonth]);

  const BAR_MAX_H = 80;
  const totalCount    = months.reduce((s, m) => s + m.count,   0);
  const totalRevenue  = months.reduce((s, m) => s + m.revenue, 0);
  const totalMargin   = months.reduce((s, m) => s + m.margin,  0);
  const totalExpenses = months.reduce((s, m) => s + m.expense, 0);
  const netPL = totalMargin - totalExpenses;

  const singleVals = months.map((m) => tab === "expenses" ? m.expense : m.margin);
  const vsMax      = Math.max(...months.map((m) => Math.max(m.margin, m.expense)), 1);
  const singleMax  = Math.max(...singleVals, 1);

  function fmtK(v: number) {
    if (v === 0) return "0";
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    return v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v));
  }

  const isExpensesTab = tab === "expenses";
  const COLOR_HIGH = isExpensesTab ? "#EF4444" : "#6366F1";
  const COLOR_MID  = isExpensesTab ? "#F87171" : "#818CF8";
  const COLOR_LOW  = isExpensesTab ? "#FCA5A5" : "#A5B4FC";

  const sel = selectedIdx !== null ? months[selectedIdx] : null;

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Monthly Billing</Text>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowReport(true);
          }}
          style={[styles.chartReportBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="file-text" size={12} color={colors.primary} />
          <Text style={[styles.chartReportBtnText, { color: colors.primary }]}>Report</Text>
        </Pressable>
      </View>

      {/* Year + period controls */}
      <View style={styles.chartControlRow}>
        <View style={[styles.chartControlPill, { backgroundColor: colors.secondary }]}>
          {years.map((y) => (
            <Pressable
              key={y}
              onPress={() => { setSelectedYear(y); setSelectedIdx(null); }}
              style={[styles.chartControlBtn, selectedYear === y && { backgroundColor: colors.card }]}
            >
              <Text style={[styles.chartControlBtnText, { color: selectedYear === y ? colors.foreground : colors.mutedForeground }]}>
                {y}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.chartControlPill, { backgroundColor: colors.secondary }]}>
          {([3, 6, 12] as ChartPeriod[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => { setPeriod(p); setSelectedIdx(null); }}
              style={[styles.chartControlBtn, period === p && { backgroundColor: colors.card }]}
            >
              <Text style={[styles.chartControlBtnText, { color: period === p ? colors.foreground : colors.mutedForeground }]}>
                {p}M
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Summary pills */}
      <View style={styles.chartSummaryRow}>
        <View style={[styles.chartSummaryPill, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartSummaryVal, { color: "#6366F1" }]}>{totalCount}</Text>
          <Text style={[styles.chartSummaryLbl, { color: colors.mutedForeground }]}>Invoices Created</Text>
        </View>
        <View style={[styles.chartSummaryPill, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartSummaryVal, { color: "#10B981" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtMVR(totalMargin)}
          </Text>
          <Text style={[styles.chartSummaryLbl, { color: colors.mutedForeground }]}>Total Margin</Text>
        </View>
      </View>
      <View style={styles.chartSummaryRow}>
        <View style={[styles.chartSummaryPill, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartSummaryVal, { color: "#EF4444" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtMVR(totalExpenses)}
          </Text>
          <Text style={[styles.chartSummaryLbl, { color: colors.mutedForeground }]}>Total Expenses</Text>
        </View>
        <View style={[styles.chartSummaryPill, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartSummaryVal, { color: netPL >= 0 ? "#10B981" : "#EF4444" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {netPL >= 0 ? "+" : "−"}{fmtMVR(Math.abs(netPL))}
          </Text>
          <Text style={[styles.chartSummaryLbl, { color: colors.mutedForeground }]}>Net Profit</Text>
        </View>
      </View>

      {/* Tab toggle */}
      <View style={[styles.chartTabRow, { backgroundColor: colors.secondary }]}>
        {([
          ["invoices", "Invoices"],
          ["expenses", "Expenses"],
          ["vs",       "Income vs Exp"],
        ] as [ChartTab, string][]).map(([t, label]) => (
          <Pressable
            key={t}
            onPress={() => { setTab(t); setSelectedIdx(null); }}
            style={[styles.chartTab, tab === t && { backgroundColor: colors.card, shadowColor: "#000" }]}
          >
            <Text style={[styles.chartTabText, {
              color: tab === t
                ? t === "expenses" ? "#EF4444" : t === "vs" ? colors.foreground : "#6366F1"
                : colors.mutedForeground,
            }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tap-to-inspect callout */}
      {sel && (
        <View style={[styles.callout, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.calloutHeader}>
            <Text style={[styles.calloutMonth, { color: colors.foreground }]}>
              {new Date(selectedYear, sel.monthNum - 1, 1).toLocaleString("en", { month: "long" })} {selectedYear}
            </Text>
            <Pressable onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedIdx(null);
            }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View style={styles.calloutRow}>
            <View style={styles.calloutCell}>
              <Text style={[styles.calloutCellLabel, { color: colors.mutedForeground }]}>Margin</Text>
              <Text style={[styles.calloutCellVal, { color: "#10B981" }]}>{fmtMVR(sel.margin)}</Text>
              {totalMargin > 0 && (
                <Text style={[styles.calloutPct, { color: colors.mutedForeground }]}>
                  {Math.round((sel.margin / totalMargin) * 100)}% of period
                </Text>
              )}
            </View>
            <View style={[styles.calloutDivider, { backgroundColor: colors.border }]} />
            <View style={styles.calloutCell}>
              <Text style={[styles.calloutCellLabel, { color: colors.mutedForeground }]}>Expenses</Text>
              <Text style={[styles.calloutCellVal, { color: "#EF4444" }]}>{fmtMVR(sel.expense)}</Text>
              {totalExpenses > 0 && (
                <Text style={[styles.calloutPct, { color: colors.mutedForeground }]}>
                  {Math.round((sel.expense / totalExpenses) * 100)}% of period
                </Text>
              )}
            </View>
            <View style={[styles.calloutDivider, { backgroundColor: colors.border }]} />
            <View style={styles.calloutCell}>
              <Text style={[styles.calloutCellLabel, { color: colors.mutedForeground }]}>Net</Text>
              <Text style={[styles.calloutCellVal, { color: sel.margin - sel.expense >= 0 ? "#10B981" : "#EF4444" }]}>
                {sel.margin - sel.expense >= 0 ? "+" : "−"}{fmtMVR(Math.abs(sel.margin - sel.expense))}
              </Text>
              <Text style={[styles.calloutPct, { color: colors.mutedForeground }]}>
                {sel.count} invoice{sel.count !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Chart bars */}
      <View style={[styles.chartCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
        {tab === "vs" ? (
          <>
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
            <View style={styles.chartBars}>
              {months.map((m, idx) => {
                const incH = m.margin > 0 ? Math.max(4, (m.margin / vsMax) * BAR_MAX_H) : 0;
                const expH = m.expense > 0 ? Math.max(4, (m.expense / vsMax) * BAR_MAX_H) : 0;
                const isSel = selectedIdx === idx;
                return (
                  <Pressable
                    key={m.key}
                    style={({ pressed }) => [styles.chartCol, isSel && styles.chartColSelected, pressed && { opacity: 0.7 }]}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedIdx(isSel ? null : idx);
                    }}
                  >
                    <View style={styles.vsBarRow}>
                      <AnimatedVsBar targetH={incH} color={isSel ? "#059669" : "#10B981"} trackColor={colors.secondary} />
                      <AnimatedVsBar targetH={expH} color={isSel ? "#DC2626" : "#EF4444"} trackColor={colors.secondary} />
                    </View>
                    <Text style={[styles.chartMonthLabel, { color: isSel ? colors.foreground : colors.mutedForeground, fontWeight: isSel ? "700" : "400" }]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.chartBars}>
            {months.map((m, idx) => {
              const v = singleVals[idx] ?? 0;
              const pct = singleMax > 0 ? v / singleMax : 0;
              const barH = v > 0 ? Math.max(4, pct * BAR_MAX_H) : 0;
              const isSel = selectedIdx === idx;
              const gradTop = isSel
                ? isExpensesTab ? "#EF4444" : "#6366F1"
                : pct > 0.6 ? COLOR_HIGH : pct > 0.2 ? COLOR_MID : COLOR_LOW;
              const gradBot = isSel
                ? isExpensesTab ? "#991B1B" : "#312E81"
                : pct > 0.6 ? (isExpensesTab ? "#B91C1C" : "#4338CA") : pct > 0.2 ? COLOR_HIGH : COLOR_MID;
              return (
                <Pressable
                  key={m.key}
                  style={({ pressed }) => [styles.chartCol, isSel && styles.chartColSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedIdx(isSel ? null : idx);
                  }}
                >
                  <View style={styles.chartValBox}>
                    <Text
                      numberOfLines={1}
                      style={[styles.chartValLabel, {
                        color: isSel ? gradTop : colors.mutedForeground,
                        transform: [{ rotate: "-90deg" }],
                        fontWeight: isSel ? "700" : "400",
                      }]}
                    >
                      {v > 0 ? fmtK(v) : ""}
                    </Text>
                  </View>
                  <AnimatedBar targetH={barH} gradTop={gradTop} gradBot={gradBot} trackColor={isSel ? colors.border : colors.secondary} />
                  <Text style={[styles.chartMonthLabel, {
                    color: isSel ? colors.foreground : colors.mutedForeground,
                    fontWeight: isSel ? "700" : "400",
                  }]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {!sel && (
          <Text style={[styles.chartHint, { color: colors.mutedForeground }]}>Tap a bar to inspect</Text>
        )}
      </View>

      {/* Report modal */}
      <Modal visible={showReport} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowReport(false)}>
        <View style={[styles.reportModal, { backgroundColor: colors.background }]}>
          <View style={[styles.reportModalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowReport(false)} style={{ padding: 4 }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.reportModalTitle, { color: colors.foreground }]}>Report — {selectedYear}</Text>
            <View style={{ width: 30 }} />
          </View>
          <ScrollView contentContainerStyle={styles.reportModalBody} showsVerticalScrollIndicator={false}>
            {/* Summary */}
            <View style={[styles.reportSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {([
                { label: "Period",     value: `${period} months`,       color: colors.foreground },
                { label: "Invoices",   value: String(totalCount),        color: "#6366F1"         },
                { label: "Margin",     value: fmtMVR(totalMargin),       color: "#10B981"         },
                { label: "Expenses",   value: fmtMVR(totalExpenses),     color: "#EF4444"         },
                { label: "Net (Margin−Exp)", value: `${netPL >= 0 ? "+" : "−"}${fmtMVR(Math.abs(netPL))}`, color: netPL >= 0 ? "#10B981" : "#EF4444" },
              ] as { label: string; value: string; color: string }[]).map((row, i) => (
                <View key={row.label} style={[styles.reportSumRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <Text style={[styles.reportSumLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[styles.reportSumVal, { color: row.color }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* Month table */}
            <Text style={[styles.reportTableTitle, { color: colors.foreground }]}>Monthly Breakdown</Text>
            <View style={[styles.reportTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.reportTRow, styles.reportTHead, { borderBottomColor: colors.border }]}>
                <Text style={[styles.reportTHCell, { color: colors.mutedForeground, flex: 1.6 }]}>Month</Text>
                <Text style={[styles.reportTHCell, { color: "#6366F1" }]}>Inv</Text>
                <Text style={[styles.reportTHCell, { color: "#10B981" }]}>Margin</Text>
                <Text style={[styles.reportTHCell, { color: "#EF4444" }]}>Expense</Text>
                <Text style={[styles.reportTHCell, { color: colors.foreground }]}>Net</Text>
              </View>
              {months.map((m, i) => {
                const net = m.margin - m.expense;
                return (
                  <View key={m.key} style={[styles.reportTRow, i < months.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                    <Text style={[styles.reportTDCell, { color: colors.foreground, flex: 1.6 }]}>{m.label} '{String(selectedYear).slice(2)}</Text>
                    <Text style={[styles.reportTDCell, { color: "#6366F1" }]}>{m.count}</Text>
                    <Text style={[styles.reportTDCell, { color: "#10B981" }]}>{fmtK(m.margin)}</Text>
                    <Text style={[styles.reportTDCell, { color: "#EF4444" }]}>{fmtK(m.expense)}</Text>
                    <Text style={[styles.reportTDCell, { color: net >= 0 ? "#10B981" : "#EF4444" }]}>
                      {net >= 0 ? "+" : "−"}{fmtK(Math.abs(net))}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
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

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  function handleLongPress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const buttons: { text: string; onPress?: () => void; style?: "cancel" | "default" | "destructive" }[] = [
      { text: "View Details", onPress },
      ...(passport.passportNumber
        ? [{ text: "Copy Passport #", onPress: () => { void Share.share({ message: passport.passportNumber! }); } }]
        : []),
      ...(passport.fullName
        ? [{ text: "Share Name & #", onPress: () => { void Share.share({ message: `${passport.fullName ?? ""} — ${passport.passportNumber ?? ""}` }); } }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ];
    Alert.alert(passport.fullName ?? "Candidate", passport.passportNumber ?? "", buttons);
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.recentRow,
        {
          backgroundColor: colors.secondary,
          opacity: pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.982 : 1 }],
        },
      ]}
    >
      <View style={[styles.recentAvatar, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.recentInitials, { color: colors.foreground }]}>{initials}</Text>
      </View>
      <View style={styles.recentContent}>
        <Text style={[styles.recentName, { color: colors.foreground }]} numberOfLines={1}>
          {passport.fullName || "Unnamed"}
        </Text>
        <Text style={[styles.recentNum, { color: colors.mutedForeground }]} numberOfLines={1}>
          {passport.passportNumber || "—"}
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: sc + "18" }]}>
        <View style={[styles.statusDot, { backgroundColor: sc }]} />
        <Text style={[styles.statusPillText, { color: sc }]}>{statusLabel(status)}</Text>
      </View>
      <Feather name="chevron-right" size={12} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
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
  cardQrWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#FFFFFF12",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  cardNameDisplay: { position: "absolute", left: 14, top: 16, right: 72, zIndex: 1 },
  cardDisplayName: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", letterSpacing: 1.0, lineHeight: 24 },
  cardSubText: { fontSize: 10, color: "#FFFFFF70", letterSpacing: 0.3 },
  cardBottom: { gap: 6 },
  // card number dots
  cardDotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardDotGroup: { flexDirection: "row", gap: 3 },
  cardDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#FFFFFF65" },
  cardPhoneText: { fontSize: 11, color: "#FFFFFF70", letterSpacing: 0.5 },
  // name row
  cardNameRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6 },
  cardHolderLabel: { fontSize: 6.5, color: "#FFFFFF35", letterSpacing: 1.2, marginBottom: 1 },
  cardName: { fontSize: 10, fontWeight: "500", color: "#FFFFFF80", letterSpacing: 0.2 },
  cardRolePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, flexShrink: 0, backgroundColor: "#FFFFFF15" },
  cardRoleText: { fontSize: 8, fontWeight: "500", color: "#FFFFFF70" },
  // back face
  cardBackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  cardBackAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF15",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBackInitials: { fontSize: 14, fontWeight: "700", color: "#FFFFFFDD" },
  cardBackName: { fontSize: 12, fontWeight: "700", color: "#FFFFFFEE", letterSpacing: 0.3 },
  cardBackDesig: { fontSize: 10, color: "#FFFFFF70", marginTop: 1 },
  cardContactRows: { gap: 7, marginTop: 10, flex: 1 },
  cardContactRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardContactLabel: { fontSize: 10, color: "#FFFFFF50", width: 40 },
  cardContactValue: { flex: 1, fontSize: 12, color: "#FFFFFFCC", fontWeight: "500" },
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

  dashCard: {
    borderRadius: 20,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
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
  chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 132 },
  chartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  chartValBox: { height: 36, alignItems: "center", justifyContent: "center" },
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

  recentList: { gap: 5 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 10,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  recentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  recentInitials: { fontSize: 12, fontWeight: "600" },
  recentContent: { flex: 1, gap: 1 },
  recentName: { fontSize: 13, fontWeight: "600" },
  recentNum: { fontSize: 11 },

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
  statChipActiveDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },

  taskFilterRow: {
    flexDirection: "row", padding: 3, gap: 2,
  },
  taskFilterBtn: {
    flex: 1, paddingVertical: 7, paddingHorizontal: 2, alignItems: "center", borderRadius: 10, gap: 3,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 0,
  },
  taskFilterText: { fontSize: 11, },
  filterCountBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, minWidth: 18, alignItems: "center" },
  filterCountText: { fontSize: 10, fontWeight: "700" },

  clearDoneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12 },
  clearDoneBtnText: { fontSize: 13, fontWeight: "600" },

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
  priorityDot: { width: 5, height: 5, borderRadius: 3 },

  quickAddOptions: { gap: 6 },
  quickPriorityRow: { flexDirection: "row", gap: 6 },
  quickPriorityBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  quickPriorityDot: { width: 6, height: 6, borderRadius: 3 },
  quickPriorityText: { fontSize: 12, fontWeight: "600" },
  quickDateRow: { flexDirection: "row", gap: 5 },
  quickDateBtn: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 10 },
  quickDateText: { fontSize: 11 },

  subtaskMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  subtaskTrack: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  subtaskFill: { height: 3, borderRadius: 2 },

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
  statusRow: { flexDirection: "row", gap: 6 },
  statusPillBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 12 },
  statusPillBtnText: { fontSize: 11, fontWeight: "600" },

  datePickerBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  datePickerBtnText: { flex: 1, fontSize: 15 },

  calWrap: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8, marginTop: 4 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  calNavBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  calMonthLabel: { fontSize: 15, fontWeight: "600" },
  calDowRow: { flexDirection: "row" },
  calDow: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", paddingVertical: 4 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.28%" as any, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calDayText: { fontSize: 13, fontWeight: "500" },
  calClear: { alignItems: "center", paddingVertical: 6 },
  calClearText: { fontSize: 12 },

  priorityRow: { flexDirection: "row", gap: 8 },
  priorityPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 12 },
  priorityPillText: { fontSize: 13 },

  chartReportBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  chartReportBtnText: { fontSize: 12, fontWeight: "600" },

  chartControlRow: { flexDirection: "row", gap: 8 },
  chartControlPill: { flex: 1, flexDirection: "row", borderRadius: 10, padding: 2 },
  chartControlBtn: { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 8 },
  chartControlBtnText: { fontSize: 12, fontWeight: "600" },

  callout: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  calloutHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calloutMonth: { fontSize: 14, fontWeight: "700" },
  calloutRow: { flexDirection: "row", alignItems: "center" },
  calloutCell: { flex: 1, alignItems: "center", gap: 3 },
  calloutCellLabel: { fontSize: 10 },
  calloutCellVal: { fontSize: 13, fontWeight: "700" },
  calloutDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  calloutSub: { fontSize: 11, textAlign: "center" },

  chartColSelected: { backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 10 },
  chartHint: { fontSize: 10, textAlign: "center", marginTop: 6 },
  calloutPct: { fontSize: 9, opacity: 0.6 },

  reportModal: { flex: 1 },
  reportModalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reportModalTitle: { fontSize: 16, fontWeight: "700" },
  reportModalBody: { padding: 20, gap: 16 },

  reportSummaryCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  reportSumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  reportSumLabel: { fontSize: 14 },
  reportSumVal: { fontSize: 14, fontWeight: "700" },

  reportTableTitle: { fontSize: 14, fontWeight: "700" },
  reportTable: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  reportTRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10 },
  reportTHead: { borderBottomWidth: StyleSheet.hairlineWidth },
  reportTHCell: { flex: 1, fontSize: 11, fontWeight: "700", textAlign: "right" },
  reportTDCell: { flex: 1, fontSize: 12, textAlign: "right" },
});
