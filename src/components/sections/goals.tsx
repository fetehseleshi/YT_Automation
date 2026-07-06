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
import { api, formatNumber, formatMoney, colorFor } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ─── Types ───────────────────────────────────────────────────────────────────

type GoalType = "yearly" | "subscriber" | "revenue" | "upload" | "daily_habit";

interface Goal {
  id: string;
  title: string;
  type: GoalType;
  target: number;
  current: number;
  period: string;
  unit: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface Habit {
  id: string;
  name: string;
  streak: number;
  goal: number; // per week
  history: string; // JSON array of ISO yyyy-mm-dd strings
  color: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Static config ───────────────────────────────────────────────────────────

const PALETTE = ["emerald", "amber", "rose", "teal", "orange"] as const;

const GOAL_TYPES: { value: GoalType; label: string; icon: string; color: string }[] = [
  { value: "yearly", label: "Yearly", icon: "target", color: "emerald" },
  { value: "subscriber", label: "Subscriber", icon: "users", color: "teal" },
  { value: "revenue", label: "Revenue", icon: "dollar", color: "amber" },
  { value: "upload", label: "Upload", icon: "upload", color: "rose" },
  { value: "daily_habit", label: "Daily Habit", icon: "flame", color: "orange" },
];

const goalTypeMeta = (t: GoalType) =>
  GOAL_TYPES.find((g) => g.value === t) ?? GOAL_TYPES[0];

/** Hex stroke color for the progress ring by palette name. */
const HEX: Record<string, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  teal: "#14b8a6",
  orange: "#f97316",
};

const hexFor = (color: string) => HEX[color] ?? HEX.emerald;

// ─── Date helpers (local time) ───────────────────────────────────────────────

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDays(today = new Date()): Date[] {
  const day = today.getDay(); // 0=Sun … 6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(today.getDate() + diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseHistory(history: string): Set<string> {
  try {
    const parsed = JSON.parse(history || "[]");
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((d) => typeof d === "string"));
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

// ─── Progress Ring ───────────────────────────────────────────────────────────

function ProgressRing({
  pct,
  color,
  size = 132,
  strokeWidth = 11,
}: {
  pct: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - clamped / 100);
  const stroke = hexFor(color);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.75" />
            <stop offset="100%" stopColor={stroke} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted/40"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ring-grad-${color})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-bold tracking-tight tabular-nums">
            {Math.round(clamped)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            complete
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function GoalCardSkeleton() {
  return (
    <Card className="relative overflow-hidden p-5 border-border/60">
      <div className="shimmer h-5 w-2/3 rounded mb-4" />
      <div className="flex items-center gap-4">
        <div className="shimmer size-32 rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="shimmer h-3 w-full rounded" />
          <div className="shimmer h-3 w-1/2 rounded" />
          <div className="shimmer h-2 w-3/4 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

function HabitCardSkeleton() {
  return (
    <Card className="relative overflow-hidden p-5 border-border/60">
      <div className="shimmer h-5 w-1/3 rounded mb-4" />
      <div className="shimmer h-10 w-full rounded mb-3" />
      <div className="flex justify-between">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="shimmer size-9 rounded-full" />
        ))}
      </div>
    </Card>
  );
}

// ─── Goal Card ───────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onUpdateCurrent,
}: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateCurrent: (next: number) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(String(goal.current));
  const [saving, setSaving] = React.useState(false);

  const meta = goalTypeMeta(goal.type);
  const pct = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
  const isMoney = goal.unit === "$";

  const display = (n: number) =>
    isMoney ? formatMoney(n) : formatNumber(n);

  const unitLabel = isMoney ? "" : goal.unit ? ` ${goal.unit}` : "";

  const commit = async () => {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Please enter a valid number");
      setDraft(String(goal.current));
      setEditing(false);
      return;
    }
    setEditing(false);
    if (next === goal.current) return;
    setSaving(true);
    try {
      await onUpdateCurrent(next);
    } finally {
      setSaving(false);
    }
  };

