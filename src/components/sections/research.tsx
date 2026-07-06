"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { toast } from "sonner";

import { SectionHeader, StatCard, EmptyState, Pill, Progress } from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api, formatNumber, colorFor } from "@/lib/api";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TrendItem {
  id: string;
  topic: string;
  competitor: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
  opportunity: number;
  category: string;
  bookmarked: boolean;
  notes: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface Filters {
  q: string;
  category: string; // "all" or a category name
  bookmarked: boolean;
}

interface TrendForm {
  topic: string;
  competitor: string;
  keyword: string;
  category: string;
  source: string;
  searchVolume: string;
  difficulty: string;
  opportunity: string;
  notes: string;
}

const EMPTY_FORM: TrendForm = {
  topic: "",
  competitor: "",
  keyword: "",
  category: "general",
  source: "",
  searchVolume: "0",
  difficulty: "50",
  opportunity: "50",
  notes: "",
};

// ─── Color helpers ──────────────────────────────────────────────────────────

/** Difficulty: low = emerald (easy), mid = amber, high = rose (hard). */
function diffColor(v: number): string {
  if (v < 40) return "emerald";
  if (v < 70) return "amber";
  return "rose";
}

/** Opportunity: high = emerald, mid = amber, low = rose. */
function oppColor(v: number): string {
  if (v >= 80) return "emerald";
  if (v >= 60) return "amber";
  return "rose";
}

/** Bubble fill for the matrix: same as oppColor but as raw hex for recharts Cell. */
function oppHex(v: number): string {
  if (v >= 80) return "#10b981"; // emerald-500
  if (v >= 60) return "#f59e0b"; // amber-500
  return "#f43f5e"; // rose-500
}

// ─── Scatter tooltip ────────────────────────────────────────────────────────

interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  topic: string;
  competitor: string;
  keyword: string;
  category: string;
  source: string;
}

function MatrixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="glass-strong rounded-xl border border-border/60 px-3.5 py-2.5 shadow-xl max-w-[240px]">
      <p className="text-sm font-semibold leading-tight">{p.topic}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>Difficulty</span>
        <span className="tabular-nums text-foreground font-medium">{p.x}/100</span>
        <span>Opportunity</span>
        <span className="tabular-nums text-foreground font-medium">{p.y}/100</span>
        <span>Search vol.</span>
        <span className="tabular-nums text-foreground font-medium">{formatNumber(p.z)}</span>
      </div>
      {p.keyword && (
        <p className="mt-1.5 text-[11px] text-muted-foreground truncate">
          <span className="text-foreground/70">keyword:</span> {p.keyword}
        </p>
      )}
      {p.competitor && (
        <p className="text-[11px] text-muted-foreground truncate">
          <span className="text-foreground/70">vs.</span> {p.competitor}
        </p>
      )}
    </div>
  );
}

// ─── Trend Card ─────────────────────────────────────────────────────────────

