"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import { SectionHeader, EmptyState } from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card as UICard } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

type StageKey =
  | "ideas"
  | "research"
  | "writing"
  | "voice"
  | "editing"
  | "thumbnail"
  | "seo"
  | "scheduled"
  | "published"
  | "archive";

/** Legacy → new stage migration map. Used to normalize old seeded cards. */
const STAGE_MIGRATION: Record<string, StageKey> = {
  script: "writing",
  voiceover: "voice",
  ready: "seo",
};

const MIGRATION_KEY = "planner-stage-migration-v1";

type Priority = "low" | "medium" | "high";

interface PlannerChannel {
  id: string;
  name: string;
  niche?: string;
  color?: string;
}

interface PlannerCard {
  id: string;
  title: string;
  description: string;
  stage: string;
  priority: string;
  position: number;
  channelId?: string | null;
  channel?: PlannerChannel | null;
  dueDate?: string | Date | null;
  tags?: string;
  assignee?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Stage configuration ──────────────────────────────────────────────────────

const STAGES: Record<StageKey, { label: string; color: string; icon: string }> = {
  ideas: { label: "Ideas", color: "teal", icon: "lightbulb" },
  research: { label: "Research", color: "emerald", icon: "search" },
  writing: { label: "Writing", color: "amber", icon: "file-text" },
  voice: { label: "Voice", color: "orange", icon: "message" },
  editing: { label: "Editing", color: "rose", icon: "film" },
  thumbnail: { label: "Thumbnail", color: "amber", icon: "image" },
  seo: { label: "SEO", color: "emerald", icon: "trending-up" },
  scheduled: { label: "Scheduled", color: "teal", icon: "calendar-days" },
  published: { label: "Published", color: "emerald", icon: "youtube" },
  archive: { label: "Archive", color: "muted", icon: "file-box" },
};

const STAGE_ORDER = Object.keys(STAGES) as StageKey[];

interface StageColor {
  text: string;
  bg: string;
  soft: string;
  dot: string;
  ring: string;
}

const STAGE_COLORS: Record<string, StageColor> = {
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500",
    soft: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/30",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500",
    soft: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    ring: "ring-amber-500/30",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500",
    soft: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
    ring: "ring-rose-500/30",
  },
  teal: {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500",
    soft: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    dot: "bg-teal-500",
    ring: "ring-teal-500/30",
  },
  orange: {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500",
    soft: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
    ring: "ring-orange-500/30",
  },
  muted: {
    text: "text-muted-foreground",
    bg: "bg-muted-foreground/60",
    soft: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
    ring: "ring-border",
  },
};

const stageColor = (key: string): StageColor =>
  STAGE_COLORS[key] ?? STAGE_COLORS.emerald;

const priorityColor = (p: string): StageColor => {
  if (p === "high") return STAGE_COLORS.rose;
  if (p === "medium") return STAGE_COLORS.amber;
  if (p === "low") return STAGE_COLORS.teal;
  return STAGE_COLORS.muted;
};

// ─── Card preview (used by sortable + overlay) ────────────────────────────────

function CardPreview({
  card,
  dragging,
}: {
  card: PlannerCard;
  dragging?: boolean;
}) {
  const pColor = priorityColor(card.priority);
  const tags = (card.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <UICard
      className={cn(
        "p-3 bg-card/80 backdrop-blur border-border/60 transition-shadow",
        dragging && "shadow-2xl ring-2 ring-primary/40 border-primary/40"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-1 size-1.5 rounded-full shrink-0",
            pColor.dot
          )}
        />
        <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">
          {card.title}
        </p>
      </div>

      {card.description && (
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 pl-3.5">
          {card.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pl-3.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            pColor.soft
          )}
        >
          {card.priority}
        </span>
        {card.channel && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
            <Icon name="youtube" className="size-2.5" />
            <span className="max-w-[80px] truncate">{card.channel.name}</span>
          </span>
        )}
        {card.dueDate && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
            <Icon name="clock" className="size-2.5" />
            {formatDate(card.dueDate as string | Date)}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 pl-3.5">
          {tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-[10px] text-muted-foreground/80"
            >
              #{t}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground/60">
              +{tags.length - 3}
            </span>
          )}
        </div>
      )}
    </UICard>
  );
}