  const step = (delta: number) => {
    const next = Math.max(0, goal.current + delta);
    setDraft(String(next));
    setSaving(true);
    onUpdateCurrent(next).finally(() => setSaving(false));
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      className="lift"
    >
      <Card className="relative overflow-hidden p-5 sm:p-6 border-border/60">
        <div
          className="absolute -top-12 -right-12 size-40 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: hexFor(goal.color) }}
        />
        {/* Header */}
        <div className="flex items-start justify-between gap-3 relative">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Pill color={meta.color} icon={meta.icon}>
                {meta.label}
              </Pill>
              {pct >= 100 && (
                <Pill color="emerald" icon="check-circle">
                  Achieved
                </Pill>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-semibold leading-snug line-clamp-2">
              {goal.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Icon name="clock" className="size-3" />
              {goal.period}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 -mr-1.5 -mt-1.5 shrink-0">
                <Icon name="more-horizontal" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={onEdit}>
                <Icon name="edit" className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => step(Math.max(1, Math.round(goal.target * 0.05)))}
              >
                <Icon name="arrow-up-right" className="size-4" />
                Quick +5%
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:dark:text-rose-400"
              >
                <Icon name="trash" className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Ring + metrics */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-5 relative">
          <ProgressRing pct={pct} color={goal.color} />
          <div className="flex-1 w-full min-w-0">
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Progress
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
                  <span
                    className="text-xl font-bold tabular-nums"
                    style={{ color: hexFor(goal.color) }}
                  >
                    {display(goal.current)}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    / {display(goal.target)}{unitLabel}
                  </span>
                </div>
              </div>
              {saving && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  saving…
                </span>
              )}
            </div>

            <div className="mt-3">
              <Progress value={pct} color={goal.color} />
            </div>

            {/* Quick update */}
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => step(-Math.max(1, Math.round(goal.target * 0.05)))}
                disabled={saving}
                aria-label="Decrease progress"
              >
                <Icon name="chevron-down" className="size-4" />
              </Button>

              {editing ? (
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commit();
                    }
                    if (e.key === "Escape") {
                      setDraft(String(goal.current));
                      setEditing(false);
                    }
                  }}
                  type="number"
                  inputMode="decimal"
                  className="h-8 w-32 tabular-nums"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setDraft(String(goal.current));
                    setEditing(true);
                  }}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background hover:bg-accent text-xs font-medium transition-colors"
                >
                  <Icon name="edit" className="size-3.5" />
                  Update progress
                </button>
              )}

              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => step(Math.max(1, Math.round(goal.target * 0.05)))}
                disabled={saving}
                aria-label="Increase progress"
              >
                <Icon name="chevron-right" className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Habit Card ──────────────────────────────────────────────────────────────

