import React, { useMemo, useState } from "react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { Task } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  ListTodo,
  CalendarDays,
  AlertTriangle,
  Flame,
  StickyNote,
  Sparkles,
  Inbox,
} from "lucide-react";
import { format, isToday, parseISO, startOfDay } from "date-fns";

// Compare due dates as local calendar days, never as instants. Avoids
// timezone- and time-of-day flakiness around midnight (e.g. a task due
// "today" briefly being classified as "overdue" past local midnight UTC).
function dueClassification(
  dueIso: string,
): "overdue" | "today" | "future" {
  const due = startOfDay(parseISO(dueIso));
  const today = startOfDay(new Date());
  if (due.getTime() < today.getTime()) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "future";
}

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";

const PRIORITY_META: Record<Priority, { label: string; classes: string; dot: string }> = {
  high: {
    label: "High",
    classes: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    dot: "bg-rose-500",
  },
  medium: {
    label: "Medium",
    classes: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    dot: "bg-amber-500",
  },
  low: {
    label: "Low",
    classes: "bg-sky-500/10 text-sky-700 border-sky-500/20",
    dot: "bg-sky-500",
  },
};

const STATUS_META: Record<Status, { label: string; classes: string }> = {
  todo: {
    label: "To do",
    classes: "bg-muted text-muted-foreground border-border",
  },
  in_progress: {
    label: "In progress",
    classes: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  },
  done: {
    label: "Done",
    classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
};

type Filter = "all" | "today" | "upcoming" | "done";

export default function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tasks = [], isLoading } = useListTasks();
  const createMut = useCreateTask();
  const updateMut = useUpdateTask();
  const deleteMut = useDeleteTask();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListTasksQueryKey() });

  // Quick add
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<Priority>("medium");
  const [quickDueDate, setQuickDueDate] = useState<string>("");

  // Filter + expand state
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Edit dialog
  const [editingId, setEditingId] = useState<number | null>(null);
  const editingTask = useMemo(
    () => tasks.find((t) => t.id === editingId) ?? null,
    [tasks, editingId],
  );

  // Subtask inline composer (open per-parent)
  const [subtaskFor, setSubtaskFor] = useState<number | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");

  // Group tasks: top-level + map of children
  const { topLevel, childrenOf } = useMemo(() => {
    const top: Task[] = [];
    const kids = new Map<number, Task[]>();
    for (const t of tasks) {
      if (t.parentId == null) top.push(t);
      else {
        const arr = kids.get(t.parentId) ?? [];
        arr.push(t);
        kids.set(t.parentId, arr);
      }
    }
    return { topLevel: top, childrenOf: kids };
  }, [tasks]);

  // Filtered top-level for the selected tab. Subtasks render with their parent
  // regardless of the filter so the user always sees full context.
  const visibleTop = useMemo(() => {
    return topLevel.filter((t) => {
      switch (filter) {
        case "today":
          return (
            t.status !== "done" &&
            t.dueDate != null &&
            dueClassification(t.dueDate) === "today"
          );
        case "upcoming":
          return (
            t.status !== "done" &&
            t.dueDate != null &&
            dueClassification(t.dueDate) !== "overdue"
          );
        case "done":
          return t.status === "done";
        case "all":
        default:
          return true;
      }
    });
  }, [topLevel, filter]);

  // Stats — top-level only so big numbers feel meaningful
  const stats = useMemo(() => {
    let open = 0,
      dueToday = 0,
      overdue = 0,
      done = 0;
    for (const t of topLevel) {
      if (t.status === "done") {
        done++;
        continue;
      }
      open++;
      if (t.dueDate) {
        const cls = dueClassification(t.dueDate);
        if (cls === "today") dueToday++;
        else if (cls === "overdue") overdue++;
      }
    }
    return { open, dueToday, overdue, done };
  }, [topLevel]);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    try {
      await createMut.mutateAsync({
        data: {
          title,
          priority: quickPriority,
          dueDate: quickDueDate || null,
        },
      });
      setQuickTitle("");
      setQuickDueDate("");
      setQuickPriority("medium");
      invalidate();
    } catch (err) {
      toast({
        title: "Could not add task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function toggleDone(t: Task) {
    const next: Status = t.status === "done" ? "todo" : "done";
    try {
      await updateMut.mutateAsync({ id: t.id, data: { status: next } });
      invalidate();
    } catch (err) {
      toast({
        title: "Could not update task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this task and any subtasks?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      invalidate();
    } catch (err) {
      toast({
        title: "Could not delete",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleAddSubtask(parentId: number) {
    const title = subtaskTitle.trim();
    if (!title) return;
    try {
      await createMut.mutateAsync({
        data: { title, parentId, priority: "medium" },
      });
      setSubtaskTitle("");
      setSubtaskFor(null);
      // Auto-expand the parent so the new subtask is visible
      setExpanded((s) => new Set([...s, parentId]));
      invalidate();
    } catch (err) {
      toast({
        title: "Could not add subtask",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-emerald-500/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative px-6 md:px-8 py-6 md:py-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-background/60 px-2.5 py-1 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-400">
              {format(new Date(), "EEEE · MMM d, yyyy")}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Today's Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plan, organize and track everything you need to get done.
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open" value={stats.open} icon={ListTodo} accent="indigo" />
        <StatTile label="Due Today" value={stats.dueToday} icon={CalendarDays} accent="amber" />
        <StatTile label="Overdue" value={stats.overdue} icon={AlertTriangle} accent="rose" />
        <StatTile label="Completed" value={stats.done} icon={CheckCircle2} accent="emerald" />
      </div>

      {/* Quick add */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4 md:p-5">
          <form onSubmit={handleQuickAdd} className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="What needs to get done?"
                className="pl-9 h-10"
                data-testid="input-quick-task"
              />
            </div>
            <Select value={quickPriority} onValueChange={(v) => setQuickPriority(v as Priority)}>
              <SelectTrigger className="md:w-36 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low priority</SelectItem>
                <SelectItem value="medium">Medium priority</SelectItem>
                <SelectItem value="high">High priority</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={quickDueDate}
              onChange={(e) => setQuickDueDate(e.target.value)}
              className="md:w-44 h-10"
              aria-label="Due date"
            />
            <Button
              type="submit"
              disabled={!quickTitle.trim() || createMut.isPending}
              className="h-10 gap-1.5"
              data-testid="button-add-task"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/60 -mb-2">
        {(
          [
            { key: "all", label: "All", count: topLevel.length },
            { key: "today", label: "Today", count: stats.dueToday },
            { key: "upcoming", label: "Upcoming" },
            { key: "done", label: "Done", count: stats.done },
          ] as { key: Filter; label: string; count?: number }[]
        ).map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
                    {tab.count}
                  </Badge>
                )}
              </span>
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Loading tasks…
            </div>
          ) : visibleTop.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <ul className="divide-y divide-border/60">
              {visibleTop.map((t) => {
                const kids = childrenOf.get(t.id) ?? [];
                const isOpen = expanded.has(t.id);
                return (
                  <li key={t.id}>
                    <TaskRow
                      task={t}
                      hasChildren={kids.length > 0}
                      isOpen={isOpen}
                      childCount={kids.length}
                      doneChildCount={kids.filter((k) => k.status === "done").length}
                      onToggleDone={() => toggleDone(t)}
                      onToggleExpand={() => toggleExpand(t.id)}
                      onEdit={() => setEditingId(t.id)}
                      onDelete={() => handleDelete(t.id)}
                      onAddSubtask={() => {
                        setSubtaskFor(t.id);
                        setSubtaskTitle("");
                      }}
                    />
                    {/* Subtask composer */}
                    {subtaskFor === t.id && (
                      <div className="bg-muted/30 px-12 py-3 border-t border-border/60">
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            value={subtaskTitle}
                            onChange={(e) => setSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSubtask(t.id);
                              }
                              if (e.key === "Escape") setSubtaskFor(null);
                            }}
                            placeholder="Subtask title…"
                            className="h-9"
                            data-testid={`input-subtask-${t.id}`}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddSubtask(t.id)}
                            disabled={!subtaskTitle.trim()}
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setSubtaskFor(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Subtasks */}
                    {isOpen && kids.length > 0 && (
                      <ul className="bg-muted/20 border-t border-border/60">
                        {kids.map((k) => (
                          <li key={k.id} className="border-b border-border/40 last:border-b-0">
                            <TaskRow
                              task={k}
                              isSubtask
                              onToggleDone={() => toggleDone(k)}
                              onEdit={() => setEditingId(k.id)}
                              onDelete={() => handleDelete(k.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <EditTaskDialog
        task={editingTask}
        open={editingTask != null}
        onOpenChange={(o) => !o && setEditingId(null)}
        onSave={async (patch) => {
          if (!editingTask) return;
          try {
            await updateMut.mutateAsync({ id: editingTask.id, data: patch });
            invalidate();
            setEditingId(null);
          } catch (err) {
            toast({
              title: "Could not save",
              description: err instanceof Error ? err.message : "Unknown error",
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  isSubtask = false,
  hasChildren = false,
  isOpen = false,
  childCount = 0,
  doneChildCount = 0,
  onToggleDone,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  task: Task;
  isSubtask?: boolean;
  hasChildren?: boolean;
  isOpen?: boolean;
  childCount?: number;
  doneChildCount?: number;
  onToggleDone: () => void;
  onToggleExpand?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubtask?: () => void;
}) {
  const done = task.status === "done";
  const priority = (task.priority as Priority) ?? "medium";
  const status = (task.status as Status) ?? "todo";

  // Due-date badge with smart coloring
  const dueBadge = task.dueDate
    ? (() => {
        const d = parseISO(task.dueDate);
        const cls = dueClassification(task.dueDate);
        const today = cls === "today";
        const overdue = cls === "overdue" && !done;
        const klass = done
          ? "bg-muted text-muted-foreground border-border"
          : overdue
            ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
            : today
              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
              : "bg-sky-500/10 text-sky-700 border-sky-500/20";
        return (
          <Badge variant="outline" className={`${klass} gap-1 text-[10px]`}>
            <CalendarDays className="h-3 w-3" />
            {today ? "Today" : format(d, "MMM d")}
          </Badge>
        );
      })()
    : null;

  return (
    <div
      className={`group flex items-start gap-3 ${
        isSubtask ? "px-12 py-2.5" : "px-4 md:px-5 py-3.5"
      } hover:bg-muted/40 transition-colors`}
    >
      {/* Expand chevron (top-level w/ children only) */}
      {!isSubtask && (
        <button
          type="button"
          onClick={onToggleExpand}
          className={`mt-0.5 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors ${
            hasChildren ? "" : "invisible"
          }`}
          aria-label={isOpen ? "Collapse subtasks" : "Expand subtasks"}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      )}

      {/* Checkbox */}
      <Checkbox
        checked={done}
        onCheckedChange={onToggleDone}
        className="mt-0.5"
        aria-label={done ? "Mark not done" : "Mark done"}
        data-testid={`checkbox-task-${task.id}`}
      />

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center flex-wrap gap-2">
          <span
            className={`text-sm font-medium ${
              done ? "line-through text-muted-foreground" : "text-foreground"
            }`}
          >
            {task.title}
          </span>
          {!done && (
            <Badge
              variant="outline"
              className={`${PRIORITY_META[priority].classes} text-[10px] gap-1`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[priority].dot}`}
              />
              {PRIORITY_META[priority].label}
            </Badge>
          )}
          {status === "in_progress" && (
            <Badge variant="outline" className={`${STATUS_META.in_progress.classes} text-[10px]`}>
              {STATUS_META.in_progress.label}
            </Badge>
          )}
          {dueBadge}
          {hasChildren && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <ListTodo className="h-3 w-3" />
              {doneChildCount}/{childCount}
            </Badge>
          )}
          {priority === "high" && !done && (
            <Flame className="h-3.5 w-3.5 text-rose-500" />
          )}
        </div>
        {task.notes && (
          <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <p className="line-clamp-2 whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}
      </div>

      {/* Actions — always visible so they work on touch devices too */}
      <div className="flex items-center gap-0.5">
        {onAddSubtask && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs gap-1 hidden md:inline-flex"
            onClick={onAddSubtask}
            data-testid={`button-add-subtask-${task.id}`}
          >
            <Plus className="h-3.5 w-3.5" /> Subtask
          </Button>
        )}
        {onAddSubtask && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 md:hidden"
            onClick={onAddSubtask}
            aria-label="Add subtask"
            data-testid={`button-add-subtask-mobile-${task.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label="Edit task"
          data-testid={`button-edit-task-${task.id}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300"
          onClick={onDelete}
          aria-label="Delete task"
          data-testid={`button-delete-task-${task.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EditTaskDialog({
  task,
  open,
  onOpenChange,
  onSave,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: {
    title?: string;
    notes?: string | null;
    status?: Status;
    priority?: Priority;
    dueDate?: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<string>("");

  // Sync form when the task changes / dialog opens
  React.useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
      setStatus((task.status as Status) ?? "todo");
      setPriority((task.priority as Priority) ?? "medium");
      setDueDate(task.dueDate ?? "");
    }
  }, [task]);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes / remarks</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any details, links or remarks…"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                title: title.trim() || undefined,
                notes: notes.trim() ? notes.trim() : null,
                status,
                priority,
                dueDate: dueDate || null,
              })
            }
            disabled={!title.trim()}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACCENT: Record<
  string,
  { iconBg: string; ring: string; glow: string }
> = {
  indigo: {
    iconBg: "bg-gradient-to-br from-indigo-500 to-violet-500",
    ring: "ring-indigo-500/15",
    glow: "from-indigo-500/10",
  },
  emerald: {
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
    ring: "ring-emerald-500/15",
    glow: "from-emerald-500/10",
  },
  amber: {
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    ring: "ring-amber-500/15",
    glow: "from-amber-500/10",
  },
  rose: {
    iconBg: "bg-gradient-to-br from-rose-500 to-red-500",
    ring: "ring-rose-500/15",
    glow: "from-rose-500/10",
  },
};

function StatTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: keyof typeof ACCENT;
}) {
  const a = ACCENT[accent];
  return (
    <Card className="border-border/60 shadow-sm overflow-hidden relative group hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${a.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}
      />
      <CardContent className="p-4 relative">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div
            className={`h-8 w-8 rounded-lg ${a.iconBg} flex items-center justify-center shadow-sm`}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const map: Record<Filter, { title: string; hint: string; icon: React.ElementType }> = {
    all: {
      title: "No tasks yet",
      hint: "Add your first task above to get started.",
      icon: Inbox,
    },
    today: {
      title: "Nothing due today",
      hint: "You're all caught up. Plan ahead with the All tab.",
      icon: CheckCircle2,
    },
    upcoming: {
      title: "No upcoming tasks",
      hint: "Tasks with a future due date will show up here.",
      icon: CalendarDays,
    },
    done: {
      title: "Nothing completed yet",
      hint: "Tick a task off and it'll land here.",
      icon: Circle,
    },
  };
  const { title, hint, icon: Icon } = map[filter];
  return (
    <div className="text-center py-16 px-6">
      <div className="h-14 w-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}
