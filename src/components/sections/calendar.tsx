"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  format,
  parseISO,
} from "date-fns";

import { SectionHeader, StatCard, Pill, EmptyState, Progress } from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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

// ─── Types ────────────────────────────────────────────────────────────────────

/** Events derived from Cards / Videos / Tasks (read-only in the calendar UI). */
type DerivedType = "scheduled" | "published" | "task";

interface DerivedEvent {
  id: string;
  date: string; // ISO string
  title: string;
  type: DerivedType;
  source: "content" | "video" | "task";
  priority?: string;
}

interface DerivedResponse {
  events: DerivedEvent[];
  scheduledCount: number;
  publishedCount: number;
  taskCount: number;
}

/** Dedicated CalendarEvent rows (full CRUD). */
type EventType = "publish" | "meeting" | "deadline" | "reminder" | "upload";

interface CalendarEventRow {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate: string | null;
  type: EventType;
  channelId: string | null;
  channel?: { id: string; name: string; color: string } | null;
  color: string;
  reminder: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CalendarEventsResponse {
  events: CalendarEventRow[];
}

/** A unified event for display in the calendar grid + day panel. */
interface UnifiedEvent {
  id: string;
  date: string;
  title: string;
  // Discriminator
  kind: "derived" | "dedicated";
  // For derived events
  derivedType?: DerivedType;
  source?: "content" | "video" | "task";
  priority?: string;
  // For dedicated events
  dedicated?: CalendarEventRow;
}

interface ChannelLite {
  id: string;
  name: string;
  color: string;
}

// ─── Type styling ─────────────────────────────────────────────────────────────

const DERIVED_STYLE: Record<
  DerivedType,
  { color: string; label: string; dot: string; chip: string }
> = {
  scheduled: {
    color: "teal",
    label: "Scheduled",
    dot: "bg-teal-500",
    chip: "bg-teal-500/10 text-teal-600 dark:text-teal-300 hover:bg-teal-500/20",
  },
  published: {
    color: "emerald",
    label: "Published",
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20",
  },
  task: {
    color: "amber",
    label: "Task",
    dot: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20",
  },
};

const EVENT_TYPE_STYLE: Record<
  EventType,
  { label: string; icon: string }
> = {
  publish: { label: "Publish", icon: "youtube" },
  meeting: { label: "Meeting", icon: "users" },
  deadline: { label: "Deadline", icon: "alert-triangle" },
  reminder: { label: "Reminder", icon: "bell" },
  upload: { label: "Upload", icon: "upload" },
};

const COLOR_DOT: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
};

const COLOR_CHIP: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-300 hover:bg-teal-500/20",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-300 hover:bg-orange-500/20",
};

const COLOR_HEX: Record<string, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  teal: "#14b8a6",
  orange: "#f97316",
};

const PALETTE = ["emerald", "amber", "rose", "teal", "orange"] as const;
const EVENT_TYPES: EventType[] = ["publish", "meeting", "deadline", "reminder", "upload"];

const SOURCE_LABEL: Record<"content" | "video" | "task", string> = {
  content: "Planner card",
  video: "Video",
  task: "Task",
};

// ─── Publishing checklist ─────────────────────────────────────────────────────