function TrendCard({
  trend,
  index,
  maxVolume,
  onToggleBookmark,
  onEdit,
  onDelete,
}: {
  trend: TrendItem;
  index: number;
  maxVolume: number;
  onToggleBookmark: (t: TrendItem) => void;
  onEdit: (t: TrendItem) => void;
  onDelete: (t: TrendItem) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const oppC = oppColor(trend.opportunity);
  const diffC = diffColor(trend.difficulty);
  const volPct = maxVolume > 0 ? (trend.searchVolume / maxVolume) * 100 : 0;

  const notes = trend.notes?.trim() ?? "";
  const longNotes = notes.length > 120;
  const displayNotes = expanded ? notes : notes.slice(0, 120);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4), ease: [0.2, 0.8, 0.2, 1] }}
      className="lift"
    >
      <Card className="relative overflow-hidden p-4 sm:p-5 gap-3 border-border/60">
        {/* subtle gradient glow by opportunity */}
        <div
          className={cn(
            "absolute -top-10 -right-10 size-28 rounded-full blur-3xl opacity-20",
            colorFor(oppC).bg
          )}
        />

        {/* Header row */}
        <div className="flex items-start justify-between gap-3 relative">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-snug line-clamp-2">
              {trend.topic}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {trend.competitor && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="users" className="size-3" />
                  {trend.competitor}
                </span>
              )}
              {trend.keyword && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="search" className="size-3" />
                  <span className="truncate max-w-[180px]">{trend.keyword}</span>
                </span>
              )}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToggleBookmark(trend)}
                aria-label={trend.bookmarked ? "Remove bookmark" : "Add bookmark"}
                className={cn(
                  "size-8 rounded-lg grid place-items-center transition-colors shrink-0",
                  trend.bookmarked
                    ? "text-amber-500 hover:bg-amber-500/10"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon
                  name="star"
                  className="size-4"
                  fill={trend.bookmarked ? "currentColor" : "none"}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {trend.bookmarked ? "Bookmarked" : "Bookmark this trend"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Pills row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {trend.category && (
            <Pill color="teal" icon="tag">
              {trend.category}
            </Pill>
          )}
          {trend.source && (
            <Pill color="emerald" icon="link">
              {trend.source}
            </Pill>
          )}
          {trend.bookmarked && (
            <Pill color="amber" icon="bookmark">
              Saved
            </Pill>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-2.5">
          {/* Search Volume (scaled to max) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Search Volume
              </span>
              <span className="text-[11px] font-semibold tabular-nums">
                {formatNumber(trend.searchVolume)}
              </span>
            </div>
            <Progress value={volPct} color="teal" />
          </div>

          {/* Difficulty */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Difficulty
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold tabular-nums",
                  colorFor(diffC).text
                )}
              >
                {trend.difficulty}/100
              </span>
            </div>
            <Progress value={trend.difficulty} color={diffC} />
          </div>

          {/* Opportunity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Opportunity
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold tabular-nums",
                  colorFor(oppC).text
                )}
              >
                {trend.opportunity}/100
              </span>
            </div>
            <Progress value={trend.opportunity} color={oppC} />
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {displayNotes}
              {longNotes && !expanded && (
                <span className="text-muted-foreground/60">…</span>
              )}
            </p>
            {longNotes && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-[11px] font-medium text-primary hover:underline"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(trend)}
          >
            <Icon name="edit" className="size-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(trend)}
            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
          >
            <Icon name="trash" className="size-3.5" />
            Delete
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function TrendSkeletonCard() {
  return (
    <Card className="p-5 gap-3 border-border/60">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-3/4 rounded shimmer" />
          <div className="h-3 w-1/2 rounded shimmer" />
        </div>
        <div className="size-8 rounded-lg shimmer" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 rounded-full shimmer" />
        <div className="h-5 w-20 rounded-full shimmer" />
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-2.5 w-20 rounded shimmer" />
              <div className="h-2.5 w-10 rounded shimmer" />
            </div>
            <div className="h-1.5 w-full rounded-full shimmer" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-1 pt-1 border-t border-border/40">
        <div className="h-7 w-16 rounded shimmer" />
        <div className="h-7 w-20 rounded shimmer" />
      </div>
    </Card>
  );
}

// ─── Add / Edit Dialog ─────────────────────────────────────────────────────

function TrendDialog({
  open,
  onOpenChange,
  editing,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TrendItem | null;
  categories: string[];
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<TrendForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          topic: editing.topic,
          competitor: editing.competitor,
          keyword: editing.keyword,
          category: editing.category || "general",
          source: editing.source,
          searchVolume: String(editing.searchVolume ?? 0),
          difficulty: String(editing.difficulty ?? 0),
          opportunity: String(editing.opportunity ?? 0),
          notes: editing.notes,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editing]);

  const set = <K extends keyof TrendForm>(k: K, v: TrendForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic.trim()) {
      toast.error("Topic is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        topic: form.topic.trim(),
        competitor: form.competitor.trim(),
        keyword: form.keyword.trim(),
        category: form.category.trim() || "general",
        source: form.source.trim(),
        searchVolume: Number(form.searchVolume) || 0,
        difficulty: Math.min(100, Math.max(0, Number(form.difficulty) || 0)),
        opportunity: Math.min(100, Math.max(0, Number(form.opportunity) || 0)),
        notes: form.notes,
      };
      if (editing) {
        await api(`/api/trends/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Trend updated");
      } else {
        await api("/api/trends", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Trend added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save trend");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Icon name="trending-up" className="size-5 text-primary" />
            {editing ? "Edit Trend" : "Add Trend"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this trend research entry."
              : "Capture a new trend, competitor, or content opportunity."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh] px-6">
            <div className="space-y-4 pb-4">
              {/* Topic */}
              <div className="space-y-1.5">
                <Label htmlFor="t-topic">
                  Topic <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="t-topic"
                  value={form.topic}
                  onChange={(e) => set("topic", e.target.value)}
                  placeholder="e.g. AI productivity tools 2025"
                  autoFocus
                />
              </div>

              {/* Competitor + Keyword */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-competitor">Competitor</Label>
                  <Input
                    id="t-competitor"
                    value={form.competitor}
                    onChange={(e) => set("competitor", e.target.value)}
                    placeholder="e.g. Ali Abdaal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-keyword">Keyword</Label>
                  <Input
                    id="t-keyword"
                    value={form.keyword}
                    onChange={(e) => set("keyword", e.target.value)}
                    placeholder="e.g. ai productivity"
                  />
                </div>
              </div>

              {/* Category + Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-category">Category</Label>
                  <Input
                    id="t-category"
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    placeholder="e.g. Technology"
                  />
                  {categories.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Existing: {categories.slice(0, 4).join(", ")}
                      {categories.length > 4 ? "…" : ""}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-source">Source</Label>
                  <Input
                    id="t-source"
                    value={form.source}
                    onChange={(e) => set("source", e.target.value)}
                    placeholder="e.g. YouTube Trends"
                  />
                </div>
              </div>

              {/* Search Volume */}
              <div className="space-y-1.5">
                <Label htmlFor="t-volume">Search Volume</Label>
                <Input
                  id="t-volume"
                  type="number"
                  min={0}
                  value={form.searchVolume}
                  onChange={(e) => set("searchVolume", e.target.value)}
                />
              </div>

              {/* Difficulty + Opportunity sliders-as-inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="t-difficulty">Difficulty</Label>
                    <Badge
                      variant="outline"
                      className={cn(
                        "tabular-nums",
                        colorFor(diffColor(Number(form.difficulty) || 0)).text
                      )}
                    >
                      {form.difficulty}/100
                    </Badge>
                  </div>
                  <Input
                    id="t-difficulty"
                    type="range"
                    min={0}
                    max={100}
                    value={form.difficulty}
                    onChange={(e) => set("difficulty", e.target.value)}
                    className="h-2 cursor-pointer p-0"
                  />
                  <Progress
                    value={Number(form.difficulty) || 0}
                    color={diffColor(Number(form.difficulty) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="t-opportunity">Opportunity</Label>
                    <Badge
                      variant="outline"
                      className={cn(
                        "tabular-nums",
                        colorFor(oppColor(Number(form.opportunity) || 0)).text
                      )}
                    >
                      {form.opportunity}/100
                    </Badge>
                  </div>
                  <Input
                    id="t-opportunity"
                    type="range"
                    min={0}
                    max={100}
                    value={form.opportunity}
                    onChange={(e) => set("opportunity", e.target.value)}
                    className="h-2 cursor-pointer p-0"
                  />
                  <Progress
                    value={Number(form.opportunity) || 0}
                    color={oppColor(Number(form.opportunity) || 0)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="t-notes">Notes</Label>
                <Textarea
                  id="t-notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Angle, hooks, validation findings…"
                  rows={4}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t border-border/60 mt-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Icon name="refresh" className="size-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Trend"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Section ───────────────────────────────────────────────────────────

export function ResearchSection() {
  const [trends, setTrends] = React.useState<TrendItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState<Filters>({
    q: "",
    category: "all",
    bookmarked: false,
  });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TrendItem | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TrendItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  // Load trends based on filters (server-side: bookmarked, category)
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.bookmarked) params.set("bookmarked", "true");
      if (filters.category && filters.category !== "all")
        params.set("category", filters.category);
      const qs = params.toString();
      const data = await api<{ trends: TrendItem[] }>(
        `/api/trends${qs ? `?${qs}` : ""}`
      );
      setTrends(data.trends ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load trends");
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }, [filters.bookmarked, filters.category]);

  React.useEffect(() => {
    load();
  }, [load, reloadKey]);

  // Distinct categories derived from current trends
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    trends.forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort();
  }, [trends]);

  // Client-side filter by q (topic or keyword)
  const filteredTrends = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return trends;
    return trends.filter(
      (t) =>
        t.topic.toLowerCase().includes(q) ||
        t.keyword.toLowerCase().includes(q)
    );
  }, [trends, filters.q]);

  // Stats
  const stats = React.useMemo(() => {
    const total = trends.length;
    const avgOpp =
      total > 0
        ? Math.round(trends.reduce((s, t) => s + t.opportunity, 0) / total)
        : 0;
    const bookmarked = trends.filter((t) => t.bookmarked).length;
    const avgVol =
      total > 0
        ? Math.round(trends.reduce((s, t) => s + t.searchVolume, 0) / total)
        : 0;
    return { total, avgOpp, bookmarked, avgVol };
  }, [trends]);

  const maxVolume = React.useMemo(
    () => trends.reduce((m, t) => Math.max(m, t.searchVolume), 0),
    [trends]
  );

  // Scatter data
  const scatterData = React.useMemo<ScatterPoint[]>(
    () =>
      trends.map((t) => ({
        x: t.difficulty,
        y: t.opportunity,
        z: t.searchVolume,
        topic: t.topic,
        competitor: t.competitor,
        keyword: t.keyword,
        category: t.category,
        source: t.source,
      })),
    [trends]
  );

  // Bookmark toggle (PATCH)
  const toggleBookmark = async (t: TrendItem) => {
    // optimistic
    setTrends((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, bookmarked: !x.bookmarked } : x))
    );
    try {
      await api(`/api/trends/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ bookmarked: !t.bookmarked }),
      });
      toast.success(t.bookmarked ? "Removed bookmark" : "Bookmarked");
    } catch (err) {
      // revert
      setTrends((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, bookmarked: t.bookmarked } : x))
      );
      toast.error(err instanceof Error ? err.message : "Failed to toggle bookmark");
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (t: TrendItem) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/trends/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Trend deleted");
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete trend");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Trend Research"
        description="Discover opportunities, track competitors, and validate ideas"
        icon="trending-up"
        actions={
          <>
            <Toggle
              aria-label="Toggle bookmarked filter"
              pressed={filters.bookmarked}
              onPressedChange={(v) => setFilters((f) => ({ ...f, bookmarked: v }))}
              variant="outline"
              className="gap-1.5"
            >
              <Icon
                name="star"
                className="size-4"
                fill={filters.bookmarked ? "currentColor" : "none"}
              />
              Bookmarked
            </Toggle>
            <Button onClick={handleAdd}>
              <Icon name="plus" className="size-4" />
              Add Trend
            </Button>
          </>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Trends"
          value={stats.total}
          icon="trending-up"
          color="emerald"
          hint="tracked topics"
          delay={0}
        />
        <StatCard
          label="Avg Opportunity"
          value={`${stats.avgOpp}`}
          icon="gauge"
          color="amber"
          hint="out of 100"
          delay={0.05}
        />
        <StatCard
          label="Bookmarked"
          value={stats.bookmarked}
          icon="star"
          color="rose"
          hint="saved ideas"
          delay={0.1}
        />
        <StatCard
          label="Avg Search Volume"
          value={formatNumber(stats.avgVol)}
          icon="activity"
          color="teal"
          hint="monthly searches"
          delay={0.15}
        />
      </div>

      {/* Opportunity Matrix (signature visual) */}
      <Card className="glass border-border/60 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Icon name="bar-chart-3" className="size-4 text-primary" />
              Opportunity Matrix
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              X = difficulty · Y = opportunity · bubble size = search volume
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              High (80+)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" />
              Mid (60+)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500" />
              Low
            </span>
          </div>
        </div>
        <div className="h-[300px] w-full">
          {loading || scatterData.length === 0 ? (
            <div className="h-full w-full grid place-items-center rounded-lg bg-muted/30 border border-dashed border-border/60">
              {loading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Icon name="refresh" className="size-5 animate-spin" />
                  <span className="text-xs">Loading matrix…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Icon name="bar-chart-3" className="size-5" />
                  <span className="text-xs">No data to plot</span>
                </div>
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 12, right: 16, bottom: 16, left: 0 }}
              >
                <defs>
                  <linearGradient id="matrix-bg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.04} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Difficulty"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
                  tickLine={false}
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.15 }}
                  label={{
                    value: "Difficulty →",
                    position: "insideBottom",
                    offset: -6,
                    style: { fontSize: 11, fill: "currentColor", opacity: 0.55 },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Opportunity"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
                  tickLine={false}
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.15 }}
                  label={{
                    value: "Opportunity →",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    style: { fontSize: 11, fill: "currentColor", opacity: 0.55 },
                  }}
                />
                <ZAxis
                  type="number"
                  dataKey="z"
                  name="Search Volume"
                  range={[60, 900]}
                />
                <RTooltip
                  content={<MatrixTooltip />}
                  cursor={{
                    strokeDasharray: "3 3",
                    stroke: "currentColor",
                    strokeOpacity: 0.2,
                  }}
                />
                <Scatter
                  data={scatterData}
                  fill="#10b981"
                  fillOpacity={0.7}
                  stroke="#0f172a"
                  strokeWidth={1.5}
                >
                  {scatterData.map((p, i) => (
                    <Cell key={i} fill={oppHex(p.y)} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Filter bar */}
      <Card className="glass p-3 sm:p-4 border-border/60">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            />
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search topic or keyword…"
              className="pl-9"
            />
          </div>
          <Select
            value={filters.category}
            onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}
          >
            <SelectTrigger className="sm:w-[180px] w-full">
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
          <Toggle
            aria-label="Toggle bookmarked filter"
            pressed={filters.bookmarked}
            onPressedChange={(v) => setFilters((f) => ({ ...f, bookmarked: v }))}
            variant="outline"
            className="gap-1.5 h-9 px-3"
          >
            <Icon
              name="star"
              className="size-4"
              fill={filters.bookmarked ? "currentColor" : "none"}
            />
            Bookmarked
          </Toggle>
          {(filters.q || filters.category !== "all" || filters.bookmarked) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters({ q: "", category: "all", bookmarked: false })
              }
            >
              <Icon name="x" className="size-3.5" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Trends list */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TrendSkeletonCard key={i} />
          ))}
        </div>
      ) : filteredTrends.length === 0 ? (
        <EmptyState
          icon="trending-up"
          title={
            trends.length === 0
              ? "No trends yet"
              : "No trends match your filters"
          }
          description={
            trends.length === 0
              ? "Add your first trend to start tracking opportunities and competitors."
              : "Try adjusting your search, category, or bookmark filter."
          }
          action={
            trends.length === 0 ? (
              <Button onClick={handleAdd}>
                <Icon name="plus" className="size-4" />
                Add Trend
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({ q: "", category: "all", bookmarked: false })
                }
              >
                <Icon name="x" className="size-4" />
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 lg:grid-cols-2 gap-3"
        >
          <AnimatePresence mode="popLayout">
            {filteredTrends.map((t, i) => (
              <TrendCard
                key={t.id}
                trend={t}
                index={i}
                maxVolume={maxVolume}
                onToggleBookmark={toggleBookmark}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add/Edit dialog */}
      <TrendDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        categories={categories}
        onSaved={() => setReloadKey((k) => k + 1)}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trend?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                “{deleteTarget?.topic}”
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-600 dark:hover:bg-rose-700"
            >
              {deleting && <Icon name="refresh" className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