// ─── Sortable card ────────────────────────────────────────────────────────────

function SortableCard({
  card,
  onEdit,
}: {
  card: PlannerCard;
  onEdit: (c: PlannerCard) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { stage: card.stage },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onEdit(card);
      }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      className="cursor-grab active:cursor-grabbing touch-none select-none"
    >
      <CardPreview card={card} />
    </motion.div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  stageKey,
  stageCards,
  onAddCard,
  onEditCard,
}: {
  stageKey: StageKey;
  stageCards: PlannerCard[];
  onAddCard: (stage: StageKey) => void;
  onEditCard: (c: PlannerCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageKey,
    data: { stage: stageKey },
  });
  const stage = STAGES[stageKey];
  const color = stageColor(stage.color);

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] shrink-0">
      {/* colored top border */}
      <div className={cn("h-[3px] rounded-full mb-2.5", color.bg)} />

      {/* header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={stage.icon} className={cn("size-4 shrink-0", color.text)} />
          <span className="text-sm font-semibold truncate">{stage.label}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="text-[10px] font-semibold tabular-nums px-1.5 h-5"
            >
              {stageCards.length}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            {stageCards.length} card{stageCards.length === 1 ? "" : "s"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* droppable body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[140px] rounded-xl p-2 space-y-2 transition-all border border-transparent",
          isOver && "bg-accent/40 ring-2 ring-primary/30 border-primary/20"
        )}
      >
        <SortableContext
          items={stageCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {stageCards.length === 0 ? (
            <div className="h-[80px] grid place-items-center text-[11px] text-muted-foreground/50 italic rounded-lg border border-dashed border-border/60">
              Drop here
            </div>
          ) : (
            stageCards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                onEdit={onEditCard}
              />
            ))
          )}
        </SortableContext>

        <button
          type="button"
          onClick={() => onAddCard(stageKey)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          <Icon name="plus" className="size-3" />
          Add card
        </button>
      </div>
    </div>
  );
}

// ─── Create/Edit Dialog ───────────────────────────────────────────────────────

interface DialogForm {
  title: string;
  description: string;
  stage: string;
  priority: string;
  channelId: string;
  dueDate: string;
  tags: string;
  assignee: string;
}

function CardDialog({
  open,
  onOpenChange,
  editing,
  channels,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PlannerCard | null;
  channels: PlannerChannel[];
  onSave: (data: DialogForm) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const isEdit = !!editing?.id;
  const [form, setForm] = React.useState<DialogForm>({
    title: "",
    description: "",
    stage: "ideas",
    priority: "medium",
    channelId: "",
    dueDate: "",
    tags: "",
    assignee: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Sync form when editing target changes.
  React.useEffect(() => {
    if (!editing) return;
    const due = editing.dueDate
      ? new Date(editing.dueDate as string | Date)
          .toISOString()
          .slice(0, 10)
      : "";
    setForm({
      title: editing.title ?? "",
      description: editing.description ?? "",
      stage: editing.stage ?? "ideas",
      priority: editing.priority ?? "medium",
      channelId: editing.channelId ?? "",
      dueDate: due,
      tags: editing.tags ?? "",
      assignee: editing.assignee ?? "",
    });
  }, [editing]);

  const update = <K extends keyof DialogForm>(key: K, value: DialogForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing?.id) return;
    setDeleting(true);
    try {
      await onDelete(editing.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit card" : "New card"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of this content card."
              : "Capture a new idea for your content pipeline."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="card-title">Title *</Label>
            <Input
              id="card-title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. 5 Morning Habits of Top Creators"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="card-desc">Description</Label>
            <Textarea
              id="card-desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Brief outline or notes…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select
                value={form.stage}
                onValueChange={(v) => update("stage", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_ORDER.map((k) => (
                    <SelectItem key={k} value={k}>
                      {STAGES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => update("priority", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select
                value={form.channelId || "__none__"}
                onValueChange={(v) =>
                  update("channelId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-due">Due date</Label>
              <Input
                id="card-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="card-tags">Tags</Label>
              <Input
                id="card-tags"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="comma, separated"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-assignee">Assignee</Label>
              <Input
                id="card-assignee"
                value={form.assignee}
                onChange={(e) => update("assignee", e.target.value)}
                placeholder="Name"
              />
            </div>
          </div>

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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function PlannerSection() {
  const [cards, setCards] = React.useState<PlannerCard[]>([]);
  const [channels, setChannels] = React.useState<PlannerChannel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PlannerCard | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const load = React.useCallback(async () => {
    try {
      const data = await api<{ cards: PlannerCard[] }>("/api/cards");
      // Defensive client-side normalization: if any card still has a legacy
      // stage (script/voiceover/ready), map it to the new canonical stage so
      // the board always renders correctly even before the server migration
      // runs. The server-side /api/cards/migrate endpoint (called once on
      // mount, see useEffect below) persists these changes.
      const normalized = (data.cards ?? []).map((c) =>
        STAGE_MIGRATION[c.stage]
          ? { ...c, stage: STAGE_MIGRATION[c.stage] as string }
          : c
      );
      setCards(normalized);
    } catch {
      toast.error("Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChannels = React.useCallback(async () => {
    try {
      const data = await api<{ channels: PlannerChannel[] } | PlannerChannel[]>(
        "/api/channels"
      );
      const list = Array.isArray(data)
        ? data
        : (data?.channels ?? []);
      setChannels(list);
    } catch {
      // Channels route may not exist yet — degrade gracefully.
      setChannels([]);
    }
  }, []);

  // One-time server-side migration of legacy card stages
  // (script→writing, voiceover→voice, ready→seo). Guarded by a localStorage
  // flag so it only runs once per browser.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(MIGRATION_KEY)) return;
    } catch {
      return;
    }
    api<{ ok: boolean; totalMigrated: number }>("/api/cards/migrate", {
      method: "POST",
    })
      .then((res) => {
        try {
          window.localStorage.setItem(MIGRATION_KEY, "1");
        } catch {
          /* ignore */
        }
        if (res?.totalMigrated > 0) {
          toast.success(`Migrated ${res.totalMigrated} card(s) to new stages`);
          load();
        }
      })
      .catch(() => {
        // Non-fatal: client-side mapping above still keeps the board usable.
      });
  }, [load]);

  React.useEffect(() => {
    load();
    loadChannels();
  }, [load, loadChannels]);

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeCard = cards.find((c) => c.id === active.id);
    if (!activeCard) return;

    const overId = String(over.id);
    let newStage: string | null = null;
    let newIndex = 0;

    if (overId in STAGES) {
      // Dropped onto a column (possibly empty).
      newStage = overId;
      const stageCards = cards
        .filter((c) => c.stage === overId && c.id !== activeCard.id)
        .sort((a, b) => a.position - b.position);
      newIndex = stageCards.length;
    } else {
      // Dropped onto another card → use that card's stage + position.
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard) return;
      newStage = overCard.stage;
      const stageCards = cards
        .filter((c) => c.stage === newStage && c.id !== activeCard.id)
        .sort((a, b) => a.position - b.position);
      const overIdx = stageCards.findIndex((c) => c.id === overCard.id);
      newIndex = overIdx === -1 ? stageCards.length : overIdx;
    }

    if (!newStage) return;

    // No-op: same stage, same position (dragged onto itself / same spot).
    const sameStage = newStage === activeCard.stage;
    const currentStageCards = cards
      .filter((c) => c.stage === activeCard.stage && c.id !== activeCard.id)
      .sort((a, b) => a.position - b.position);
    if (sameStage && newIndex === currentStageCards.length) {
      // Likely dropped at end of its own column with no real change.
      // Still allow reorder if user explicitly dropped onto a different card.
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard || overCard.id === activeCard.id) return;
    }

    // Optimistic local update: move card to new stage immediately.
    const prevCards = cards;
    setCards((prev) =>
      prev.map((c) =>
        c.id === activeCard.id ? { ...c, stage: newStage as string } : c
      )
    );

    try {
      const data = await api<{ cards: PlannerCard[] }>("/api/cards/reorder", {
        method: "POST",
        body: JSON.stringify({
          cardId: activeCard.id,
          newStage,
          newIndex,
        }),
      });
      setCards(data.cards ?? []);
      toast.success(`Moved to ${STAGES[newStage as StageKey].label}`);
    } catch {
      setCards(prevCards);
      toast.error("Failed to move card");
    }
  };

  const handleSave = async (formData: DialogForm) => {
    const payload = {
      title: formData.title.trim(),
      description: formData.description,
      stage: formData.stage,
      priority: formData.priority,
      channelId: formData.channelId || null,
      dueDate: formData.dueDate ? formData.dueDate : null,
      tags: formData.tags,
      assignee: formData.assignee,
    };

    if (editing?.id) {
      const data = await api<{ card: PlannerCard }>(
        `/api/cards/${editing.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );
      setCards((prev) =>
        prev.map((c) => (c.id === data.card.id ? data.card : c))
      );
      // Reload to keep ordering consistent (stage may have changed).
      await load();
      toast.success("Card updated");
    } else {
      const data = await api<{ card: PlannerCard }>("/api/cards", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCards((prev) => [...prev, data.card]);
      await load();
      toast.success("Card created");
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/api/cards/${id}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== id));
      setDialogOpen(false);
      setEditing(null);
      toast.success("Card deleted");
    } catch {
      toast.error("Failed to delete card");
    }
  };

  const openNew = (stage: StageKey = "ideas") => {
    setEditing({
      id: "",
      title: "",
      description: "",
      stage,
      priority: "medium",
      position: 0,
      channelId: null,
      channel: null,
      dueDate: null,
      tags: "",
      assignee: "",
      createdAt: "",
      updatedAt: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (card: PlannerCard) => {
    setEditing(card);
    setDialogOpen(true);
  };

  const activeCard = cards.find((c) => c.id === activeId) ?? null;

  // Group cards by stage.
  const byStage = (key: StageKey) =>
    cards
      .filter((c) => c.stage === key)
      .sort((a, b) => a.position - b.position);

  return (
    <TooltipProvider delayDuration={150}>
      <SectionHeader
        title="Content Planner"
        description="Drag ideas through your production pipeline"
        icon="kanban-square"
        actions={
          <Button onClick={() => openNew("ideas")} size="sm">
            <Icon name="plus" className="size-4" />
            New Idea
          </Button>
        }
      />

      {loading ? (
        <div className="grid place-items-center py-20 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Icon name="refresh" className="size-4 animate-spin" />
            Loading board…
          </div>
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon="kanban-square"
          title="No cards yet"
          description="Capture your first idea and drag it across the production pipeline."
          action={
            <Button onClick={() => openNew("ideas")} size="sm">
              <Icon name="plus" className="size-4" />
              New Idea
            </Button>
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="overflow-x-auto pb-3 -mx-1 px-1">
            <div className="flex gap-3 min-w-min">
              {STAGE_ORDER.map((key) => (
                <Column
                  key={key}
                  stageKey={key}
                  stageCards={byStage(key)}
                  onAddCard={openNew}
                  onEditCard={openEdit}
                />
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <motion.div
                initial={{ scale: 1, rotate: 0 }}
                animate={{ scale: 1.04, rotate: 1.5 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="w-[256px]"
              >
                <CardPreview card={activeCard} dragging />
              </motion.div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <CardDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        channels={channels}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </TooltipProvider>
  );
}