const CHECKLIST_KEY = "publish-checklist";
const CHECKLIST_ITEMS: { label: string; icon: string }[] = [
  { label: "Thumbnail created", icon: "image" },
  { label: "Script finalized", icon: "file-text" },
  { label: "Voice over recorded", icon: "message" },
  { label: "Video edited", icon: "film" },
  { label: "SEO optimized (title/desc/tags)", icon: "trending-up" },
  { label: "End screen added", icon: "layout-grid" },
  { label: "Cards added", icon: "layout-grid" },
  { label: "Scheduled on YouTube", icon: "youtube" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MIGRATION_KEY = "calendar-events-loaded";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colorChip(color: string): string {
  return COLOR_CHIP[color] ?? COLOR_CHIP.emerald;
}

function colorDot(color: string): string {
  return COLOR_DOT[color] ?? COLOR_DOT.emerald;
}

function toLocalInput(d: Date): string {
  // Returns YYYY-MM-DDTHH:mm in local time, suitable for datetime-local input.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarSection() {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());
  const [data, setData] = React.useState<DerivedResponse | null>(null);
  const [dedicated, setDedicated] = React.useState<CalendarEventRow[]>([]);
  const [channels, setChannels] = React.useState<ChannelLite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEventRow | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Load checklist from localStorage once on mount.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_KEY);
      if (raw) setChecklist(JSON.parse(raw) as Record<string, boolean>);
      // Mark calendar-events-loaded flag so other agents can detect we've initialized.
      localStorage.setItem(MIGRATION_KEY, "1");
    } catch {
      /* ignore corrupted state */
    }
  }, []);

  // Load channels once.
  React.useEffect(() => {
    api<{ channels: ChannelLite[] } | ChannelLite[]>("/api/channels")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.channels ?? []);
        setChannels(list);
      })
      .catch(() => setChannels([]));
  }, []);

  const monthKey = format(currentMonth, "yyyy-MM");

  // Reload derived events when the visible month changes.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<DerivedResponse>(`/api/calendar?month=${monthKey}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error("Failed to load calendar", { description: msg });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [monthKey]);

  // Reload dedicated events when the visible month changes.
  const loadDedicated = React.useCallback(async () => {
    try {
      const res = await api<CalendarEventsResponse>(
        `/api/calendar-events?month=${monthKey}`
      );
      setDedicated(res.events ?? []);
    } catch (err: unknown) {
      // Non-fatal; derived events still render.
      const msg = err instanceof Error ? err.message : "";
      console.warn("[calendar] dedicated events load failed", msg);
    }
  }, [monthKey]);

  React.useEffect(() => {
    loadDedicated();
  }, [loadDedicated]);

  // Persist checklist to localStorage on every change.
  const updateChecklist = React.useCallback(
    (next: Record<string, boolean>) => {
      setChecklist(next);
      try {
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable (private mode); ignore */
      }
    },
    []
  );

  const toggleItem = (item: string) => {
    updateChecklist({ ...checklist, [item]: !checklist[item] });
  };

  const resetChecklist = () => {
    updateChecklist({});
    toast.success("Checklist reset", { description: "All items cleared." });
  };

  const goToToday = () => {
    const t = new Date();
    setCurrentMonth(t);
    setSelectedDate(t);
  };

  // Merge derived + dedicated events into a single UnifiedEvent[] keyed by day.
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, UnifiedEvent[]>();
    for (const ev of data?.events ?? []) {
      const dayKey = ev.date.slice(0, 10);
      const arr = map.get(dayKey) ?? [];
      arr.push({
        id: ev.id,
        date: ev.date,
        title: ev.title,
        kind: "derived",
        derivedType: ev.type,
        source: ev.source,
        priority: ev.priority,
      });
      map.set(dayKey, arr);
    }
    for (const ev of dedicated) {
      const dayKey = ev.date.slice(0, 10);
      const arr = map.get(dayKey) ?? [];
      arr.push({
        id: ev.id,
        date: ev.date,
        title: ev.title,
        kind: "dedicated",
        dedicated: ev,
      });
      map.set(dayKey, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [data, dedicated]);

  // Today's reminders (reminder within the next 24h).
  const remindersToday = React.useMemo(() => {
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    return dedicated
      .filter((e) => {
        if (!e.reminder) return false;
        const t = new Date(e.reminder).getTime();
        return t >= now && t <= in24h;
      })
      .sort((a, b) => (a.reminder ?? "").localeCompare(b.reminder ?? ""));
  }, [dedicated]);

  // 6×7 day grid covering the visible month.
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const today = new Date();
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedEvents = selectedKey
    ? (eventsByDay.get(selectedKey) ?? [])
    : [];

  const checklistDone = CHECKLIST_ITEMS.filter((i) => checklist[i.label]).length;
  const checklistPct = Math.round(
    (checklistDone / CHECKLIST_ITEMS.length) * 100
  );

  // ── Dialog handlers ─────────────────────────────────────────────────────────
  const openNewEvent = () => {
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const openEditEvent = (ev: CalendarEventRow) => {
    setEditingEvent(ev);
    setDialogOpen(true);
  };

  const handleEventSaved = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    loadDedicated();
  };

  const handleEventDeleted = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    loadDedicated();
  };

  // ── Drag end → move event to a new day ──────────────────────────────────────
  const onDragStart = (e: DragStartEvent) => {
    setDraggingId(String(e.active.id));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = e;
    if (!over) return;
    const eventId = String(active.id);
    const targetId = String(over.id);
    if (!targetId.startsWith("day:")) return;

    // Only dedicated events are draggable.
    const ev = dedicated.find((x) => x.id === eventId);
    if (!ev) return;

    const dayKey = targetId.slice(4); // YYYY-MM-DD
    const oldDate = new Date(ev.date);
    const newDate = new Date(dayKey);
    if (isNaN(newDate.getTime())) return;
    // Preserve time-of-day if possible.
    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);

    // Optimistic update.
    const prev = dedicated;
    setDedicated((d) =>
      d.map((x) =>
        x.id === ev.id ? { ...x, date: newDate.toISOString() } : x
      )
    );

    try {
      await api(`/api/calendar-events/${ev.id}`, {
        method: "PATCH",
        body: JSON.stringify({ date: newDate.toISOString() }),
      });
      toast.success(`Moved to ${format(newDate, "MMM d")}`);
      // Reload to pick up month-boundary changes.
      loadDedicated();
    } catch {
      setDedicated(prev);
      toast.error("Failed to move event");
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-5">
        <SectionHeader
          title="Content Calendar"
          description="Schedule and visualize your publishing pipeline"
          icon="calendar-days"
          actions={
            <div className="flex items-center gap-2">
              <Button onClick={openNewEvent} size="sm">
                <Icon name="plus" className="size-4" />
                <span className="ml-1 hidden sm:inline">Add Event</span>
              </Button>
              <div className="flex items-center gap-0.5 glass rounded-xl p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
                  aria-label="Previous month"
                >
                  <Icon name="chevron-right" className="size-4 rotate-180" />
                </Button>
                <span className="px-2 text-sm font-semibold min-w-[8.5rem] text-center tabular-nums">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                  aria-label="Next month"
                >
                  <Icon name="chevron-right" className="size-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday}>
                <Icon name="calendar-days" className="size-4" />
                <span className="ml-1 hidden sm:inline">Today</span>
              </Button>
            </div>
          }
        />

        {/* Reminders banner */}
        {remindersToday.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass border border-amber-500/30 rounded-2xl p-3 sm:p-4 flex items-start gap-3"
          >
            <div className="size-9 rounded-xl bg-amber-500/15 grid place-items-center shrink-0">
              <Icon name="bell" className="size-4 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                Reminders today
                <Badge variant="secondary" className="text-[10px] font-semibold tabular-nums h-5">
                  {remindersToday.length}
                </Badge>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {remindersToday.slice(0, 6).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => openEditEvent(e)}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                  >
                    <span className={cn("size-1.5 rounded-full", colorDot(e.color))} />
                    <span className="truncate max-w-[180px]">{e.title}</span>
                    <span className="tabular-nums opacity-70">
                      {format(parseISO(e.reminder!), "h:mm a")}
                    </span>
                  </button>
                ))}
                {remindersToday.length > 6 && (
                  <span className="text-[11px] text-muted-foreground self-center">
                    +{remindersToday.length - 6} more
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Scheduled"
            value={(data?.scheduledCount ?? 0) + dedicated.filter((e) => e.type === "publish" && !e.done).length}
            icon="clock"
            color="teal"
            hint="Cards + events scheduled"
            delay={0}
          />
          <StatCard
            label="Published"
            value={(data?.publishedCount ?? 0) + dedicated.filter((e) => e.done).length}
            icon="check-circle"
            color="emerald"
            hint="Videos & cards published"
            delay={0.05}
          />
          <StatCard
            label="Tasks Due"
            value={data?.taskCount ?? 0}
            icon="list-checks"
            color="amber"
            hint="Tasks due this month"
            delay={0.1}
          />
          <StatCard
            label="Events"
            value={dedicated.length}
            icon="calendar-days"
            color="rose"
            hint="Dedicated calendar events"
            delay={0.15}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium">Legend:</span>
          {(Object.keys(DERIVED_STYLE) as DerivedType[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", DERIVED_STYLE[t].dot)} />
              {DERIVED_STYLE[t].label}
            </span>
          ))}
          <span className="mx-1 hidden sm:inline text-border">|</span>
          {EVENT_TYPES.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <Icon name={EVENT_TYPE_STYLE[t].icon} className="size-3" />
              {EVENT_TYPE_STYLE[t].label}
            </span>
          ))}
          <span className="ml-auto hidden sm:inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full ring-2 ring-emerald-500/60" />
            Today
          </span>
        </div>

        {/* Main layout: calendar (left, 2/3) + side column (right, 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Calendar grid — desktop / tablet only */}
          <Card className="lg:col-span-2 glass border-border/60 p-3 sm:p-5 hidden md:block">
            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-1"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDay.get(key) ?? [];
                const isToday = isSameDay(day, today);
                const isSelected = selectedDate
                  ? isSameDay(day, selectedDate)
                  : false;
                const inMonth = isSameMonth(day, currentMonth);
                const visible = dayEvents.slice(0, 3);
                const overflow = dayEvents.length - visible.length;

                return (
                  <DayCell
                    key={key}
                    day={day}
                    dayKey={key}
                    dayEvents={visible}
                    overflow={overflow}
                    isToday={isToday}
                    isSelected={isSelected}
                    inMonth={inMonth}
                    index={i}
                    onSelect={() => setSelectedDate(day)}
                    onEditEvent={openEditEvent}
                  />
                );
              })}
            </div>

            {loading && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Icon name="refresh" className="size-3.5 animate-spin" />
                Loading events…
              </div>
            )}
          </Card>

          {/* Side panel */}
          <div className="space-y-5">
            <SelectedDayPanel
              selectedDate={selectedDate}
              events={selectedEvents}
              onClose={() => setSelectedDate(null)}
              onEditEvent={openEditEvent}
              onAddEvent={() => {
                if (selectedDate) {
                  // Pre-fill date with selected day at 9am
                  const d = new Date(selectedDate);
                  d.setHours(9, 0, 0, 0);
                  setEditingEvent({
                    id: "",
                    title: "",
                    description: "",
                    date: d.toISOString(),
                    endDate: null,
                    type: "publish",
                    channelId: null,
                    channel: null,
                    color: "emerald",
                    reminder: null,
                    done: false,
                    createdAt: "",
                    updatedAt: "",
                  });
                  setDialogOpen(true);
                } else {
                  openNewEvent();
                }
              }}
            />
            <ChecklistCard
              checklist={checklist}
              done={checklistDone}
              total={CHECKLIST_ITEMS.length}
              pct={checklistPct}
              onToggle={toggleItem}
              onReset={resetChecklist}
            />
          </div>
        </div>

        {/* Mobile agenda view */}
        <Card className="md:hidden glass border-border/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Icon name="list-checks" className="size-4 text-primary" />
              Agenda · {format(currentMonth, "MMM yyyy")}
            </h3>
            {data && (
              <Badge variant="secondary" className="tabular-nums">
                {(data.events?.length ?? 0) + dedicated.length} events
              </Badge>
            )}
          </div>
          {((data?.events?.length ?? 0) + dedicated.length) > 0 ? (
            <ScrollArea className="max-h-[28rem]">
              <div className="space-y-3 pr-2">
                {Object.entries(
                  [...(data?.events ?? []).map((ev) => ({
                    id: ev.id,
                    date: ev.date,
                    title: ev.title,
                    kind: "derived" as const,
                    derivedType: ev.type,
                    source: ev.source,
                    priority: ev.priority,
                  })),
                  ...dedicated.map((ev) => ({
                    id: ev.id,
                    date: ev.date,
                    title: ev.title,
                    kind: "dedicated" as const,
                    dedicated: ev,
                  }))].reduce<Record<string, UnifiedEvent[]>>(
                    (acc, ev) => {
                      const k = ev.date.slice(0, 10);
                      (acc[k] ??= []).push(ev);
                      return acc;
                    },
                    {}
                  )
                )
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([k, evs]) => (
                    <div
                      key={k}
                      className="border-l-2 border-border pl-3 py-1"
                    >
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                        {format(parseISO(k), "EEE, MMM d")}
                      </p>
                      <div className="space-y-1.5">
                        {evs.map((ev) => (
                          <MobileAgendaRow
                            key={ev.id}
                            ev={ev}
                            onClick={
                              ev.kind === "dedicated"
                                ? () => openEditEvent(ev.dedicated!)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          ) : (
            <EmptyState
              icon="calendar-days"
              title="No events this month"
              description="Schedule cards or tasks to see them appear here."
            />
          )}
        </Card>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingEvent}
        channels={channels}
        onSaved={handleEventSaved}
        onDeleted={handleEventDeleted}
      />

      <DragOverlay dropAnimation={null}>
        {draggingId
          ? (() => {
              const ev = dedicated.find((x) => x.id === draggingId);
              return ev ? (
                <div
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] font-medium shadow-lg ring-2 ring-primary/40 bg-card border border-border/60",
                    colorChip(ev.color)
                  )}
                >
                  <span className={cn("size-1.5 rounded-full inline-block mr-1", colorDot(ev.color))} />
                  {ev.title}
                </div>
              ) : null;
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({
  day,
  dayKey,
  dayEvents,
  overflow,
  isToday,
  isSelected,
  inMonth,
  index,
  onSelect,
  onEditEvent,
}: {
  day: Date;
  dayKey: string;
  dayEvents: UnifiedEvent[];
  overflow: number;
  isToday: boolean;
  isSelected: boolean;
  inMonth: boolean;
  index: number;
  onSelect: () => void;
  onEditEvent: (ev: CalendarEventRow) => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `day:${dayKey}`,
    data: { dayKey },
  });

  // Merge the button + droppable ref.
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLButtonElement | null) => {
      ref.current = node;
      setDropRef(node as unknown as HTMLElement);
    },
    [setDropRef]
  );

  return (
    <motion.button
      ref={setRefs}
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.22,
        delay: Math.min(index * 0.006, 0.18),
      }}
      onClick={onSelect}
      aria-label={`${format(day, "EEEE, MMMM d")}${
        dayEvents.length > 0 ? `, ${dayEvents.length} events` : ""
      }`}
      className={cn(
        "group relative flex flex-col gap-1 min-h-[92px] p-1.5 rounded-lg border text-left transition-colors",
        "border-transparent hover:border-border/60 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isToday && "ring-2 ring-emerald-500/60 border-emerald-500/40",
        isSelected &&
          !isToday &&
          "ring-2 ring-primary/40 border-primary/30 bg-accent/30",
        !inMonth && "opacity-40 hover:opacity-70",
        isOver && "ring-2 ring-primary/60 bg-primary/10"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-semibold tabular-nums size-5 grid place-items-center rounded-full",
            isToday
              ? "bg-emerald-500 text-emerald-950"
              : "text-muted-foreground"
          )}
        >
          {format(day, "d")}
        </span>
        {dayEvents.length > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {dayEvents.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {dayEvents.map((ev) => (
          <EventChip key={ev.id} ev={ev} onEdit={() => onEditEvent(ev.dedicated!)} />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="text-[10px] text-muted-foreground px-1 font-medium hover:text-foreground text-left"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </motion.button>
  );
}

// ─── Event chip ───────────────────────────────────────────────────────────────

function EventChip({
  ev,
  onEdit,
}: {
  ev: UnifiedEvent;
  onEdit: () => void;
}) {
  const isDedicated = ev.kind === "dedicated";

  const style = isDedicated
    ? {
        chip: colorChip(ev.dedicated!.color),
        dot: colorDot(ev.dedicated!.color),
      }
    : {
        chip: DERIVED_STYLE[ev.derivedType!].chip,
        dot: DERIVED_STYLE[ev.derivedType!].dot,
      };

  // Draggable wrapper for dedicated events.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ev.id,
    disabled: !isDedicated,
    data: { kind: ev.kind },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDedicated) onEdit();
  };

  const chip = (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          if (isDedicated) onEdit();
        }
      }}
      title={ev.title + (isDedicated ? " — click to edit, drag to move" : "")}
      className={cn(
        "flex items-center gap-1 px-1 py-0.5 rounded-md text-[10.5px] font-medium truncate",
        style.chip,
        isDedicated && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30"
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", style.dot)} />
      <span className="truncate">{ev.title}</span>
      {isDedicated && ev.dedicated?.reminder && (
        <Icon name="bell" className="size-2.5 shrink-0 ml-auto opacity-80" />
      )}
      {isDedicated && ev.dedicated?.done && (
        <Icon name="check" className="size-2.5 shrink-0 ml-auto opacity-80" />
      )}
    </div>
  );

  return chip;
}

// ─── Selected day panel ───────────────────────────────────────────────────────

function SelectedDayPanel({
  selectedDate,
  events,
  onClose,
  onEditEvent,
  onAddEvent,
}: {
  selectedDate: Date | null;
  events: UnifiedEvent[];
  onClose: () => void;
  onEditEvent: (ev: CalendarEventRow) => void;
  onAddEvent: () => void;
}) {
  return (
    <Card className="glass border-border/60 p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 size-28 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
      <div className="flex items-start justify-between gap-2 mb-3 relative">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Selected day
          </p>
          {selectedDate ? (
            <h3 className="text-lg font-bold tracking-tight mt-0.5">
              {format(selectedDate, "EEEE")}
            </h3>
          ) : (
            <h3 className="text-lg font-bold tracking-tight mt-0.5 text-muted-foreground">
              No day selected
            </h3>
          )}
          {selectedDate && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {format(selectedDate, "MMM d, yyyy")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedDate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onAddEvent}
            >
              <Icon name="plus" className="size-3.5" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          )}
          {selectedDate && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 -mr-1 -mt-1"
              onClick={onClose}
              aria-label="Clear selection"
            >
              <Icon name="x" className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedDate ? (
          <motion.div
            key={selectedDate.toISOString()}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {events.length > 0 ? (
              <ScrollArea className="max-h-[20rem]">
                <ul className="space-y-2 pr-2">
                  {events.map((ev) => {
                    const isDedicated = ev.kind === "dedicated";
                    const dot = isDedicated
                      ? colorDot(ev.dedicated!.color)
                      : DERIVED_STYLE[ev.derivedType!].dot;
                    const label = isDedicated
                      ? EVENT_TYPE_STYLE[ev.dedicated!.type].label
                      : DERIVED_STYLE[ev.derivedType!].label;
                    const color = isDedicated
                      ? ev.dedicated!.color
                      : DERIVED_STYLE[ev.derivedType!].color;
                    return (
                      <li
                        key={ev.id}
                        className={cn(
                          "rounded-lg border border-border/60 bg-card/40 p-2.5 transition-colors",
                          isDedicated
                            ? "hover:bg-accent/40 cursor-pointer"
                            : "cursor-default"
                        )}
                        onClick={() => {
                          if (isDedicated) onEditEvent(ev.dedicated!);
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-1 size-2 rounded-full shrink-0",
                              dot
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug line-clamp-2 flex items-center gap-1.5">
                              {ev.title}
                              {isDedicated && ev.dedicated?.done && (
                                <Icon
                                  name="check"
                                  className="size-3 text-emerald-500 shrink-0"
                                />
                              )}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Pill color={color} icon="circle-dot">
                                {label}
                              </Pill>
                              {isDedicated ? (
                                <>
                                  {ev.dedicated?.channel && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-normal h-5"
                                    >
                                      {ev.dedicated.channel.name}
                                    </Badge>
                                  )}
                                  {ev.dedicated?.reminder && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-normal h-5 gap-1"
                                    >
                                      <Icon name="bell" className="size-2.5" />
                                      {format(parseISO(ev.dedicated.reminder), "MMM d, h:mm a")}
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal h-5"
                                  >
                                    {SOURCE_LABEL[ev.source!]}
                                  </Badge>
                                  {ev.priority && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] font-normal h-5 capitalize"
                                    >
                                      {ev.priority}
                                    </Badge>
                                  )}
                                </>
                              )}
                              <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
                                {format(parseISO(ev.date), "h:mm a")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            ) : (
              <div className="py-6 text-center">
                <div className="size-10 rounded-xl bg-accent grid place-items-center mx-auto mb-2">
                  <Icon
                    name="calendar-days"
                    className="size-5 text-muted-foreground"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  No events scheduled.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  A quiet day — perfect for deep work.
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-6 text-center"
          >
            <div className="size-10 rounded-xl bg-accent grid place-items-center mx-auto mb-2">
              <Icon
                name="calendar-days"
                className="size-5 text-muted-foreground"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Click any day on the calendar
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              to see its full event list.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Publishing checklist card ────────────────────────────────────────────────

function ChecklistCard({
  checklist,
  done,
  total,
  pct,
  onToggle,
  onReset,
}: {
  checklist: Record<string, boolean>;
  done: number;
  total: number;
  pct: number;
  onToggle: (item: string) => void;
  onReset: () => void;
}) {
  const complete = done === total;
  return (
    <Card className="glass border-border/60 p-4 sm:p-5 relative overflow-hidden">
      <div
        className={cn(
          "absolute -top-10 -left-10 size-28 rounded-full blur-2xl pointer-events-none transition-colors",
          complete ? "bg-emerald-500/25" : "bg-amber-500/15"
        )}
      />
      <div className="flex items-start justify-between gap-2 mb-3 relative">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Publishing checklist
          </p>
          <h3 className="text-base font-bold tracking-tight mt-0.5 flex items-center gap-2">
            {complete ? (
              <Icon
                name="check-circle"
                className="size-4 text-emerald-500"
              />
            ) : (
              <Icon name="clipboard-list" className="size-4 text-amber-500" />
            )}
            {done}/{total} done
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onReset}
        >
          <Icon name="refresh" className="size-3.5" />
          Reset
        </Button>
      </div>

      <Progress value={pct} color={complete ? "emerald" : "amber"} />

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {complete
          ? "All set — ready to publish! 🎉"
          : `${total - done} step${total - done === 1 ? "" : "s"} remaining`}
      </p>

      <ul className="mt-3 space-y-1">
        {CHECKLIST_ITEMS.map((item) => {
          const checked = !!checklist[item.label];
          return (
            <li key={item.label}>
              <label
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors",
                  "hover:bg-accent/50",
                  checked && "opacity-60"
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(item.label)}
                />
                <Icon
                  name={item.icon}
                  className={cn(
                    "size-3.5 shrink-0",
                    checked ? "text-emerald-500" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-sm flex-1",
                    checked && "line-through text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ─── Mobile agenda row ────────────────────────────────────────────────────────

function MobileAgendaRow({
  ev,
  onClick,
}: {
  ev: UnifiedEvent;
  onClick?: () => void;
}) {
  const isDedicated = ev.kind === "dedicated";
  const dot = isDedicated
    ? colorDot(ev.dedicated!.color)
    : DERIVED_STYLE[ev.derivedType!].dot;
  const label = isDedicated
    ? EVENT_TYPE_STYLE[ev.dedicated!.type].label
    : DERIVED_STYLE[ev.derivedType!].label;
  const color = isDedicated
    ? ev.dedicated!.color
    : DERIVED_STYLE[ev.derivedType!].color;
  const subtitle = isDedicated
    ? ev.dedicated?.channel?.name ?? "Calendar event"
    : SOURCE_LABEL[ev.source!];
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-md bg-card/40 border border-border/40 px-2 py-1.5",
        onClick && "cursor-pointer hover:bg-accent/40"
      )}
    >
      <span className={cn("mt-1 size-2 rounded-full shrink-0", dot)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {ev.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <Pill color={color}>{label}</Pill>
          <span className="text-[10px] text-muted-foreground">{subtitle}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
            {format(parseISO(ev.date), "h:mm a")}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Event dialog (create/edit) ───────────────────────────────────────────────

interface EventForm {
  title: string;
  description: string;
  date: string; // datetime-local format
  endDate: string; // datetime-local or ""
  type: EventType;
  channelId: string; // "" or channel id
  color: string;
  reminder: string; // datetime-local or ""
  done: boolean;
}

function EventDialog({
  open,
  onOpenChange,
  editing,
  channels,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CalendarEventRow | null;
  channels: ChannelLite[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!editing?.id;
  const [form, setForm] = React.useState<EventForm>({
    title: "",
    description: "",
    date: toLocalInput(new Date()),
    endDate: "",
    type: "publish",
    channelId: "",
    color: "emerald",
    reminder: "",
    done: false,
  });
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      const d = new Date(editing.date);
      const ed = editing.endDate ? new Date(editing.endDate) : null;
      const rm = editing.reminder ? new Date(editing.reminder) : null;
      setForm({
        title: editing.title,
        description: editing.description,
        date: toLocalInput(d),
        endDate: ed ? toLocalInput(ed) : "",
        type: editing.type,
        channelId: editing.channelId ?? "",
        color: editing.color,
        reminder: rm ? toLocalInput(rm) : "",
        done: editing.done,
      });
    } else {
      // Defaults for new event — pre-fill date with now (or passed-in date).
      const initialDate = editing && !editing.id && editing.date
        ? new Date(editing.date)
        : new Date();
      setForm({
        title: "",
        description: "",
        date: toLocalInput(initialDate),
        endDate: "",
        type: "publish",
        channelId: "",
        color: "emerald",
        reminder: "",
        done: false,
      });
    }
  }, [open, editing]);

  const update = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const dateMs = new Date(form.date).getTime();
    if (isNaN(dateMs)) {
      toast.error("Invalid date");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        date: new Date(form.date).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        type: form.type,
        channelId: form.channelId || null,
        color: form.color,
        reminder: form.reminder ? new Date(form.reminder).toISOString() : null,
        done: form.done,
      };
      if (isEdit && editing) {
        await api(`/api/calendar-events/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Event updated");
      } else {
        await api("/api/calendar-events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Event created");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing?.id) return;
    setDeleting(true);
    try {
      await api(`/api/calendar-events/${editing.id}`, { method: "DELETE" });
      toast.success("Event deleted");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              name={isEdit ? "edit" : "plus"}
              className="size-4 text-primary"
            />
            {isEdit ? "Edit event" : "New calendar event"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this event. Drag chips between days to move quickly."
              : "Add a dedicated event to your calendar (publish, meeting, deadline, reminder, upload)."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title *</Label>
            <Input
              id="ev-title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Publish: 5 Morning Habits"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea
              id="ev-desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Optional notes…"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date & time *</Label>
              <Input
                id="ev-date"
                type="datetime-local"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">End date (optional)</Label>
              <Input
                id="ev-end"
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => update("endDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => update("type", v as EventType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-2">
                        <Icon name={EVENT_TYPE_STYLE[t].icon} className="size-3.5" />
                        {EVENT_TYPE_STYLE[t].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Select
                value={form.color}
                onValueChange={(v) => update("color", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PALETTE.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: COLOR_HEX[p] }}
                        />
                        <span className="capitalize">{p}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Channel (optional)</Label>
              <Select
                value={form.channelId || "__none__"}
                onValueChange={(v) =>
                  update("channelId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", colorDot(c.color))} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-reminder">Reminder (optional)</Label>
              <Input
                id="ev-reminder"
                type="datetime-local"
                value={form.reminder}
                onChange={(e) => update("reminder", e.target.value)}
              />
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 cursor-pointer">
              <Checkbox
                checked={form.done}
                onCheckedChange={(v) => update("done", v === true)}
              />
              <span className="text-sm">Mark as done</span>
            </label>
          )}

          <DialogFooter className="gap-2 mt-2">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={remove}
                disabled={deleting}
                className="mr-auto"
              >
                <Icon name="trash" className="size-4" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