function HabitCard({
  habit,
  onEdit,
  onDelete,
  onToggleToday,
  onToggleDay,
}: {
  habit: Habit;
  onEdit: () => void;
  onDelete: () => void;
  onToggleToday: () => Promise<void>;
  onToggleDay: (iso: string) => Promise<void>;
}) {
  const weekDays = React.useMemo(() => getWeekDays(), []);
  const todayISO = toISODate(new Date());
  const historySet = React.useMemo(() => parseHistory(habit.history), [habit.history]);
  const doneThisWeek = weekDays.filter((d) => historySet.has(toISODate(d))).length;
  const weeklyPct = habit.goal > 0 ? (doneThisWeek / habit.goal) * 100 : 0;
  const streakColor = habit.streak >= 5 ? "rose" : habit.streak > 0 ? "amber" : "muted";

  const c = colorFor(habit.color);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      className="lift"
    >
      <Card className="relative overflow-hidden p-5 border-border/60">
        <div
          className="absolute -top-12 -right-12 size-32 rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: hexFor(habit.color) }}
        />
        {/* Header */}
        <div className="flex items-start justify-between gap-3 relative">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn("size-9 rounded-lg grid place-items-center shrink-0", c.soft)}>
              <Icon name="flame" className="size-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-tight truncate">
                {habit.name}
              </h3>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold",
                    streakColor === "rose"
                      ? "text-rose-600 dark:text-rose-400"
                      : streakColor === "amber"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon name="flame" className="size-3.5" />
                  {habit.streak}-day streak
                </span>
                <Separator orientation="vertical" className="h-3.5" />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {doneThisWeek}/{habit.goal} this week
                </span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 -mr-1.5 -mt-1.5 shrink-0">
                <Icon name="more-horizontal" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={onEdit}>
                <Icon name="edit" className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleToday}>
                <Icon name="check" className="size-4" />
                Toggle today
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:dark:text-rose-400"
              >
                <Icon name="trash" className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Week grid */}
        <div className="mt-4 flex items-center justify-between gap-1.5 relative">
          {weekDays.map((d, i) => {
            const iso = toISODate(d);
            const done = historySet.has(iso);
            const isToday = iso === todayISO;
            const isFuture = d.getTime() > new Date(todayISO).getTime();
            return (
              <button
                key={iso}
                onClick={() => onToggleDay(iso)}
                disabled={isFuture && !done}
                className={cn(
                  "group flex flex-col items-center gap-1.5 transition-opacity",
                  isFuture && !done && "opacity-40 cursor-not-allowed"
                )}
                aria-label={`${WEEKDAY_LABELS[i]} ${d.getDate()}${done ? " — done" : ""}`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {WEEKDAY_LABELS[i]}
                </span>
                <span
                  className={cn(
                    "size-9 sm:size-10 rounded-full grid place-items-center border transition-all",
                    done
                      ? cn(c.soft, "border-transparent font-semibold")
                      : "border-border/60 bg-background hover:border-primary/40",
                    isToday && !done && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
                    isToday && done && "ring-2 ring-offset-2 ring-offset-background"
                  )}
                  style={
                    isToday && done
                      ? { boxShadow: `0 0 0 2px ${hexFor(habit.color)}55` }
                      : undefined
                  }
                >
                  {done ? (
                    <Icon name="check" className="size-4.5" />
                  ) : (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {d.getDate()}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Weekly progress */}
        <div className="mt-4 relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Weekly goal</span>
            <span className="text-xs font-medium tabular-nums" style={{ color: hexFor(habit.color) }}>
              {Math.round(weeklyPct)}%
            </span>
          </div>
          <Progress value={weeklyPct} color={habit.color} />
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Create Goal Dialog ──────────────────────────────────────────────────────

interface GoalFormState {
  title: string;
  type: GoalType;
  target: string;
  current: string;
  period: string;
  unit: string;
  color: string;
}

const EMPTY_GOAL_FORM: GoalFormState = {
  title: "",
  type: "yearly",
  target: "100",
  current: "0",
  period: new Date().getFullYear().toString(),
  unit: "",
  color: "emerald",
};

function GoalDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Goal | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<GoalFormState>(EMPTY_GOAL_FORM);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          title: editing.title,
          type: editing.type,
          target: String(editing.target),
          current: String(editing.current),
          period: editing.period,
          unit: editing.unit,
          color: editing.color,
        });
      } else {
        setForm(EMPTY_GOAL_FORM);
      }
    }
  }, [open, editing]);

  const set = <K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Goal title is required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      type: form.type,
      target: Number(form.target) || 0,
      current: Number(form.current) || 0,
      period: form.period.trim() || new Date().getFullYear().toString(),
      unit: form.unit.trim(),
      color: form.color,
    };
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/goals/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Goal updated");
      } else {
        await api("/api/goals", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Goal created");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update your target and current progress."
              : "Define a measurable target to keep momentum."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="goal-title">
              Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="goal-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Reach 500K subscribers"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="goal-type">Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as GoalType)}>
                <SelectTrigger id="goal-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <Icon name={t.icon} className="size-4" />
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-color">Color</Label>
              <Select value={form.color} onValueChange={(v) => set("color", v)}>
                <SelectTrigger id="goal-color" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PALETTE.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: hexFor(p) }}
                      />
                      <span className="capitalize">{p}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="goal-target">Target</Label>
              <Input
                id="goal-target"
                type="number"
                inputMode="decimal"
                value={form.target}
                onChange={(e) => set("target", e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-current">Current</Label>
              <Input
                id="goal-current"
                type="number"
                inputMode="decimal"
                value={form.current}
                onChange={(e) => set("current", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="goal-period">Period</Label>
              <Input
                id="goal-period"
                value={form.period}
                onChange={(e) => set("period", e.target.value)}
                placeholder="2025"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-unit">Unit</Label>
              <Input
                id="goal-unit"
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="subs, $, videos, hours…"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Icon name="refresh" className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Create goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Habit Dialog ─────────────────────────────────────────────────────

interface HabitFormState {
  name: string;
  goal: string;
  color: string;
}

const EMPTY_HABIT_FORM: HabitFormState = {
  name: "",
  goal: "7",
  color: "emerald",
};

function HabitDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Habit | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<HabitFormState>(EMPTY_HABIT_FORM);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          goal: String(editing.goal),
          color: editing.color,
        });
      } else {
        setForm(EMPTY_HABIT_FORM);
      }
    }
  }, [open, editing]);

  const set = <K extends keyof HabitFormState>(key: K, value: HabitFormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Habit name is required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      goal: Math.max(1, Math.min(7, Number(form.goal) || 7)),
      color: form.color,
    };
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/habits/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Habit updated");
      } else {
        await api("/api/habits", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Habit created");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save habit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit habit" : "New habit"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update your habit details."
              : "Build a streak. Tiny actions compound."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="habit-name">
              Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="habit-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Write 1 script"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="habit-goal">Goal / week</Label>
              <Select value={form.goal} onValueChange={(v) => set("goal", v)}>
                <SelectTrigger id="habit-goal" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? "day" : "days"} / week
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="habit-color">Color</Label>
              <Select value={form.color} onValueChange={(v) => set("color", v)}>
                <SelectTrigger id="habit-color" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PALETTE.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: hexFor(p) }}
                      />
                      <span className="capitalize">{p}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Icon name="refresh" className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Create habit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Goals Section ───────────────────────────────────────────────────────────

