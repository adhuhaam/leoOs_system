import { Feather } from "@expo/vector-icons";
import {
  getListTasksQueryKey,
  type Task,
  TaskPriority,
  TaskStatus,
  useCreateTask,
  useDeleteTask,
  useListTasks,
  useUpdateTask,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Filter = "all" | "today" | "overdue" | "done";

const PRIORITY_COLORS: Record<
  TaskPriority,
  { bg: string; fg: string; dot: string; label: string }
> = {
  high: { bg: "#fee2e2", fg: "#b91c1c", dot: "#ef4444", label: "High" },
  medium: { bg: "#fef3c7", fg: "#a16207", dot: "#f59e0b", label: "Medium" },
  low: { bg: "#dcfce7", fg: "#15803d", dot: "#22c55e", label: "Low" },
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function classifyDue(
  due: string | null | undefined,
): "overdue" | "today" | "later" | "none" {
  if (!due) return "none";
  const today = startOfLocalDay(new Date()).getTime();
  const dueDay = startOfLocalDay(new Date(due)).getTime();
  if (dueDay < today) return "overdue";
  if (dueDay === today) return "today";
  return "later";
}

function formatDueLabel(due: string): string {
  const d = startOfLocalDay(new Date(due));
  const today = startOfLocalDay(new Date());
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff}d overdue`;
  if (diff < 7) return `In ${diff}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const [quickTitle, setQuickTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const [subtaskFor, setSubtaskFor] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const {
    data: tasks = [],
    isLoading,
    isFetching,
    refetch,
  } = useListTasks({
    query: { queryKey: getListTasksQueryKey() },
  });

  const createMut = useCreateTask();
  const updateMut = useUpdateTask();
  const deleteMut = useDeleteTask();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
  }, [qc]);

  const { topLevel, byParent, stats } = useMemo(() => {
    const top: Task[] = [];
    const map = new Map<number, Task[]>();
    let open = 0;
    let done = 0;
    let overdue = 0;
    let today = 0;
    for (const t of tasks) {
      if (t.parentId == null) top.push(t);
      else {
        const arr = map.get(t.parentId) ?? [];
        arr.push(t);
        map.set(t.parentId, arr);
      }
      if (t.status === "done") done++;
      else {
        open++;
        const klass = classifyDue(t.dueDate);
        if (klass === "overdue") overdue++;
        else if (klass === "today") today++;
      }
    }
    top.sort((a, b) => a.position - b.position);
    map.forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return {
      topLevel: top,
      byParent: map,
      stats: { open, done, overdue, today },
    };
  }, [tasks]);

  const visibleTopLevel = useMemo(() => {
    return topLevel.filter((t) => {
      if (filter === "done") return t.status === "done";
      if (t.status === "done") return false;
      if (filter === "today") return classifyDue(t.dueDate) === "today";
      if (filter === "overdue") return classifyDue(t.dueDate) === "overdue";
      return true;
    });
  }, [topLevel, filter]);

  async function handleQuickAdd() {
    const title = quickTitle.trim();
    if (!title) return;
    try {
      await createMut.mutateAsync({
        data: { title, priority: "medium" },
      });
      setQuickTitle("");
      invalidate();
    } catch (err) {
      Alert.alert("Could not add", err instanceof Error ? err.message : "Unknown");
    }
  }

  async function handleToggleDone(t: Task) {
    try {
      await updateMut.mutateAsync({
        id: t.id,
        data: { status: t.status === "done" ? "todo" : "done" },
      });
      invalidate();
    } catch (err) {
      Alert.alert("Could not update", err instanceof Error ? err.message : "Unknown");
    }
  }

  async function handleDelete(t: Task) {
    Alert.alert(
      "Delete task?",
      `"${t.title}" and any subtasks will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMut.mutateAsync({ id: t.id });
              invalidate();
            } catch (err) {
              Alert.alert(
                "Could not delete",
                err instanceof Error ? err.message : "Unknown",
              );
            }
          },
        },
      ],
    );
  }

  function toggleExpand(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            LEO OS · TODAY
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Today's Tasks
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Plan, organize and track everything you need to get done.
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatTile label="Open" value={stats.open} icon="list" tint="#6366f1" />
          <StatTile label="Today" value={stats.today} icon="calendar" tint="#f59e0b" />
          <StatTile label="Overdue" value={stats.overdue} icon="alert-triangle" tint="#ef4444" />
          <StatTile label="Done" value={stats.done} icon="check-circle" tint="#22c55e" />
        </View>

        {/* Quick add */}
        <View
          style={[
            styles.quickAdd,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="plus" size={16} color={colors.mutedForeground} />
          <TextInput
            value={quickTitle}
            onChangeText={setQuickTitle}
            placeholder="What needs to get done?"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.quickInput, { color: colors.foreground }]}
            returnKeyType="done"
            onSubmitEditing={handleQuickAdd}
          />
          <Pressable
            onPress={handleQuickAdd}
            disabled={!quickTitle.trim() || createMut.isPending}
            style={({ pressed }) => [
              styles.quickAddBtn,
              {
                backgroundColor: colors.primary,
                opacity: !quickTitle.trim() || createMut.isPending ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.quickAddBtnText}>Add</Text>
          </Pressable>
        </View>

        {/* Filter tabs */}
        <View style={styles.tabs}>
          {(
            [
              { k: "all" as Filter, label: "All" },
              { k: "today" as Filter, label: "Today" },
              { k: "overdue" as Filter, label: "Overdue" },
              { k: "done" as Filter, label: "Done" },
            ]
          ).map((t) => {
            const active = filter === t.k;
            return (
              <Pressable
                key={t.k}
                onPress={() => setFilter(t.k)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? "#fff" : colors.foreground },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Task list */}
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : visibleTopLevel.length === 0 ? (
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="check-circle" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {filter === "all" ? "All caught up" : `No ${filter} tasks`}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {filter === "all"
                ? "Add your first task above to get started."
                : "Try a different filter."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {visibleTopLevel.map((task) => {
              const children = byParent.get(task.id) ?? [];
              const isOpen = expanded.has(task.id);
              return (
                <View key={task.id} style={{ gap: 6 }}>
                  <TaskRow
                    task={task}
                    childCount={children.length}
                    doneChildren={children.filter((c) => c.status === "done").length}
                    isOpen={isOpen}
                    onToggleExpand={() => toggleExpand(task.id)}
                    onToggleDone={() => handleToggleDone(task)}
                    onEdit={() => setEditing(task)}
                    onDelete={() => handleDelete(task)}
                    onAddSubtask={() => setSubtaskFor(task)}
                  />
                  {isOpen &&
                    children.map((child) => (
                      <TaskRow
                        key={child.id}
                        task={child}
                        isSubtask
                        childCount={0}
                        doneChildren={0}
                        isOpen={false}
                        onToggleDone={() => handleToggleDone(child)}
                        onEdit={() => setEditing(child)}
                        onDelete={() => handleDelete(child)}
                      />
                    ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Edit modal */}
      <EditTaskModal
        task={editing}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          try {
            await updateMut.mutateAsync({ id: editing.id, data: patch });
            invalidate();
            setEditing(null);
          } catch (err) {
            Alert.alert(
              "Could not save",
              err instanceof Error ? err.message : "Unknown",
            );
          }
        }}
      />

      {/* Subtask modal */}
      <SubtaskModal
        parent={subtaskFor}
        onClose={() => setSubtaskFor(null)}
        onSubmit={async (title) => {
          if (!subtaskFor) return;
          try {
            await createMut.mutateAsync({
              data: { title, parentId: subtaskFor.id, priority: "medium" },
            });
            setExpanded((s) => new Set([...s, subtaskFor.id]));
            invalidate();
            setSubtaskFor(null);
          } catch (err) {
            Alert.alert(
              "Could not add subtask",
              err instanceof Error ? err.message : "Unknown",
            );
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

function StatTile({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: keyof typeof Feather.glyphMap;
  tint: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statTile,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: tint + "22" }]}>
        <Feather name={icon} size={14} color={tint} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function TaskRow({
  task,
  isSubtask,
  childCount,
  doneChildren,
  isOpen,
  onToggleExpand,
  onToggleDone,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  task: Task;
  isSubtask?: boolean;
  childCount: number;
  doneChildren: number;
  isOpen: boolean;
  onToggleExpand?: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubtask?: () => void;
}) {
  const colors = useColors();
  const done = task.status === "done";
  const priorityMeta = PRIORITY_COLORS[task.priority];
  const dueClass = classifyDue(task.dueDate);
  const dueColor =
    dueClass === "overdue"
      ? "#ef4444"
      : dueClass === "today"
        ? "#f59e0b"
        : colors.mutedForeground;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          marginLeft: isSubtask ? 28 : 0,
          opacity: done ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rowTop}>
        {!isSubtask && (
          <Pressable
            onPress={onToggleExpand}
            hitSlop={8}
            style={styles.expander}
          >
            <Feather
              name={isOpen ? "chevron-down" : "chevron-right"}
              size={16}
              color={childCount > 0 ? colors.foreground : "transparent"}
            />
          </Pressable>
        )}
        <Pressable
          onPress={onToggleDone}
          hitSlop={8}
          style={[
            styles.checkbox,
            {
              borderColor: done ? colors.primary : colors.border,
              backgroundColor: done ? colors.primary : "transparent",
            },
          ]}
        >
          {done && <Feather name="check" size={12} color="#fff" />}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.rowTitle,
              {
                color: colors.foreground,
                textDecorationLine: done ? "line-through" : "none",
              },
            ]}
          >
            {task.title}
          </Text>
          <View style={styles.rowMeta}>
            {!done && (
              <View style={[styles.badge, { backgroundColor: priorityMeta.bg }]}>
                <View
                  style={[styles.badgeDot, { backgroundColor: priorityMeta.dot }]}
                />
                <Text style={[styles.badgeText, { color: priorityMeta.fg }]}>
                  {priorityMeta.label}
                </Text>
              </View>
            )}
            {task.status === "in_progress" && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
                ]}
              >
                <Text style={[styles.badgeText, { color: "#1d4ed8" }]}>
                  In progress
                </Text>
              </View>
            )}
            {task.dueDate && (
              <View style={styles.dueRow}>
                <Feather name="calendar" size={11} color={dueColor} />
                <Text style={[styles.dueText, { color: dueColor }]}>
                  {formatDueLabel(task.dueDate)}
                </Text>
              </View>
            )}
            {childCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                <Feather name="list" size={10} color={colors.mutedForeground} />
                <Text
                  style={[styles.badgeText, { color: colors.mutedForeground }]}
                >
                  {doneChildren}/{childCount}
                </Text>
              </View>
            )}
          </View>
          {task.notes ? (
            <Text
              numberOfLines={2}
              style={[styles.notesPreview, { color: colors.mutedForeground }]}
            >
              {task.notes}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rowActions}>
        {onAddSubtask && (
          <Pressable
            onPress={onAddSubtask}
            hitSlop={6}
            style={[
              styles.iconBtn,
              { borderColor: colors.border, backgroundColor: colors.muted },
            ]}
          >
            <Feather name="plus" size={14} color={colors.foreground} />
          </Pressable>
        )}
        <Pressable
          onPress={onEdit}
          hitSlop={6}
          style={[
            styles.iconBtn,
            { borderColor: colors.border, backgroundColor: colors.muted },
          ]}
        >
          <Feather name="edit-2" size={13} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={6}
          style={[
            styles.iconBtn,
            {
              borderColor: colors.destructive + "40",
              backgroundColor: colors.destructive + "15",
            },
          ]}
        >
          <Feather name="trash-2" size={13} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

function EditTaskModal({
  task,
  onClose,
  onSave,
}: {
  task: Task | null;
  onClose: () => void;
  onSave: (patch: {
    title?: string;
    notes?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
  }) => Promise<void>;
}) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState("");

  React.useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate ?? "");
    }
  }, [task]);

  if (!task) return null;

  return (
    <Modal
      visible={!!task}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.modalHeader,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Edit task
          </Text>
          <Pressable
            onPress={() =>
              onSave({
                title: title.trim() || task.title,
                notes: notes.trim() ? notes.trim() : null,
                priority,
                status,
                dueDate: dueDate.trim() ? dueDate.trim() : null,
              })
            }
            hitSlop={8}
          >
            <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Field label="Title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              placeholderTextColor={colors.mutedForeground}
            />
          </Field>
          <Field label="Notes / remarks">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              placeholder="Add details, links, context…"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                styles.textarea,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            />
          </Field>
          <Field label="Priority">
            <SegmentedControl
              value={priority}
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
              onChange={(v) => setPriority(v as TaskPriority)}
            />
          </Field>
          <Field label="Status">
            <SegmentedControl
              value={status}
              options={[
                { value: "todo", label: "To do" },
                { value: "in_progress", label: "In progress" },
                { value: "done", label: "Done" },
              ]}
              onChange={(v) => setStatus(v as TaskStatus)}
            />
          </Field>
          <Field label="Due date (YYYY-MM-DD)">
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="2025-12-31"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            />
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SubtaskModal({
  parent,
  onClose,
  onSubmit,
}: {
  parent: Task | null;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}) {
  const colors = useColors();
  const [title, setTitle] = useState("");

  React.useEffect(() => {
    if (parent) setTitle("");
  }, [parent]);

  if (!parent) return null;

  return (
    <Modal
      visible={!!parent}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.modalHeader,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Add subtask
          </Text>
          <Pressable
            onPress={() => {
              const t = title.trim();
              if (t) void onSubmit(t);
            }}
            hitSlop={8}
            disabled={!title.trim()}
          >
            <Text
              style={[
                styles.modalSave,
                { color: title.trim() ? colors.primary : colors.mutedForeground },
              ]}
            >
              Add
            </Text>
          </Pressable>
        </View>
        <View style={styles.modalBody}>
          <Text style={[styles.subtaskParent, { color: colors.mutedForeground }]}>
            Under: {parent.title}
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Subtask title"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.segment,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              styles.segmentBtn,
              active && {
                backgroundColor: colors.card,
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  greeting: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 4 },
  subtitle: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4 },
  loading: { padding: 40, alignItems: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  quickAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    paddingVertical: 8,
  },
  quickAddBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickAddBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  tabs: { flexDirection: "row", gap: 6 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  row: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  expander: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  dueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dueText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  notesPreview: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
    lineHeight: 16,
  },
  rowActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  modalCancel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  modalSave: { fontSize: 14, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 16, gap: 14 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  segment: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  subtaskParent: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
