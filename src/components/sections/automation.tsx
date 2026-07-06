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
import { api, colorFor } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

interface StageEntry {
  key: string;
  label: string;
  done: boolean;
}

type WorkflowStatus = "active" | "completed" | "paused";

interface Workflow {
  id: string;
  name: string;
  videoTitle: string;
  channelName: string;
  stages: string; // JSON array of StageEntry
  progress: number;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

interface Channel {
  id: string;
  name: string;
  color: string;
}

// ─── Static stage config ─────────────────────────────────────────────────────

const STAGE_META: { key: string; label: string; icon: string; color: string }[] =
  [
    { key: "idea", label: "Idea", icon: "lightbulb", color: "teal" },
    { key: "research", label: "Research", icon: "search", color: "emerald" },
    { key: "script", label: "Script", icon: "file-text", color: "amber" },
    { key: "voiceover", label: "Voice", icon: "message", color: "orange" },
    { key: "editing", label: "Editing", icon: "film", color: "rose" },
    { key: "thumbnail", label: "Thumbnail", icon: "image", color: "amber" },
    { key: "seo", label: "SEO", icon: "trending-up", color: "emerald" },
    { key: "upload", label: "Upload", icon: "upload", color: "teal" },
    { key: "publish", label: "Publish", icon: "youtube", color: "emerald" },
    { key: "analytics", label: "Analytics", icon: "bar-chart-3", color: "amber" },
  ];

const stageMetaByKey = (key: string) =>
  STAGE_META.find((s) => s.key === key) ?? STAGE_META[0];

const STATUS_META: Record<
  WorkflowStatus,
  { label: string; color: string; icon: string }
> = {
  active: { label: "Active", color: "emerald", icon: "play" },
  paused: { label: "Paused", color: "amber", icon: "pause" },
  completed: { label: "Completed", color: "emerald", icon: "check-circle" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseStages(raw: string): StageEntry[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Ensure every standard stage is represented (preserves server order
    // but normalizes missing keys by falling back to the standard set).
    return parsed
      .filter(
        (s): s is StageEntry =>
          !!s &&
          typeof s === "object" &&
          typeof s.key === "string" &&
          typeof s.label === "string" &&
          typeof s.done === "boolean"
      )
      .map((s) => ({ key: s.key, label: s.label, done: s.done }));
  } catch {
    return [];
  }
}

/** Normalize a workflow's stages against the canonical 10-stage pipeline,
 *  returning a fixed-length array in the standard order. */
function normalizeStages(raw: string): StageEntry[] {
  const parsed = parseStages(raw);
  const byKey = new Map(parsed.map((s) => [s.key.toLowerCase(), s]));
  return STAGE_META.map((m) => {
    const found = byKey.get(m.key);
    return found ?? { key: m.key, label: m.label, done: false };
  });
}

// ─── Section component ───────────────────────────────────────────────────────

export function AutomationSection() {
  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Workflow | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    videoTitle: "",
    channelName: "",
  });
  const [recentlyCompleted, setRecentlyCompleted] = React.useState<
    Record<string, string>
  >({}); // workflowId+stageKey → timestamp

  // ── Data loading ────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<{ workflows: Workflow[] }>("/api/workflows");
      setWorkflows(data.workflows ?? []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChannels = React.useCallback(async () => {
    try {
      const data = await api<{ channels: Channel[] }>("/api/channels");
      setChannels(data.channels ?? []);
    } catch {
      // Non-fatal — channel select just stays empty.
    }
  }, []);

  React.useEffect(() => {
    load();
    loadChannels();
  }, [load, loadChannels]);

  // ── Summary stats ───────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    const total = workflows.length;
    const active = workflows.filter((w) => w.status === "active").length;
    const completed = workflows.filter((w) => w.status === "completed").length;
    const avgProgress =
      total > 0
        ? Math.round(
            workflows.reduce((sum, w) => sum + (w.progress ?? 0), 0) / total
          )
        : 0;
    return { total, active, completed, avgProgress };
  }, [workflows]);

