"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { SectionHeader, StatCard, EmptyState, Pill, Progress } from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api, formatNumber, formatMoney, formatDate, relativeTime, colorFor } from "@/lib/api";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChannelLite {
  id: string;
  name: string;
  niche: string;
  color: string;
}

interface VideoWithChannel {
  id: string;
  channelId: string;
  channel: ChannelLite;
  title: string;
  description: string;
  keywords: string;
  tags: string;
  script: string;
  hook: string;
  cta: string;
  thumbnailUrl: string;
  voiceOverUrl: string;
  editingStatus: "not_started" | "in_progress" | "done";
  publishDate: string | null;
  seoScore: number;
  videoUrl: string;
  views: number;
  ctr: number;
  retention: number;
  watchTime: number;
  revenue: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface VideoForm {
  title: string;
  channelId: string;
  description: string;
  keywords: string;
  tags: string;
  script: string;
  hook: string;
  cta: string;
  thumbnailUrl: string;
  voiceOverUrl: string;
  editingStatus: "not_started" | "in_progress" | "done";
  publishDate: string; // yyyy-MM-dd or ""
  seoScore: number;
  videoUrl: string;
  views: number;
  ctr: number;
  retention: number;
  watchTime: number;
  revenue: number;
  notes: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_FORM: VideoForm = {
  title: "",
  channelId: "",
  description: "",
  keywords: "",
  tags: "",
  script: "",
  hook: "",
  cta: "",
  thumbnailUrl: "",
  voiceOverUrl: "",
  editingStatus: "not_started",
  publishDate: "",
  seoScore: 0,
  videoUrl: "",
  views: 0,
  ctr: 0,
  retention: 0,
  watchTime: 0,
  revenue: 0,
  notes: "",
};

const STATUS_META: Record<
  VideoForm["editingStatus"],
  { label: string; color: string; icon: string }
> = {
  done: { label: "Done", color: "emerald", icon: "check-circle" },
  in_progress: { label: "In Progress", color: "amber", icon: "refresh" },
  not_started: { label: "Not Started", color: "muted", icon: "circle" },
};

const GRADIENT_FOR_COLOR: Record<string, string> = {
  emerald: "from-emerald-500/40 via-emerald-600/15 to-transparent",
  amber: "from-amber-500/40 via-amber-600/15 to-transparent",
  rose: "from-rose-500/40 via-rose-600/15 to-transparent",
  teal: "from-teal-500/40 via-teal-600/15 to-transparent",
  orange: "from-orange-500/40 via-orange-600/15 to-transparent",
};

function seoColorFor(score: number): string {
  if (score >= 70) return "emerald";
  if (score >= 40) return "amber";
  return "rose";
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

function statusBadge(status: VideoForm["editingStatus"]) {
  const meta = STATUS_META[status];
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

// ─── Component ─────────────────────────────────────────────────────────────────

export function VideosSection() {
  const [videos, setVideos] = React.useState<VideoWithChannel[]>([]);
  const [channels, setChannels] = React.useState<ChannelLite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<"table" | "grid">("table");
  const [topTab, setTopTab] = React.useState<"videos" | "scripts">("videos");

  const [filters, setFilters] = React.useState({
    q: "",
    channelId: "all",
    status: "all",
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<VideoWithChannel | null>(null);
  const [form, setForm] = React.useState<VideoForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("details");

  // ── Load channels once ───────────────────────────────────────────────────────
  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ channels: ChannelLite[] }>("/api/channels");
        setChannels(data.channels);
      } catch (e) {
        console.error("Failed to load channels", e);
      }
    })();
  }, []);