export function GoalsSection() {
  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"goals" | "habits">("goals");

  const [goalDialogOpen, setGoalDialogOpen] = React.useState(false);
  const [habitDialogOpen, setHabitDialogOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<Goal | null>(null);
  const [editingHabit, setEditingHabit] = React.useState<Habit | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, hRes] = await Promise.all([
        api<{ goals: Goal[] }>("/api/goals"),
        api<{ habits: Habit[] }>("/api/habits"),
      ]);
      setGoals(gRes.goals ?? []);
      setHabits(hRes.habits ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load goals & habits");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // ─── Goal mutations ──────────────────────────────────────────────────────

  const patchGoal = async (id: string, patch: Partial<Goal>) => {
    const updated = await api<{ goal: Goal }>(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setGoals((prev) => prev.map((g) => (g.id === id ? updated.goal : g)));
    return updated.goal;
  };

  const updateGoalCurrent = (goal: Goal) => async (next: number) => {
    try {
      await patchGoal(goal.id, { current: next });
      toast.success("Progress updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update progress");
    }
  };

  const deleteGoal = async (goal: Goal) => {
    try {
      await api(`/api/goals/${goal.id}`, { method: "DELETE" });
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
      toast.success("Goal deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete goal");
    }
  };

  // ─── Habit mutations ─────────────────────────────────────────────────────

  const patchHabit = async (id: string, body: Record<string, unknown>) => {
    const updated = await api<{ habit: Habit }>(`/api/habits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setHabits((prev) => prev.map((h) => (h.id === id ? updated.habit : h)));
    return updated.habit;
  };

  const toggleToday = (habit: Habit) => async () => {
    // Optimistic local toggle for instant feedback.
    const todayISO = toISODate(new Date());
    const historySet = parseHistory(habit.history);
    const had = historySet.has(todayISO);
    if (had) historySet.delete(todayISO);
    else historySet.add(todayISO);

    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? { ...h, history: JSON.stringify(Array.from(historySet).sort()) }
          : h
      )
    );

    try {
      await patchHabit(habit.id, { toggleToday: true });
    } catch (e) {
      // Revert on error.
      setHabits((prev) =>
        prev.map((h) => (h.id === habit.id ? habit : h))
      );
      toast.error(e instanceof Error ? e.message : "Failed to toggle today");
    }
  };

  const toggleDay = (habit: Habit) => async (iso: string) => {
    // Only "today" is supported by the toggleToday endpoint — for past/future days
    // we fall back to a full history replacement.
    const todayISO = toISODate(new Date());
    if (iso === todayISO) {
      await toggleToday(habit)();
      return;
    }

    const historySet = parseHistory(habit.history);
    const had = historySet.has(iso);
    if (had) historySet.delete(iso);
    else historySet.add(iso);
    const nextHistory = Array.from(historySet).sort();

    // Optimistic update.
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id ? { ...h, history: JSON.stringify(nextHistory) } : h
      )
    );

    try {
      await patchHabit(habit.id, { history: nextHistory });
    } catch (e) {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
      toast.error(e instanceof Error ? e.message : "Failed to update habit");
    }
  };

  const deleteHabit = async (habit: Habit) => {
    try {
      await api(`/api/habits/${habit.id}`, { method: "DELETE" });
      setHabits((prev) => prev.filter((h) => h.id !== habit.id));
      toast.success("Habit deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete habit");
    }
  };

  // ─── Derived stats ───────────────────────────────────────────────────────

  const stats = React.useMemo(() => {
    const activeGoals = goals.length;
    const avgCompletion =
      goals.length > 0
        ? Math.round(
            goals.reduce((sum, g) => {
              const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
              return sum + Math.min(100, pct);
            }, 0) / goals.length
          )
        : 0;

    const weekDays = getWeekDays();
    const weekISOs = new Set(weekDays.map(toISODate));
    let habitsThisWeek = 0;
    let longestStreak = 0;
    for (const h of habits) {
      const hs = parseHistory(h.history);
      for (const iso of weekISOs) if (hs.has(iso)) habitsThisWeek++;
      if (h.streak > longestStreak) longestStreak = h.streak;
    }

    return { activeGoals, avgCompletion, habitsThisWeek, longestStreak };
  }, [goals, habits]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Goals"
        description="Set targets, track progress, build momentum"
        icon="target"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditingHabit(null);
                setHabitDialogOpen(true);
              }}
            >
              <Icon name="flame" className="size-4" />
              New Habit
            </Button>
            <Button
              onClick={() => {
                setEditingGoal(null);
                setGoalDialogOpen(true);
              }}
            >
              <Icon name="plus" className="size-4" />
              New Goal
            </Button>
          </>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Active Goals"
          value={stats.activeGoals}
          icon="target"
          color="emerald"
          hint="in progress"
          delay={0}
        />
        <StatCard
          label="Avg Completion"
          value={`${stats.avgCompletion}%`}
          icon="gauge"
          color="amber"
          hint="across all goals"
          delay={0.05}
        />
        <StatCard
          label="Habits This Week"
          value={stats.habitsThisWeek}
          icon="check-circle"
          color="teal"
          hint="check-ins logged"
          delay={0.1}
        />
        <StatCard
          label="Longest Streak"
          value={`${stats.longestStreak}d`}
          icon="flame"
          color="rose"
          hint="current best"
          delay={0.15}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "goals" | "habits")}>
        <TabsList>
          <TabsTrigger value="goals">
            <Icon name="target" className="size-4" />
            Yearly Goals
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {goals.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="habits">
            <Icon name="flame" className="size-4" />
            Daily Habits
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {habits.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Yearly Goals tab */}
        <TabsContent value="goals" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <GoalCardSkeleton key={i} />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <EmptyState
                icon="target"
                title="No goals yet"
                description="Define your first target — subscribers, revenue, uploads — and watch your momentum build."
                action={
                  <Button
                    onClick={() => {
                      setEditingGoal(null);
                      setGoalDialogOpen(true);
                    }}
                  >
                    <Icon name="plus" className="size-4" />
                    Create goal
                  </Button>
                }
              />
            </Card>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {goals.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    onEdit={() => {
                      setEditingGoal(g);
                      setGoalDialogOpen(true);
                    }}
                    onDelete={() => deleteGoal(g)}
                    onUpdateCurrent={updateGoalCurrent(g)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </TabsContent>

        {/* Daily Habits tab */}
        <TabsContent value="habits" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <HabitCardSkeleton key={i} />
              ))}
            </div>
          ) : habits.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <EmptyState
                icon="flame"
                title="No habits tracked"
                description="Start a daily ritual — script writing, reading, analytics review — and build an unbreakable streak."
                action={
                  <Button
                    onClick={() => {
                      setEditingHabit(null);
                      setHabitDialogOpen(true);
                    }}
                  >
                    <Icon name="plus" className="size-4" />
                    Create habit
                  </Button>
                }
              />
            </Card>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {habits.map((h) => (
                  <HabitCard
                    key={h.id}
                    habit={h}
                    onEdit={() => {
                      setEditingHabit(h);
                      setHabitDialogOpen(true);
                    }}
                    onDelete={() => deleteHabit(h)}
                    onToggleToday={toggleToday(h)}
                    onToggleDay={toggleDay(h)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        editing={editingGoal}
        onSaved={load}
      />
      <HabitDialog
        open={habitDialogOpen}
        onOpenChange={setHabitDialogOpen}
        editing={editingHabit}
        onSaved={load}
      />
    </div>
  );
}
