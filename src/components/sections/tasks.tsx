"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  SectionHeader,
  StatCard,
  EmptyState,
  Pill,
  Progress,
} from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api, formatDate, colorFor } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "todo" | "in_progress" | "done";

interface ChannelLite {
  id: string;
  name: string;
  color: string;
}
interface TeamLite {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
}
interface TaskWithRelations {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  category: string;
  progress: number;
  dueDate: string | null;
  reminder: string | null;
  channelId: string | null;
  channel: ChannelLite | null;
  assigneeId: string | null;
  assignee: TeamLite | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskForm {
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  category: string;
  progress: number;
  dueDate: string; // yyyy-MM-dd or ""
  reminder: string; // datetime-local string or ""
  channelId: string;
  assigneeId: string;
}

// ─── Constants & helpers ──────────────────────────────────────────────────────

const EMPTY_FORM: TaskForm = {
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  category: "general",
  progress: 0,
  dueDate: "",
  reminder: "",
  channelId: "",
  assigneeId: "",
};

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const STATUSES: Status[] = ["todo", "in_progress", "done"];

const STATUS_GROUPS: { key: Status; label: string; color: string; icon: string }[] = [
  { key: "todo", label: "To Do", color: "teal", icon: "circle" },
  { key: "in_progress", label: "In Progress", color: "amber", icon: "refresh" },
  { key: "done", label: "Done", color: "emerald", icon: "check-circle" },
];

const PRIORITY_META: Record<
  Priority,
  { color: "rose" | "amber" | "teal" | "muted"; icon: string; label: string }
> = {
  urgent: { color: "rose", icon: "alert-triangle", label: "Urgent" },
  high: { color: "amber", icon: "flame", label: "High" },
  medium: { color: "teal", icon: "circle-dot", label: "Medium" },
  low: { color: "muted", icon: "circle", label: "Low" },
};

function priorityProgressColor(p: Priority): string {
  switch (p) {
    case "urgent":
      return "rose";
    case "high":
      return "amber";
    case "medium":
      return "teal";
    default:
      return "emerald";
  }
}

function toDateInputValue(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateTimeLocalValue(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function isOverdue(t: TaskWithRelations): boolean {
  if (!t.dueDate || t.status === "done") return false;
  return new Date(t.dueDate).getTime() < Date.now();
}

function dueLabel(t: TaskWithRelations): { text: string; tone: "rose" | "muted" | "emerald" } {
  if (!t.dueDate) return { text: "No due date", tone: "muted" };
  const date = new Date(t.dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0 && t.status !== "done")
    return { text: `Overdue · ${formatDate(date)}`, tone: "rose" };
  if (diffDays === 0) return { text: "Today", tone: "amber" as never };
  if (diffDays === 1) return { text: "Tomorrow", tone: "amber" as never };
  if (diffDays > 0 && diffDays <= 7) return { text: `In ${diffDays}d`, tone: "emerald" };
  return { text: formatDate(date), tone: "muted" };
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function PriorityPill({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  if (meta.color === "muted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Icon name={meta.icon} className="size-3" />
        {meta.label}
      </span>
    );
  }
  return (
    <Pill color={meta.color} icon={meta.icon}>
      {meta.label}
    </Pill>
  );
}

function StatusCircle({
  status,
  onClick,
}: {
  status: Status;
  onClick: () => void;
}) {
  if (status === "done") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className="size-5 rounded-full bg-emerald-500 grid place-items-center hover:scale-110 transition-transform shrink-0 shadow-sm shadow-emerald-500/30"
            aria-label="Cycle status"
          >
            <Icon name="check" className="size-3 text-white" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Done — click to reset</TooltipContent>
      </Tooltip>
    );
  }
  if (status === "in_progress") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className="size-5 rounded-full border-2 border-amber-500 bg-amber-500/15 hover:scale-110 transition-transform shrink-0"
            aria-label="Cycle status"
          />
        </TooltipTrigger>
        <TooltipContent>In progress — click to complete</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="size-5 rounded-full border-2 border-muted-foreground/30 hover:border-amber-500 hover:scale-110 transition-transform shrink-0"
          aria-label="Cycle status"
        />
      </TooltipTrigger>
      <TooltipContent>To do — click to start</TooltipContent>
    </Tooltip>
  );
}

function Avatar({
  name,
  url,
  role,
}: {
  name: string;
  url?: string;
  role?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="size-6 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 grid place-items-center text-[10px] font-semibold text-white ring-2 ring-background overflow-hidden">
      {url ? (
        <img
          src={url}
          alt={name}
          className="size-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
      {role && (
        <span className="sr-only">Assignee: {name} — {role}</span>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TasksSection() {
  const [tasks, setTasks] = React.useState<TaskWithRelations[]>([]);
  const [team, setTeam] = React.useState<TeamLite[]>([]);
  const [channels, setChannels] = React.useState<ChannelLite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<"list" | "board">("list");

  const [filters, setFilters] = React.useState({
    q: "",
    status: "all" as "all" | Status,
    priority: "all" as "all" | Priority,
    category: "all",
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TaskWithRelations | null>(null);
  const [form, setForm] = React.useState<TaskForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // ── Load team (resilient — /api/team may not exist yet) ──────────────────────
  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<
          { team?: TeamLite[] } | TeamLite[]
        >("/api/team");
        const list = Array.isArray(data)
          ? data
          : data.team ?? [];
        setTeam(list);
      } catch {
        setTeam([]);
      }
    })();
  }, []);

  // ── Load channels (resilient) ────────────────────────────────────────────────
  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ channels: ChannelLite[] }>("/api/channels");
        setChannels(data.channels ?? []);
      } catch {
        setChannels([]);
      }
    })();
  }, []);

  // ── Load tasks (debounced for search) ───────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.priority !== "all") params.set("priority", filters.priority);
      if (filters.category !== "all") params.set("category", filters.category);
      const qs = params.toString();
      const data = await api<{ tasks: TaskWithRelations[] }>(
        `/api/tasks${qs ? `?${qs}` : ""}`
      );
      // Client-side search filter (q)
      const q = filters.q.trim().toLowerCase();
      const list = q
        ? data.tasks.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q) ||
              t.category.toLowerCase().includes(q)
          )
        : data.tasks;
      setTasks(list);
    } catch (e) {
      console.error("Failed to load tasks", e);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.priority, filters.category, filters.q]);

  const firstRun = React.useRef(true);
  const qTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      load();
      return;
    }
    if (qTimeout.current) clearTimeout(qTimeout.current);
    qTimeout.current = setTimeout(() => {
      load();
    }, 240);
    return () => {
      if (qTimeout.current) clearTimeout(qTimeout.current);
    };
  }, [load]);

  // ── Derived: distinct categories for filter ────────────────────────────────
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => set.add(t.category || "general"));
    return Array.from(set).sort();
  }, [tasks]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter(isOverdue).length;

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.category !== "all";

  // ── Quick toggle: cycle status ─────────────────────────────────────────────
  const cycleStatus = (task: TaskWithRelations) => {
    const next: Status =
      task.status === "todo"
        ? "in_progress"
        : task.status === "in_progress"
          ? "done"
          : "todo";

    const optimisticProgress =
      next === "done" ? 100 : next === "todo" ? 0 : task.progress || 30;

    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: next, progress: optimisticProgress }
          : t
      )
    );

    api(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    })
      .then(() => {
        const label =
          next === "done"
            ? "completed"
            : next === "in_progress"
              ? "in progress"
              : "to do";
        toast.success(`Marked ${label}`);
      })
      .catch(() => {
        setTasks(previous);
        toast.error("Failed to update task");
      });
  };

  // ── Dialog: create / edit ────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (t: TaskWithRelations) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      category: t.category || "general",
      progress: t.progress,
      dueDate: toDateInputValue(t.dueDate),
      reminder: toDateTimeLocalValue(t.reminder),
      channelId: t.channelId ?? "",
      assigneeId: t.assigneeId ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error("Task title is required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title,
        description: form.description.trim(),
        priority: form.priority,
        status: form.status,
        category: form.category.trim() || "general",
        progress: form.progress,
        dueDate: form.dueDate || null,
        reminder: form.reminder || null,
        channelId: form.channelId || null,
        assigneeId: form.assigneeId || null,
      };
      if (editing) {
        await api(`/api/tasks/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Task updated");
      } else {
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Task created");
      }
      closeDialog();
      await load();
    } catch (e) {
      console.error(e);
      toast.error(editing ? "Failed to update task" : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (id: string) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(id);
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      toast.success("Task deleted");
      await load();
    } catch (e) {
      console.error(e);
      setTasks(previous);
      toast.error("Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () =>
    setFilters({ q: "", status: "all", priority: "all", category: "all" });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Tasks"
        description="Stay on top of every moving piece"
        icon="check-square"
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Icon name="plus" className="size-4" />
            New Task
          </Button>
        }
      />

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Tasks"
          value={totalTasks}
          icon="list-checks"
          color="emerald"
          hint="All open + closed"
          delay={0}
        />
        <StatCard
          label="In Progress"
          value={inProgress}
          icon="refresh"
          color="amber"
          hint="Active right now"
          delay={0.05}
        />
        <StatCard
          label="Completed"
          value={doneCount}
          icon="check-circle"
          color="teal"
          hint="Done & dusted"
          delay={0.1}
        />
        <StatCard
          label="Overdue"
          value={overdue}
          icon="alert-triangle"
          color="rose"
          hint={overdue > 0 ? "Needs attention" : "All clear"}
          delay={0.15}
        />
      </div>

      {/* ── Filter bar ── */}
      <Card className="glass p-3 sm:p-4 border-border/60">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1 min-w-0">
              <Icon
                name="search"
                className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <Input
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value }))
                }
                placeholder="Search tasks by title, description, or category…"
                className="pl-9 bg-background/60"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex gap-2">
              <Select
                value={filters.status}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, status: v as typeof f.status }))
                }
              >
                <SelectTrigger className="w-full lg:w-[140px] bg-background/60">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.priority}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    priority: v as typeof f.priority,
                  }))
                }
              >
                <SelectTrigger className="w-full lg:w-[140px] bg-background/60">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priority</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.category}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, category: v }))
                }
              >
                <SelectTrigger className="w-full lg:w-[160px] bg-background/60">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {filtersActive ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearFilters}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Icon name="x" className="size-3.5" />
                  Clear
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {totalTasks} task{totalTasks === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {/* View toggle */}
            <div className="inline-flex items-center rounded-lg border border-border/60 bg-background/60 p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  view === "list"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon name="list-checks" className="size-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  view === "board"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon name="kanban-square" className="size-3.5" />
                Board
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Body ── */}
      {loading ? (
        <TaskListSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="check-square"
          title={filtersActive ? "No tasks match" : "No tasks yet"}
          description={
            filtersActive
              ? "Try adjusting your filters or clearing them to see everything."
              : "Create your first task to start tracking your work."
          }
          action={
            <Button onClick={openCreate} className="gap-1.5">
              <Icon name="plus" className="size-4" />
              New Task
            </Button>
          }
        />
      ) : view === "list" ? (
        <ListView
          tasks={tasks}
          onCycle={cycleStatus}
          onEdit={openEdit}
          onDelete={removeTask}
          deletingId={deletingId}
        />
      ) : (
        <BoardView
          tasks={tasks}
          onEdit={openEdit}
          onCycle={cycleStatus}
        />
      )}

      {/* ── Create/Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit task" : "New task"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details below and save your changes."
                : "Capture the work — be specific so future-you knows exactly what to do."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title">
                Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Record voice over — finance video"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="What needs to be done? Add links, notes, context…"
                rows={3}
              />
            </div>

            <Separator />

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as Status }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s === "in_progress" ? "In Progress" : s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, priority: v as Priority }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="task-category">Category</Label>
              <Input
                id="task-category"
                list="task-category-options"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="e.g. Scripting, SEO, Finance"
              />
              <datalist id="task-category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <Separator />

            {/* Progress slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Progress</Label>
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {form.progress}%
                </span>
              </div>
              <Slider
                value={[form.progress]}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, progress: v[0] ?? 0 }))
                }
                min={0}
                max={100}
                step={5}
              />
              <Progress
                value={form.progress}
                color={priorityProgressColor(form.priority)}
              />
            </div>

            <Separator />

            {/* Due date + Reminder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-reminder">Reminder</Label>
                <Input
                  id="task-reminder"
                  type="datetime-local"
                  value={form.reminder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reminder: e.target.value }))
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Channel + Assignee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select
                  value={form.channelId || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      channelId: v === "__none__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No channel</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Select
                  value={form.assigneeId || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      assigneeId: v === "__none__" ? "" : v,
                    }))
                  }
                  disabled={team.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        team.length === 0 ? "No team members" : "Unassigned"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {m.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {editing && (
              <Button
                variant="destructive"
                onClick={() => {
                  removeTask(editing.id);
                  closeDialog();
                }}
                className="mr-auto"
                disabled={saving}
              >
                <Icon name="trash" className="size-4" />
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || !form.title.trim()}>
              {saving ? (
                <>
                  <Icon name="refresh" className="size-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Create task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── List view ─────────────────────────────────────────────────────────────────

function ListView({
  tasks,
  onCycle,
  onEdit,
  onDelete,
  deletingId,
}: {
  tasks: TaskWithRelations[];
  onCycle: (t: TaskWithRelations) => void;
  onEdit: (t: TaskWithRelations) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const grouped = React.useMemo(() => {
    const map: Record<Status, TaskWithRelations[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    tasks.forEach((t) => map[t.status].push(t));
    return map;
  }, [tasks]);

  return (
    <div className="space-y-5">
      {STATUS_GROUPS.map((group, gi) => {
        const items = grouped[group.key];
        if (items.length === 0) return null;
        return (
          <motion.section
            key={group.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.04 }}
          >
            <div className="flex items-center gap-2 mb-2 px-1">
              <span
                className={cn(
                  "size-2 rounded-full",
                  colorFor(group.color).bg
                )}
              />
              <h3 className="text-sm font-semibold tracking-tight">
                {group.label}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {items.length}
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((t, i) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ delay: i * 0.02, duration: 0.18 }}
                  >
                    <TaskRow
                      task={t}
                      onCycle={() => onCycle(t)}
                      onEdit={() => onEdit(t)}
                      onDelete={() => onDelete(t.id)}
                      isDeleting={deletingId === t.id}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}

function TaskRow({
  task,
  onCycle,
  onEdit,
  onDelete,
  isDeleting,
}: {
  task: TaskWithRelations;
  onCycle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const due = dueLabel(task);
  const overdue = isOverdue(task);
  const channelColor = task.channel
    ? colorFor(task.channel.color).dot
    : "bg-muted-foreground/40";

  return (
    <Card
      className={cn(
        "group relative p-3 sm:p-4 border-border/60 transition-all hover:border-border hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20",
        overdue && "border-rose-500/40 dark:border-rose-500/30",
        task.status === "done" && "opacity-70",
        isDeleting && "opacity-40"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <StatusCircle status={task.status} onClick={onCycle} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Title + meta row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              className="text-left min-w-0"
            >
              <p
                className={cn(
                  "font-medium leading-tight truncate hover:text-primary transition-colors",
                  task.status === "done" && "line-through text-muted-foreground"
                )}
              >
                {task.title}
              </p>
            </button>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <PriorityPill priority={task.priority} />
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Icon name="folder-open" className="size-3" />
                {task.category || "general"}
              </span>
            </div>
          </div>

          {/* Description preview */}
          {task.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
              {task.description}
            </p>
          )}

          {/* Footer: due / progress / assignee / channel */}
          <div className="mt-2.5 flex items-center gap-3 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium",
                due.tone === "rose" &&
                  "text-rose-600 dark:text-rose-400",
                due.tone === "amber" &&
                  "text-amber-600 dark:text-amber-400",
                due.tone === "emerald" &&
                  "text-emerald-600 dark:text-emerald-400",
                due.tone === "muted" && "text-muted-foreground"
              )}
            >
              <Icon
                name={overdue ? "alert-triangle" : "calendar-days"}
                className="size-3"
              />
              {due.text}
            </span>

            {task.channel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("size-2 rounded-full", channelColor)} />
                    {task.channel.name}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Linked channel</TooltipContent>
              </Tooltip>
            )}

            {task.progress > 0 && task.status !== "done" && (
              <div className="flex items-center gap-1.5 min-w-[80px] flex-1 max-w-[140px]">
                <div className="flex-1">
                  <Progress
                    value={task.progress}
                    color={priorityProgressColor(task.priority)}
                  />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums w-7 text-right">
                  {task.progress}%
                </span>
              </div>
            )}

            {task.reminder && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Icon name="bell" className="size-3" />
                    {formatDate(task.reminder)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Reminder set</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Right side: assignee + menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {task.assignee && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Avatar
                    name={task.assignee.name}
                    url={task.assignee.avatarUrl}
                    role={task.assignee.role}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {task.assignee.name} · {task.assignee.role}
              </TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              >
                <Icon name="more-horizontal" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onEdit} className="gap-2">
                <Icon name="edit" className="size-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onCycle}
                className="gap-2"
              >
                <Icon name="refresh" className="size-3.5" />
                Cycle status
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-rose-600 dark:text-rose-400 focus:text-rose-700 dark:focus:text-rose-300"
              >
                <Icon name="trash" className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

// ─── Board view ───────────────────────────────────────────────────────────────

function BoardView({
  tasks,
  onEdit,
  onCycle,
}: {
  tasks: TaskWithRelations[];
  onEdit: (t: TaskWithRelations) => void;
  onCycle: (t: TaskWithRelations) => void;
}) {
  const grouped = React.useMemo(() => {
    const map: Record<Status, TaskWithRelations[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    tasks.forEach((t) => map[t.status].push(t));
    return map;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      {STATUS_GROUPS.map((group, gi) => {
        const items = grouped[group.key];
        const c = colorFor(group.color);
        return (
          <motion.div
            key={group.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.06 }}
            className="flex flex-col"
          >
            <Card className="glass flex-1 flex flex-col border-border/60 overflow-hidden">
              {/* Column header */}
              <div
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/60",
                  "bg-gradient-to-r",
                  group.color === "amber"
                    ? "from-amber-500/10"
                    : group.color === "teal"
                      ? "from-teal-500/10"
                      : "from-emerald-500/10",
                  "to-transparent"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("size-2 rounded-full", c.bg)} />
                  <span className="text-sm font-semibold truncate">
                    {group.label}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground tabular-nums bg-muted/60 rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2.5 space-y-2 max-h-[60vh] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="h-24 rounded-xl border border-dashed border-border/60 grid place-items-center text-[11px] text-muted-foreground">
                    No tasks here
                  </div>
                ) : (
                  items.map((t, i) => (
                    <motion.button
                      key={t.id}
                      type="button"
                      onClick={() => onEdit(t)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      whileHover={{ y: -2 }}
                      className={cn(
                        "group w-full text-left rounded-xl p-3 border bg-card/80 backdrop-blur transition-all hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20",
                        isOverdue(t)
                          ? "border-rose-500/40 dark:border-rose-500/30"
                          : "border-border/60 hover:border-border"
                      )}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onCycle(t);
                          }}
                          className="pt-0.5 shrink-0"
                          role="button"
                          tabIndex={0}
                        >
                          <StatusCircle
                            status={t.status}
                            onClick={() => onCycle(t)}
                          />
                        </span>
                        <p
                          className={cn(
                            "text-sm font-medium leading-snug flex-1 min-w-0",
                            t.status === "done" &&
                              "line-through text-muted-foreground"
                          )}
                        >
                          {t.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <PriorityPill priority={t.priority} />
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {t.category || "general"}
                        </span>
                      </div>

                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {t.description}
                        </p>
                      )}

                      {t.progress > 0 && t.status !== "done" && (
                        <div className="mb-2">
                          <Progress
                            value={t.progress}
                            color={priorityProgressColor(t.priority)}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-medium",
                            isOverdue(t)
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                          )}
                        >
                          <Icon
                            name={
                              isOverdue(t) ? "alert-triangle" : "calendar-days"
                            }
                            className="size-3"
                          />
                          {dueLabel(t).text}
                        </span>
                        {t.assignee && (
                          <Avatar
                            name={t.assignee.name}
                            url={t.assignee.avatarUrl}
                            role={t.assignee.role}
                          />
                        )}
                      </div>

                      {t.channel && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              colorFor(t.channel.color).dot
                            )}
                          />
                          {t.channel.name}
                        </div>
                      )}
                    </motion.button>
                  ))
                )}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TaskListSkeleton() {
  const groups = [0, 1, 2];
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="size-2 rounded-full bg-muted shimmer" />
            <div className="h-3 w-20 rounded bg-muted shimmer" />
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: g === 0 ? 4 : 2 }).map((_, i) => (
              <Card
                key={i}
                className="p-3 sm:p-4 border-border/60"
              >
                <div className="flex items-start gap-3">
                  <div className="size-5 rounded-full bg-muted shimmer shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-muted shimmer" />
                    <div className="h-3 w-1/3 rounded bg-muted shimmer" />
                    <div className="h-1.5 w-1/2 rounded-full bg-muted shimmer" />
                  </div>
                  <div className="size-7 rounded bg-muted shimmer" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