  // ── Dialog handlers ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", videoTitle: "", channelName: "" });
    setDialogOpen(true);
  };

  const openEdit = (w: Workflow) => {
    setEditing(w);
    setForm({
      name: w.name,
      videoTitle: w.videoTitle,
      channelName: w.channelName,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Workflow name is required");
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await api(`/api/workflows/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            videoTitle: form.videoTitle.trim(),
            channelName: form.channelName.trim(),
          }),
        });
        toast.success("Workflow updated");
      } else {
        await api("/api/workflows", {
          method: "POST",
          body: JSON.stringify({
            name,
            videoTitle: form.videoTitle.trim(),
            channelName: form.channelName.trim(),
          }),
        });
        toast.success("Workflow created");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(editing ? "Failed to update workflow" : "Failed to create workflow");
    } finally {
      setSaving(false);
    }
  };

  const toggleStage = async (workflowId: string, stageKey: string) => {
    // Snapshot for optimistic UI + detection of completion events.
    const snapshot = workflows.find((w) => w.id === workflowId);
    const stagesBefore = snapshot ? normalizeStages(snapshot.stages) : [];
    const stageBefore = stagesBefore.find((s) => s.key === stageKey);
    const wasDoneBefore = !!stageBefore?.done;

    // After flipping, will every stage be done?
    const willCompleteAll =
      !wasDoneBefore &&
      stagesBefore.length > 0 &&
      stagesBefore.every((s) => s.done || s.key === stageKey);

    // Optimistic update of local state for instant feedback.
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id !== workflowId) return w;
        const stages = normalizeStages(w.stages).map((s) =>
          s.key === stageKey ? { ...s, done: !s.done } : s
        );
        const doneCount = stages.filter((s) => s.done).length;
        const total = stages.length || 1;
        const progress = Math.round((doneCount / total) * 100);
        const allDone = doneCount === total && total > 0;
        const status: WorkflowStatus = allDone ? "completed" : "active";
        return { ...w, stages: JSON.stringify(stages), progress, status };
      })
    );

    // Visual + toast: brief emerald pulse on the node when completing it.
    if (!wasDoneBefore) {
      const id = `${workflowId}:${stageKey}`;
      setRecentlyCompleted((p) => ({ ...p, [id]: String(Date.now()) }));
      window.setTimeout(() => {
        setRecentlyCompleted((p) => {
          const n = { ...p };
          delete n[id];
          return n;
        });
      }, 1100);
      toast.success(`${stageMetaByKey(stageKey).label} stage completed`, {
        description: "Nice — pipeline momentum gained.",
      });
    }
    if (willCompleteAll) {
      toast.success("Workflow completed 🎉", {
        description: "Every stage done — pipeline shipped.",
      });
    }

    try {
      await api(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        body: JSON.stringify({ toggleStage: stageKey }),
      });
      // Refresh server truth silently to keep progress/status in sync.
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to toggle stage");
      await load();
    }
  };

  const setStatus = async (w: Workflow, status: WorkflowStatus) => {
    // Optimistic.
    setWorkflows((prev) =>
      prev.map((x) => (x.id === w.id ? { ...x, status } : x))
    );
    try {
      await api(`/api/workflows/${w.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(`Workflow marked as ${status}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status");
      await load();
    }
  };

  const remove = async (w: Workflow) => {
    const snapshot = workflows;
    setWorkflows((prev) => prev.filter((x) => x.id !== w.id));
    try {
      await api(`/api/workflows/${w.id}`, { method: "DELETE" });
      toast.success("Workflow deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete workflow");
      setWorkflows(snapshot);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Automation"
        description="Production pipelines from idea to analytics"
        icon="workflow"
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Icon name="plus" className="size-4" />
            New Workflow
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Active Workflows"
          value={stats.active}
          icon="play"
          color="emerald"
          delay={0}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon="check-circle"
          color="teal"
          delay={0.05}
        />
        <StatCard
          label="Avg Progress"
          value={`${stats.avgProgress}%`}
          icon="gauge"
          color="amber"
          delay={0.1}
        />
        <StatCard
          label="Total Pipelines"
          value={stats.total}
          icon="workflow"
          color="rose"
          delay={0.15}
        />
      </div>

      {/* Template explanation card */}
      <TemplatePipeline />

      {/* Workflows list */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <WorkflowSkeleton key={i} />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <Card className="glass border-border/60">
          <EmptyState
            icon="workflow"
            title="No workflows yet"
            description="Spin up your first production pipeline and track every stage from idea to analytics."
            action={
              <Button onClick={openCreate} className="gap-2">
                <Icon name="plus" className="size-4" />
                New Workflow
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {workflows.map((w, idx) => (
              <WorkflowCard
                key={w.id}
                workflow={w}
                index={idx}
                recentlyCompleted={recentlyCompleted}
                onToggleStage={(stageKey) => toggleStage(w.id, stageKey)}
                onEdit={() => openEdit(w)}
                onDelete={() => remove(w)}
                onSetStatus={(s) => setStatus(w, s)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit workflow" : "New workflow"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the pipeline details."
                : "Spin up a new 10-stage production pipeline."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wf-name">
                Workflow name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="wf-name"
                value={form.name}
                autoFocus
                placeholder="e.g. Discipline video pipeline"
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wf-title">Video title</Label>
              <Input
                id="wf-title"
                value={form.videoTitle}
                placeholder="e.g. How to Build Discipline"
                onChange={(e) =>
                  setForm((f) => ({ ...f, videoTitle: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wf-channel">Channel</Label>
              {channels.length > 0 ? (
                <Select
                  value={form.channelName}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, channelName: v }))
                  }
                >
                  <SelectTrigger id="wf-channel" className="w-full">
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— No channel —</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              colorFor(c.color || "emerald").dot
                            )}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="wf-channel"
                  value={form.channelName}
                  placeholder="Channel name"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, channelName: e.target.value }))
                  }
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving && <Icon name="refresh" className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Template pipeline (static visual) ───────────────────────────────────────

function TemplatePipeline() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card className="glass border-border/60 p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 size-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 size-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="flex items-center justify-between gap-3 mb-4 relative">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-primary/10 grid place-items-center">
              <Icon name="workflow" className="size-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Standard pipeline</p>
              <p className="text-xs text-muted-foreground">
                10 stages every workflow ships through
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Icon name="list-checks" className="size-3" />
            10 stages
          </Badge>
        </div>

        <div className="relative overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          <div className="flex items-start gap-0 min-w-max">
            {STAGE_META.map((s, i) => {
              const c = colorFor(s.color);
              return (
                <React.Fragment key={s.key}>
                  <div className="flex flex-col items-center min-w-[78px] px-1">
                    <div
                      className={cn(
                        "size-10 rounded-full grid place-items-center border",
                        c.soft,
                        "border-transparent"
                      )}
                    >
                      <Icon name={s.icon} className="size-4.5" />
                    </div>
                    <span className="mt-1.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                      {s.label}
                    </span>
                  </div>
                  {i < STAGE_META.length - 1 && (
                    <div className="flex items-start pt-5">
                      <svg
                        width="22"
                        height="10"
                        viewBox="0 0 22 10"
                        className="text-muted-foreground/40"
                        aria-hidden
                      >
                        <defs>
                          <linearGradient
                            id={`tpl-grad-${i}`}
                            x1="0"
                            x2="1"
                            y1="0"
                            y2="0"
                          >
                            <stop
                              offset="0%"
                              stopColor="currentColor"
                              stopOpacity="0.1"
                            />
                            <stop
                              offset="100%"
                              stopColor="currentColor"
                              stopOpacity="0.6"
                            />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0 5 H16"
                          stroke={`url(#tpl-grad-${i})`}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeDasharray="2 3"
                        />
                        <path
                          d="M14 1 L20 5 L14 9"
                          fill="none"
                          stroke="currentColor"
                          strokeOpacity="0.55"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Workflow card ───────────────────────────────────────────────────────────

interface WorkflowCardProps {
  workflow: Workflow;
  index: number;
  recentlyCompleted: Record<string, string>;
  onToggleStage: (stageKey: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetStatus: (status: WorkflowStatus) => void;
}

function WorkflowCard({
  workflow,
  index,
  recentlyCompleted,
  onToggleStage,
  onEdit,
  onDelete,
  onSetStatus,
}: WorkflowCardProps) {
  const stages = normalizeStages(workflow.stages);
  const doneCount = stages.filter((s) => s.done).length;
  const total = stages.length || 1;
  const pct = Math.round((doneCount / total) * 100);

  // "Current/next" stage = the first not-done stage; pulses.
  const currentIdx = stages.findIndex((s) => !s.done);
  const isCompleted = workflow.status === "completed" || doneCount === total;

  const statusMeta = STATUS_META[workflow.status] ?? STATUS_META.active;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{
        duration: 0.32,
        delay: Math.min(index * 0.05, 0.25),
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      <Card className="glass border-border/60 p-5 sm:p-6 relative overflow-hidden lift">
        {/* Soft accent glow that shifts with status */}
        <div
          className={cn(
            "absolute -top-12 -right-12 size-40 rounded-full blur-3xl opacity-25",
            workflow.status === "completed"
              ? "bg-emerald-500"
              : workflow.status === "paused"
                ? "bg-amber-500"
                : "bg-teal-500"
          )}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5 relative">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-base font-semibold tracking-tight truncate">
                {workflow.name}
              </h3>
              <Pill
                color={statusMeta.color}
                icon={statusMeta.icon}
              >
                {statusMeta.label}
              </Pill>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {workflow.videoTitle && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="film" className="size-3.5" />
                  <span className="truncate max-w-[28ch]">
                    {workflow.videoTitle}
                  </span>
                </span>
              )}
              {workflow.channelName && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="youtube" className="size-3.5" />
                  <span className="truncate max-w-[20ch]">
                    {workflow.channelName}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums leading-none">
                {pct}
                <span className="text-base text-muted-foreground">%</span>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                {doneCount}/{total} done
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Workflow actions">
                  <Icon name="more-horizontal" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onEdit} className="gap-2">
                  <Icon name="edit" className="size-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    onSetStatus(
                      workflow.status === "paused" ? "active" : "paused"
                    )
                  }
                  className="gap-2"
                >
                  <Icon name="pause" className="size-3.5" />
                  {workflow.status === "paused" ? "Resume" : "Pause"}
                </DropdownMenuItem>
                {!isCompleted && (
                  <DropdownMenuItem
                    onClick={() => onSetStatus("completed")}
                    className="gap-2"
                  >
                    <Icon name="check-circle" className="size-3.5" />
                    Mark completed
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="gap-2 text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400"
                >
                  <Icon name="trash" className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Horizontal stepper (scrollable on mobile) */}
        <div className="relative -mx-1 px-1">
          <div className="flex items-start gap-0 overflow-x-auto pb-2 min-w-max scrollbar-thin">
            {stages.map((s, i) => {
              const meta = stageMetaByKey(s.key);
              const c = colorFor(meta.color);
              const isCurrent = i === currentIdx && !isCompleted;
              const pulseKey = `${workflow.id}:${s.key}`;
              const justCompleted = !!recentlyCompleted[pulseKey];

              return (
                <React.Fragment key={s.key}>
                  <button
                    type="button"
                    onClick={() => onToggleStage(s.key)}
                    aria-pressed={s.done}
                    aria-label={`${meta.label} stage — ${s.done ? "done" : "not done"}`}
                    className="group flex flex-col items-center min-w-[80px] px-1 focus:outline-none"
                  >
                    <div className="relative">
                      {/* Pulse ring for current/next stage */}
                      {isCurrent && (
                        <motion.span
                          className={cn(
                            "absolute inset-0 rounded-full",
                            c.bg,
                            "opacity-30"
                          )}
                          animate={{ scale: [1, 1.45, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{
                            duration: 1.8,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      )}
                      {/* Emerald completion pulse */}
                      <AnimatePresence>
                        {justCompleted && (
                          <motion.span
                            className="absolute inset-0 rounded-full bg-emerald-500"
                            initial={{ opacity: 0.5, scale: 1 }}
                            animate={{ opacity: 0, scale: 1.9 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        )}
                      </AnimatePresence>

                      <motion.div
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        className={cn(
                          "relative size-10 rounded-full grid place-items-center border-2 transition-colors",
                          s.done
                            ? cn(c.soft, "border-transparent")
                            : "bg-muted/40 text-muted-foreground border-border/60 group-hover:border-primary/40"
                        )}
                      >
                        {s.done ? (
                          <Icon name={meta.icon} className="size-4.5" />
                        ) : (
                          <Icon
                            name={meta.icon}
                            className="size-4.5 opacity-60"
                          />
                        )}
                        {s.done && (
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full grid place-items-center text-white",
                              c.bg
                            )}
                          >
                            <Icon name="check" className="size-2.5" strokeWidth={3} />
                          </span>
                        )}
                      </motion.div>
                    </div>
                    <span
                      className={cn(
                        "mt-1.5 text-[11px] font-medium whitespace-nowrap transition-colors",
                        s.done
                          ? "text-foreground"
                          : isCurrent
                            ? cn(c.text, "font-semibold")
                            : "text-muted-foreground"
                      )}
                    >
                      {meta.label}
                    </span>
                  </button>

                  {/* Connector */}
                  {i < stages.length - 1 && (
                    <div className="flex items-start pt-5">
                      <Connector
                        done={s.done && stages[i + 1].done}
                        index={i}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Footer: overall progress */}
        <div className="mt-4 relative">
          <Separator className="mb-4 bg-border/60" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="activity" className="size-3.5" />
              <span>
                {isCompleted
                  ? "Pipeline complete"
                  : currentIdx >= 0
                    ? `Up next: ${stageMetaByKey(stages[currentIdx].key).label}`
                    : "All stages done"}
              </span>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {workflow.progress ?? pct}%
            </span>
          </div>
          <div className="mt-2">
            <Progress
              value={workflow.progress ?? pct}
              color={
                workflow.status === "completed"
                  ? "emerald"
                  : workflow.status === "paused"
                    ? "amber"
                    : "teal"
              }
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function Connector({
  done,
  index,
}: {
  done: boolean;
  index: number;
}) {
  if (done) {
    // Emerald gradient line — solid when both endpoints are done.
    return (
      <svg
        width="20"
        height="4"
        viewBox="0 0 20 4"
        className="overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient
            id={`conn-grad-${index}`}
            x1="0"
            x2="1"
            y1="0"
            y2="0"
          >
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          y1="2"
          x2="20"
          y2="2"
          stroke={`url(#conn-grad-${index})`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // Dashed muted line.
  return (
    <svg
      width="20"
      height="2"
      viewBox="0 0 20 2"
      className="text-muted-foreground/50"
      aria-hidden
    >
      <line
        x1="0"
        y1="1"
        x2="20"
        y2="1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 3"
      />
      <title>{`connector-${index}`}</title>
    </svg>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function WorkflowSkeleton() {
  return (
    <Card className="glass border-border/60 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-2">
          <div className="h-4 w-48 rounded shimmer bg-muted/60" />
          <div className="h-3 w-32 rounded shimmer bg-muted/40" />
        </div>
        <div className="h-8 w-12 rounded shimmer bg-muted/50" />
      </div>
      <div className="flex items-start gap-0 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center min-w-[80px] px-1"
          >
            <div className="size-10 rounded-full shimmer bg-muted/50" />
            <div className="mt-1.5 h-2.5 w-12 rounded shimmer bg-muted/40" />
          </div>
        ))}
      </div>
      <div className="mt-5 h-1.5 w-full rounded-full shimmer bg-muted/40" />
    </Card>
  );
}