  // ── Load videos (debounced for search, immediate for filters) ───────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.channelId !== "all") params.set("channelId", filters.channelId);
      if (filters.status !== "all") params.set("status", filters.status);
      const qs = params.toString();
      const data = await api<{ videos: VideoWithChannel[] }>(
        `/api/videos${qs ? `?${qs}` : ""}`
      );
      setVideos(data.videos);
    } catch (e) {
      console.error("Failed to load videos", e);
      toast.error("Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounce the q field, immediate for channelId/status
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
    }, 280);
    return () => {
      if (qTimeout.current) clearTimeout(qTimeout.current);
    };
  }, [filters, load]);

  // ── Summary stats ────────────────────────────────────────────────────────────
  const totalVideos = videos.length;
  const publishedCount = videos.filter((v) => v.publishDate).length;
  const avgSeo =
    totalVideos === 0
      ? 0
      : Math.round(videos.reduce((s, v) => s + v.seoScore, 0) / totalVideos);
  const totalRevenue = videos.reduce((s, v) => s + v.revenue, 0);

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.channelId !== "all" ||
    filters.status !== "all";

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      channelId: channels[0]?.id ?? "",
    });
    setActiveTab("details");
    setDialogOpen(true);
  };

  const openEdit = (v: VideoWithChannel) => {
    setEditing(v);
    setForm({
      title: v.title,
      channelId: v.channelId,
      description: v.description,
      keywords: v.keywords,
      tags: v.tags,
      script: v.script,
      hook: v.hook,
      cta: v.cta,
      thumbnailUrl: v.thumbnailUrl,
      voiceOverUrl: v.voiceOverUrl,
      editingStatus: v.editingStatus,
      publishDate: toDateInputValue(v.publishDate),
      seoScore: v.seoScore,
      videoUrl: v.videoUrl,
      views: v.views,
      ctr: v.ctr,
      retention: v.retention,
      watchTime: v.watchTime,
      revenue: v.revenue,
      notes: v.notes,
    });
    setActiveTab("details");
    setDialogOpen(true);
  };

  const setField = <K extends keyof VideoForm>(key: K, value: VideoForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      setActiveTab("details");
      return;
    }
    if (!form.channelId) {
      toast.error("Channel is required");
      setActiveTab("details");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      publishDate: form.publishDate ? new Date(form.publishDate).toISOString() : null,
      seoScore: Number(form.seoScore) || 0,
      views: Number(form.views) || 0,
      ctr: Number(form.ctr) || 0,
      retention: Number(form.retention) || 0,
      watchTime: Number(form.watchTime) || 0,
      revenue: Number(form.revenue) || 0,
    };
    try {
      if (editing) {
        await api(`/api/videos/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Video updated");
      } else {
        await api("/api/videos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Video created");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(editing ? "Failed to update video" : "Failed to create video");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v: VideoWithChannel) => {
    try {
      await api(`/api/videos/${v.id}`, { method: "DELETE" });
      toast.success("Video deleted");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete video");
    }
  };

  const clearFilters = () => {
    setFilters({ q: "", channelId: "all", status: "all" });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Video Database"
        description="Every video, every detail, fully searchable"
        icon="film"
        actions={
          topTab === "videos" ? (
            <Button onClick={openCreate} className="gap-2">
              <Icon name="plus" className="size-4" />
              New Video
            </Button>
          ) : undefined
        }
      />

      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as "videos" | "scripts")} className="w-full">
        <div className="overflow-x-auto custom-scroll -mx-1 px-1 pb-1">
          <TabsList className="h-auto">
            <TabsTrigger value="videos" className="gap-1.5 px-3 py-1.5">
              <Icon name="film" className="size-3.5" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="scripts" className="gap-1.5 px-3 py-1.5">
              <Icon name="file-text" className="size-3.5" />
              Scripts
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="videos" className="space-y-5 mt-0">
          {/* Summary strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Total Videos"
              value={totalVideos}
              icon="film"
              color="emerald"
              delay={0}
            />
            <StatCard
              label="Published"
              value={publishedCount}
              icon="check-circle"
              color="teal"
              delay={0.05}
            />
            <StatCard
              label="Avg SEO Score"
              value={avgSeo}
              icon="gauge"
              color="amber"
              delay={0.1}
            />
            <StatCard
              label="Total Revenue"
              value={formatMoney(totalRevenue)}
              icon="dollar"
              color="rose"
              delay={0.15}
            />
          </div>

          {/* Filter bar */}
          <Card className="glass p-3 sm:p-4">
            <div className="flex flex-col xl:flex-row xl:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Icon
                  name="search"
                  className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <Input
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="Search by title…"
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Channel filter */}
                <Select
                  value={filters.channelId}
                  onValueChange={(v) => setFilters((f) => ({ ...f, channelId: v }))}
                >
                  <SelectTrigger className="w-[160px] sm:w-[180px]">
                    <SelectValue placeholder="All channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              colorFor(c.color).dot
                            )}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status filter */}
                <Select
                  value={filters.status}
                  onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>

                {/* View toggle */}
                <div className="inline-flex h-9 items-center rounded-md border bg-background/60 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setView("table")}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                      view === "table"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={view === "table"}
                  >
                    <Icon name="list-checks" className="size-3.5" />
                    <span className="hidden sm:inline">Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                      view === "grid"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={view === "grid"}
                  >
                    <Icon name="layout-grid" className="size-3.5" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                </div>

                {filtersActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name="x" className="size-3.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Body */}
          {loading ? (
            <SkeletonBody />
          ) : videos.length === 0 ? (
            <Card className="glass">
              <EmptyState
                icon="film"
                title={filtersActive ? "No videos match your filters" : "No videos yet"}
                description={
                  filtersActive
                    ? "Try adjusting your search or clearing filters."
                    : "Create your first video to start populating the database."
                }
                action={
                  filtersActive ? (
                    <Button variant="outline" onClick={clearFilters} className="gap-2">
                      <Icon name="filter" className="size-4" />
                      Clear filters
                    </Button>
                  ) : (
                    <Button onClick={openCreate} className="gap-2">
                      <Icon name="plus" className="size-4" />
                      New Video
                    </Button>
                  )
                }
              />
            </Card>
          ) : view === "table" ? (
            <TableView
              videos={videos}
              onRowClick={openEdit}
              onEdit={openEdit}
              onDelete={remove}
            />
          ) : (
            <GridView videos={videos} onCardClick={openEdit} />
          )}
        </TabsContent>

        <TabsContent value="scripts" className="mt-0">
          <ScriptsPanel channels={channels} />
        </TabsContent>
      </Tabs>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Icon
                name={editing ? "edit" : "plus"}
                className="size-5 text-primary"
              />
              {editing ? "Edit Video" : "New Video"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `Update details for "${editing.title}".`
                : "Add a new video to your database. Fill in details, SEO, content, and assets."}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col min-h-0 flex-1"
          >
            <div className="px-6 pt-3 border-b">
              <TabsList className="bg-transparent p-0 h-auto gap-1 flex-wrap">
                <TabsTrigger value="details" className="gap-1.5">
                  <Icon name="file-text" className="size-3.5" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="seo" className="gap-1.5">
                  <Icon name="search" className="size-3.5" />
                  SEO
                </TabsTrigger>
                <TabsTrigger value="content" className="gap-1.5">
                  <Icon name="file-text" className="size-3.5" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="assets" className="gap-1.5">
                  <Icon name="image" className="size-3.5" />
                  Assets
                </TabsTrigger>
                <TabsTrigger value="performance" className="gap-1.5">
                  <Icon name="bar-chart-3" className="size-3.5" />
                  Performance
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="max-h-[55vh]">
              <div className="px-6 py-5 space-y-5">
                {/* Details */}
                <TabsContent value="details" className="space-y-4 mt-0">
                  <Field label="Title" required>
                    <Input
                      value={form.title}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="e.g. 5 Morning Habits That Changed My Life"
                    />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Channel" required>
                      <Select
                        value={form.channelId}
                        onValueChange={(v) => setField("channelId", v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {channels.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "size-2 rounded-full",
                                    colorFor(c.color).dot
                                  )}
                                />
                                {c.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Editing Status">
                      <Select
                        value={form.editingStatus}
                        onValueChange={(v) =>
                          setField("editingStatus", v as VideoForm["editingStatus"])
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Description">
                    <Textarea
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="Short description shown under the video…"
                      rows={3}
                    />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Publish Date">
                      <Input
                        type="date"
                        value={form.publishDate}
                        onChange={(e) => setField("publishDate", e.target.value)}
                      />
                    </Field>
                    <Field label="Video URL">
                      <Input
                        value={form.videoUrl}
                        onChange={(e) => setField("videoUrl", e.target.value)}
                        placeholder="https://youtube.com/watch?v=…"
                      />
                    </Field>
                  </div>
                </TabsContent>

                {/* SEO */}
                <TabsContent value="seo" className="space-y-4 mt-0">
                  <Field label="Keywords" hint="Comma-separated">
                    <Input
                      value={form.keywords}
                      onChange={(e) => setField("keywords", e.target.value)}
                      placeholder="productivity, habits, morning routine"
                    />
                  </Field>
                  <Field label="Tags" hint="Comma-separated">
                    <Input
                      value={form.tags}
                      onChange={(e) => setField("tags", e.target.value)}
                      placeholder="youtube, self-improvement, 2025"
                    />
                  </Field>
                  <Field label="SEO Score" hint="0–100">
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.seoScore}
                        onChange={(e) =>
                          setField("seoScore", parseInt(e.target.value || "0", 10))
                        }
                        className="w-24"
                      />
                      <div className="flex-1">
                        <Progress
                          value={form.seoScore}
                          color={seoColorFor(form.seoScore)}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-xs font-semibold w-16 text-right",
                          colorFor(seoColorFor(form.seoScore)).text
                        )}
                      >
                        {form.seoScore >= 70
                          ? "Strong"
                          : form.seoScore >= 40
                            ? "Okay"
                            : "Weak"}
                      </span>
                    </div>
                  </Field>
                  <Field label="Hook">
                    <Textarea
                      value={form.hook}
                      onChange={(e) => setField("hook", e.target.value)}
                      placeholder="First 5 seconds that grab attention…"
                      rows={2}
                    />
                  </Field>
                  <Field label="CTA (Call to Action)">
                    <Textarea
                      value={form.cta}
                      onChange={(e) => setField("cta", e.target.value)}
                      placeholder="Subscribe for more, comment below, etc."
                      rows={2}
                    />
                  </Field>
                </TabsContent>

                {/* Content */}
                <TabsContent value="content" className="space-y-4 mt-0">
                  <Field label="Script">
                    <Textarea
                      value={form.script}
                      onChange={(e) => setField("script", e.target.value)}
                      placeholder="Full video script…"
                      className="min-h-40 font-mono text-[13px]"
                    />
                  </Field>
                  <Field label="Notes">
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      placeholder="Internal notes, reminders, ideas…"
                      rows={3}
                    />
                  </Field>
                </TabsContent>

                {/* Assets */}
                <TabsContent value="assets" className="space-y-4 mt-0">
                  <Field label="Thumbnail URL">
                    <Input
                      value={form.thumbnailUrl}
                      onChange={(e) => setField("thumbnailUrl", e.target.value)}
                      placeholder="https://…/thumbnail.jpg"
                    />
                  </Field>
                  <Field label="Voice-over URL">
                    <Input
                      value={form.voiceOverUrl}
                      onChange={(e) => setField("voiceOverUrl", e.target.value)}
                      placeholder="https://…/voiceover.mp3"
                    />
                  </Field>
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-3">
                    <Icon name="info" className="size-4 mt-0.5 shrink-0" />
                    <span>
                      Paste direct links to your hosted assets. Future updates
                      will add an uploader.
                    </span>
                  </div>
                </TabsContent>

                {/* Performance */}
                <TabsContent value="performance" className="space-y-4 mt-0">
                  {!editing && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                      <Icon name="alert-triangle" className="size-4 mt-0.5 shrink-0" />
                      <span>
                        Performance metrics are usually populated after publish.
                        You can set them now if needed.
                      </span>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Views">
                      <Input
                        type="number"
                        min={0}
                        value={form.views}
                        onChange={(e) =>
                          setField("views", parseInt(e.target.value || "0", 10))
                        }
                      />
                    </Field>
                    <Field label="CTR (%)" hint="Click-through rate">
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={form.ctr}
                        onChange={(e) =>
                          setField("ctr", parseFloat(e.target.value || "0"))
                        }
                      />
                    </Field>
                    <Field label="Retention (%)" hint="Average view retention">
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={form.retention}
                        onChange={(e) =>
                          setField("retention", parseFloat(e.target.value || "0"))
                        }
                      />
                    </Field>
                    <Field label="Watch Time (hrs)">
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={form.watchTime}
                        onChange={(e) =>
                          setField("watchTime", parseFloat(e.target.value || "0"))
                        }
                      />
                    </Field>
                    <Field label="Revenue ($)">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.revenue}
                        onChange={(e) =>
                          setField("revenue", parseFloat(e.target.value || "0"))
                        }
                      />
                    </Field>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniMetric
                      label="Views"
                      value={formatNumber(form.views)}
                      icon="eye"
                      color="emerald"
                    />
                    <MiniMetric
                      label="CTR"
                      value={`${form.ctr.toFixed(1)}%`}
                      icon="gauge"
                      color="amber"
                    />
                    <MiniMetric
                      label="Retention"
                      value={`${form.retention.toFixed(1)}%`}
                      icon="activity"
                      color="teal"
                    />
                    <MiniMetric
                      label="Revenue"
                      value={formatMoney(form.revenue)}
                      icon="dollar"
                      color="rose"
                    />
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t bg-background/60">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-2 min-w-28">
              {saving ? (
                <>
                  <Icon name="refresh" className="size-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                <>
                  <Icon name="check" className="size-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Icon name="plus" className="size-4" />
                  Create Video
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-foreground/80">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </Label>
        {hint && (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  const c = colorFor(color);
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div className={cn("size-5 rounded grid place-items-center", c.soft)}>
          <Icon name={icon} className="size-3" />
        </div>
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SkeletonBody() {
  return (
    <Card className="glass p-0 overflow-hidden">
      <div className="p-4 border-b">
        <div className="h-4 w-32 bg-accent/60 rounded animate-pulse" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="size-9 rounded-md bg-accent/60 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 bg-accent/60 rounded animate-pulse" />
              <div className="h-2.5 w-1/3 bg-accent/40 rounded animate-pulse" />
            </div>
            <div className="hidden md:block h-3 w-24 bg-accent/40 rounded animate-pulse" />
            <div className="hidden md:block h-3 w-16 bg-accent/40 rounded animate-pulse" />
            <div className="size-7 rounded-md bg-accent/40 animate-pulse" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Table View ─────────────────────────────────────────────────────────────────

function TableView({
  videos,
  onRowClick,
  onEdit,
  onDelete,
}: {
  videos: VideoWithChannel[];
  onRowClick: (v: VideoWithChannel) => void;
  onEdit: (v: VideoWithChannel) => void;
  onDelete: (v: VideoWithChannel) => void;
}) {
  return (
    <Card className="glass p-0 overflow-hidden">
      <ScrollArea className="max-h-[68vh]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/60">
              <TableHead className="pl-4 text-xs uppercase tracking-wider text-muted-foreground">
                Title
              </TableHead>
              <TableHead className="hidden sm:table-cell text-xs uppercase tracking-wider text-muted-foreground">
                Channel
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs uppercase tracking-wider text-muted-foreground">
                SEO Score
              </TableHead>
              <TableHead className="hidden md:table-cell text-right text-xs uppercase tracking-wider text-muted-foreground">
                Views
              </TableHead>
              <TableHead className="hidden lg:table-cell text-right text-xs uppercase tracking-wider text-muted-foreground">
                Revenue
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs uppercase tracking-wider text-muted-foreground">
                Published
              </TableHead>
              <TableHead className="w-10 pr-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((v, idx) => (
              <motion.tr
                key={v.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.2) }}
                onClick={() => onRowClick(v)}
                className="border-border/50 cursor-pointer group"
              >
                <TableCell className="pl-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-md bg-primary/10 grid place-items-center shrink-0 group-hover:bg-primary/15 transition-colors">
                      <Icon name="film" className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate max-w-[28ch] sm:max-w-[36ch]">
                        {v.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate sm:hidden">
                        {v.channel.name}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell py-3">
                  <span className="inline-flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        colorFor(v.channel.color).dot
                      )}
                    />
                    {v.channel.name}
                  </span>
                </TableCell>
                <TableCell className="py-3">{statusBadge(v.editingStatus)}</TableCell>
                <TableCell className="hidden md:table-cell py-3">
                  <div className="flex items-center gap-2 w-32">
                    <Progress
                      value={v.seoScore}
                      color={seoColorFor(v.seoScore)}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums w-7 text-right",
                        colorFor(seoColorFor(v.seoScore)).text
                      )}
                    >
                      {v.seoScore}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell py-3 text-right tabular-nums text-sm">
                  {v.views > 0 ? formatNumber(v.views) : "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell py-3 text-right tabular-nums text-sm">
                  {v.revenue > 0 ? formatMoney(v.revenue) : "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell py-3 text-sm text-muted-foreground">
                  {v.publishDate ? formatDate(v.publishDate) : "—"}
                </TableCell>
                <TableCell className="pr-2 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="Row actions"
                      >
                        <Icon name="more-horizontal" className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => onEdit(v)} className="gap-2">
                        <Icon name="edit" className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(v)}
                        className="gap-2 text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400"
                      >
                        <Icon name="trash" className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}

// ─── Grid View ──────────────────────────────────────────────────────────────────

function GridView({
  videos,
  onCardClick,
}: {
  videos: VideoWithChannel[];
  onCardClick: (v: VideoWithChannel) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((v, idx) => {
        const grad =
          GRADIENT_FOR_COLOR[v.channel.color] ?? GRADIENT_FOR_COLOR.emerald;
        const c = colorFor(v.channel.color);
        return (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(idx * 0.03, 0.25) }}
            className="lift"
          >
            <Card
              onClick={() => onCardClick(v)}
              className="overflow-hidden cursor-pointer group p-0 border-border/60 hover:border-border transition-colors"
            >
              {/* Thumbnail placeholder */}
              <div
                className={cn(
                  "relative h-32 bg-gradient-to-br flex items-center justify-center",
                  grad
                )}
              >
                <div className="absolute inset-0 bg-background/40" />
                <div className="relative size-12 rounded-xl bg-background/70 backdrop-blur-sm grid place-items-center group-hover:scale-105 transition-transform">
                  <Icon name="film" className={cn("size-6", c.text)} />
                </div>
                <div className="absolute top-2 left-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm px-2 py-0.5 text-[11px] font-medium">
                    <span className={cn("size-1.5 rounded-full", c.dot)} />
                    {v.channel.name}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  {statusBadge(v.editingStatus)}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                <p className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                  {v.title}
                </p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">SEO Score</span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        colorFor(seoColorFor(v.seoScore)).text
                      )}
                    >
                      {v.seoScore}/100
                    </span>
                  </div>
                  <Progress value={v.seoScore} color={seoColorFor(v.seoScore)} />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Views
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {v.views > 0 ? formatNumber(v.views) : "—"}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Revenue
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {v.revenue > 0 ? formatMoney(v.revenue) : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="calendar-days" className="size-3" />
                    {v.publishDate ? formatDate(v.publishDate) : "Unscheduled"}
                  </span>
                  <Icon
                    name="chevron-right"
                    className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Scripts Panel ────────────────────────────────────────────────────────────

interface ScriptRow {
  id: string;
  title: string;
  content: string;
  hook: string;
  cta: string;
  tags: string;
  folder: string;
  status: string;
  wordCount: number;
  channelId: string | null;
  channel?: { id: string; name: string; color: string } | null;
  videoId: string | null;
  video?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

const SCRIPT_STATUS_STYLE: Record<
  string,
  { label: string; color: string }
> = {
  draft: { label: "Draft", color: "amber" },
  review: { label: "Review", color: "teal" },
  final: { label: "Final", color: "emerald" },
};

function ScriptsPanel({ channels }: { channels: ChannelLite[] }) {
  const [scripts, setScripts] = React.useState<ScriptRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [folderFilter, setFolderFilter] = React.useState("__all__");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editorState, setEditorState] = React.useState<{
    title: string;
    content: string;
    hook: string;
    cta: string;
    tags: string;
    folder: string;
    status: string;
    channelId: string;
  }>({
    title: "",
    content: "",
    hook: "",
    cta: "",
    tags: "",
    folder: "General",
    status: "draft",
    channelId: "",
  });
  const [saveState, setSaveState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [creating, setCreating] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = React.useRef(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ scripts: ScriptRow[] }>("/api/scripts");
      setScripts(data.scripts ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load scripts");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Derived folder list from scripts (unique, non-empty).
  const folders = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of scripts) {
      if (s.folder && s.folder.trim()) set.add(s.folder.trim());
    }
    return Array.from(set).sort();
  }, [scripts]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return scripts.filter((s) => {
      if (folderFilter !== "__all__" && s.folder !== folderFilter) return false;
      if (q) {
        const hay = (s.title + " " + s.content + " " + s.tags)
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scripts, search, folderFilter]);

  const selected = React.useMemo(
    () => scripts.find((s) => s.id === selectedId) ?? null,
    [scripts, selectedId]
  );

  // When the selected script changes, sync the editor.
  React.useEffect(() => {
    if (!selected) return;
    skipNextSaveRef.current = true;
    setEditorState({
      title: selected.title,
      content: selected.content,
      hook: selected.hook,
      cta: selected.cta,
      tags: selected.tags,
      folder: selected.folder,
      status: selected.status,
      channelId: selected.channelId ?? "",
    });
    setSaveState("idle");
  }, [selectedId, selected?.updatedAt]);

  // Autosave: debounce 800ms after last keystroke, PATCH /api/scripts/[id].
  React.useEffect(() => {
    if (!selectedId || !selected) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        const patch = {
          title: editorState.title.trim() || "Untitled script",
          content: editorState.content,
          hook: editorState.hook,
          cta: editorState.cta,
          tags: editorState.tags,
          folder: editorState.folder || "General",
          status: editorState.status,
          channelId: editorState.channelId || null,
        };
        const res = await api<{ script: ScriptRow }>(
          `/api/scripts/${selectedId}`,
          {
            method: "PATCH",
            body: JSON.stringify(patch),
          }
        );
        setScripts((prev) =>
          prev.map((s) => (s.id === res.script.id ? res.script : s))
        );
        setSaveState("saved");
        // Clear "saved" indicator after 1.5s
        setTimeout(() => {
          setSaveState((prev) => (prev === "saved" ? "idle" : prev));
        }, 1500);
      } catch (e) {
        setSaveState("error");
        toast.error(e instanceof Error ? e.message : "Failed to save script");
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    editorState,
    selectedId,
    selected,
  ]);

  const update = <K extends keyof typeof editorState>(
    key: K,
    value: (typeof editorState)[K]
  ) => setEditorState((prev) => ({ ...prev, [key]: value }));

  const createNew = async () => {
    setCreating(true);
    try {
      const res = await api<{ script: ScriptRow }>("/api/scripts", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled script",
          content: "",
          folder: folderFilter === "__all__" ? "General" : folderFilter,
          status: "draft",
        }),
      });
      setScripts((prev) => [res.script, ...prev]);
      setSelectedId(res.script.id);
      toast.success("New script created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create script");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    const prev = scripts;
    setScripts((s) => s.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      await api(`/api/scripts/${id}`, { method: "DELETE" });
      toast.success("Script deleted");
    } catch (e) {
      setScripts(prev);
      toast.error(e instanceof Error ? e.message : "Failed to delete script");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      {/* Left rail: scripts list */}
      <Card className="glass p-3 sm:p-4 flex flex-col max-h-[78vh]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Icon name="file-text" className="size-4 text-primary" />
            Scripts
            <Badge variant="secondary" className="text-[10px] tabular-nums h-5">
              {filtered.length}
            </Badge>
          </h3>
          <Button size="sm" onClick={createNew} disabled={creating}>
            <Icon name="plus" className="size-3.5" />
            New
          </Button>
        </div>

        <div className="space-y-2 mb-3">
          <div className="relative">
            <Icon
              name="search"
              className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scripts…"
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All folders</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f} value={f}>
                  <span className="flex items-center gap-2">
                    <Icon name="folder-open" className="size-3" />
                    {f}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-1.5">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-2.5">
                  <div className="shimmer h-3 w-2/3 rounded mb-2" />
                  <div className="shimmer h-2.5 w-1/2 rounded" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center">
                <Icon
                  name="file-text"
                  className="size-6 text-muted-foreground mx-auto mb-1"
                />
                <p className="text-xs text-muted-foreground">
                  No scripts found.
                </p>
              </div>
            ) : (
              filtered.map((s) => {
                const st = SCRIPT_STATUS_STYLE[s.status] ?? {
                  label: s.status,
                  color: "muted",
                };
                const isActive = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "w-full text-left rounded-lg border p-2.5 transition-colors",
                      isActive
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                        : "border-border/60 hover:bg-accent/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold leading-snug line-clamp-2 flex-1">
                        {s.title}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase shrink-0",
                          st.color === "emerald" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          st.color === "amber" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                          st.color === "teal" && "bg-teal-500/10 text-teal-600 dark:text-teal-400",
                          st.color === "muted" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {s.channel && (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              colorFor(s.channel.color).dot
                            )}
                          />
                          {s.channel.name}
                        </span>
                      )}
                      <span className="tabular-nums">{s.wordCount}w</span>
                      <span className="ml-auto truncate">{s.folder}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Right rail: editor */}
      <Card className="glass p-4 sm:p-5 flex flex-col min-h-[60vh] max-h-[78vh]">
        {!selected ? (
          <div className="flex-1 grid place-items-center">
            <div className="text-center">
              <div className="size-12 rounded-xl bg-accent grid place-items-center mx-auto mb-3">
                <Icon name="file-text" className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No script selected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pick a script from the left, or create a new one.
              </p>
              <Button className="mt-3" onClick={createNew} disabled={creating}>
                <Icon name="plus" className="size-4" />
                New script
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border/60">
              <Input
                value={editorState.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Script title"
                className="flex-1 min-w-[200px] h-9 font-semibold"
              />
              <Select
                value={editorState.status}
                onValueChange={(v) => update("status", v)}
              >
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={editorState.channelId || "__none__"}
                onValueChange={(v) =>
                  update("channelId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No channel</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            colorFor(c.color).dot
                          )}
                        />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 hover:text-rose-500"
                onClick={() => remove(selected.id)}
                aria-label="Delete script"
              >
                <Icon name="trash" className="size-4" />
              </Button>
            </div>

            {/* Save state indicator */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Icon name="clock" className="size-3" />
                Updated {relativeTime(selected.updatedAt)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-medium",
                  saveState === "saving" && "text-amber-500",
                  saveState === "saved" && "text-emerald-500",
                  saveState === "error" && "text-rose-500"
                )}
              >
                {saveState === "saving" && (
                  <>
                    <Icon name="refresh" className="size-3 animate-spin" />
                    Saving…
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Icon name="check" className="size-3" />
                    Saved
                  </>
                )}
                {saveState === "error" && (
                  <>
                    <Icon name="alert-triangle" className="size-3" />
                    Error
                  </>
                )}
                {saveState === "idle" && (
                  <>
                    <Icon name="check-circle" className="size-3 opacity-60" />
                    Auto-saves
                  </>
                )}
              </span>
            </div>

            {/* Hook + CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sc-hook" className="text-[11px] uppercase tracking-wider">
                  Hook
                </Label>
                <Input
                  id="sc-hook"
                  value={editorState.hook}
                  onChange={(e) => update("hook", e.target.value)}
                  placeholder="First 5 seconds…"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sc-cta" className="text-[11px] uppercase tracking-wider">
                  CTA
                </Label>
                <Input
                  id="sc-cta"
                  value={editorState.cta}
                  onChange={(e) => update("cta", e.target.value)}
                  placeholder="Subscribe / next action…"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sc-folder" className="text-[11px] uppercase tracking-wider">
                  Folder
                </Label>
                <Input
                  id="sc-folder"
                  value={editorState.folder}
                  onChange={(e) => update("folder", e.target.value)}
                  placeholder="General"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sc-tags" className="text-[11px] uppercase tracking-wider">
                  Tags (comma separated)
                </Label>
                <Input
                  id="sc-tags"
                  value={editorState.tags}
                  onChange={(e) => update("tags", e.target.value)}
                  placeholder="morning routine, habits"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Editor + preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
              <div className="flex flex-col min-h-0">
                <Label className="text-[11px] uppercase tracking-wider mb-1">
                  Markdown editor
                </Label>
                <Textarea
                  value={editorState.content}
                  onChange={(e) => update("content", e.target.value)}
                  placeholder={"# Hook\n\nWrite your script in markdown…\n\n- Point 1\n- Point 2\n\n## CTA\n\nSubscribe for more."}
                  className="flex-1 min-h-[280px] resize-none font-mono text-sm"
                />
              </div>
              <div className="flex flex-col min-h-0">
                <Label className="text-[11px] uppercase tracking-wider mb-1">
                  Preview
                </Label>
                <ScrollArea className="flex-1 min-h-[280px] rounded-md border border-border/60 bg-background/40 p-3">
                  <ScriptPreview markdown={editorState.content} />
                </ScrollArea>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span className="tabular-nums">
                {editorState.content.trim()
                  ? editorState.content.trim().split(/\s+/).filter(Boolean).length
                  : 0}{" "}
                words
              </span>
              {selected.video && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="link" className="size-3" />
                  Linked to: {selected.video.title}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Script markdown preview ─────────────────────────────────────────────────

function ScriptPreview({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Preview will appear here as you type…
      </p>
    );
  }
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:my-2 prose-li:my-0 prose-strong:text-foreground prose-code:text-emerald-600 dark:prose-code:text-emerald-400 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
