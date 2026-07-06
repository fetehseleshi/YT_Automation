"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  SectionHeader,
  StatCard,
  EmptyState,
  Pill,
  Progress,
  PageTransition,
} from "@/components/shared/ui";
import { YoutubeConnectPanel } from "@/components/youtube-connect-panel";
import { Icon } from "@/components/icon";
import { api, formatNumber, formatMoney, formatDate, colorFor } from "@/lib/api";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Separator } from "@/components/ui/separator";

// ─── Types ───────────────────────────────────────────────────────────────
type ChannelStatus = "active" | "paused" | "growth" | "new";
type ChannelColor = "emerald" | "amber" | "rose" | "teal" | "orange";

interface Channel {
  id: string;
  name: string;
  niche: string;
  language: string;
  country: string;
  status: string;
  monetized: boolean;
  adsenseAccount: string;
  logoUrl: string;
  bannerUrl: string;
  description: string;
  keywords: string;
  socialLinks: string;
  notes: string;
  goals: string;
  subscribers: number;
  views: number;
  watchHours: number;
  revenue: number;
  rpm: number;
  healthScore: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface ChannelPayload {
  name: string;
  niche: string;
  language: string;
  country: string;
  status: string;
  monetized: boolean;
  adsenseAccount: string;
  logoUrl: string;
  bannerUrl: string;
  description: string;
  keywords: string;
  socialLinks: string;
  notes: string;
  goals: string;
  subscribers: number;
  views: number;
  watchHours: number;
  revenue: number;
  rpm: number;
  healthScore: number;
  color: string;
}

// ─── Color + status maps ──────────────────────────────────────────────────
const COLOR_OPTIONS: ChannelColor[] = ["emerald", "amber", "rose", "teal", "orange"];

const BANNER_GRADIENTS: Record<ChannelColor, string> = {
  emerald:
    "from-emerald-500/80 via-teal-500/60 to-emerald-500/40",
  amber: "from-amber-500/80 via-orange-500/60 to-amber-500/40",
  rose: "from-rose-500/80 via-pink-500/60 to-rose-500/40",
  teal: "from-teal-500/80 via-emerald-500/60 to-teal-500/40",
  orange: "from-orange-500/80 via-amber-500/60 to-orange-500/40",
};

const AVATAR_GRADIENTS: Record<ChannelColor, string> = {
  emerald: "from-emerald-400 to-teal-600",
  amber: "from-amber-400 to-orange-600",
  rose: "from-rose-400 to-pink-600",
  teal: "from-teal-400 to-emerald-600",
  orange: "from-orange-400 to-amber-600",
};

const STATUS_COLOR: Record<ChannelStatus, string> = {
  active: "emerald",
  growth: "amber",
  paused: "rose",
  new: "teal",
};

const HEALTH_COLOR = (score: number): string => {
  if (score >= 80) return "emerald";
  if (score >= 60) return "amber";
  return "rose";
};

const STATUS_OPTIONS: { value: ChannelStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "growth", label: "Growth" },
  { value: "paused", label: "Paused" },
  { value: "new", label: "New" },
];

// ─── Empty form state ─────────────────────────────────────────────────────
const EMPTY_FORM: ChannelPayload = {
  name: "",
  niche: "",
  language: "English",
  country: "United States",
  status: "active",
  monetized: false,
  adsenseAccount: "",
  logoUrl: "",
  bannerUrl: "",
  description: "",
  keywords: "",
  socialLinks: "{}",
  notes: "",
  goals: "",
  subscribers: 0,
  views: 0,
  watchHours: 0,
  revenue: 0,
  rpm: 0,
  healthScore: 80,
  color: "emerald",
};

function channelToForm(c: Channel): ChannelPayload {
  return {
    name: c.name,
    niche: c.niche,
    language: c.language,
    country: c.country,
    status: c.status,
    monetized: c.monetized,
    adsenseAccount: c.adsenseAccount,
    logoUrl: c.logoUrl,
    bannerUrl: c.bannerUrl,
    description: c.description,
    keywords: c.keywords,
    socialLinks: c.socialLinks,
    notes: c.notes,
    goals: c.goals,
    subscribers: c.subscribers,
    views: c.views,
    watchHours: c.watchHours,
    revenue: c.revenue,
    rpm: c.rpm,
    healthScore: c.healthScore,
    color: c.color,
  };
}

// ─── Section component ────────────────────────────────────────────────────
export function ChannelsSection() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState<ChannelPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ channels: Channel[] }>("/api/channels");
      setChannels(data.channels ?? []);
    } catch (e) {
      toast.error("Failed to load channels", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (c: Channel) => {
    setEditing(c);
    setForm(channelToForm(c));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Channel name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/channels/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        toast.success("Channel updated", { description: form.name });
      } else {
        await api("/api/channels", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Channel created", { description: form.name });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(editing ? "Failed to update channel" : "Failed to create channel", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/channels/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Channel deleted", { description: deleteTarget.name });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error("Failed to delete channel", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Derived stats ───────────────────────────────────────────────────
  const totalChannels = channels.length;
  const monetizedCount = channels.filter((c) => c.monetized).length;
  const totalSubs = channels.reduce((acc, c) => acc + (c.subscribers || 0), 0);
  const totalRevenue = channels.reduce((acc, c) => acc + (c.revenue || 0), 0);

  return (
    <PageTransition>
      <SectionHeader
        title="Channels"
        description="Manage all your YouTube channels in one place"
        icon="youtube"
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Icon name="plus" className="size-4" />
            New Channel
          </Button>
        }
      />

      {/* YouTube official OAuth connect + sync status */}
      <YoutubeConnectPanel />

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="Total Channels"
          value={totalChannels}
          icon="youtube"
          color="emerald"
          delay={0.02}
        />
        <StatCard
          label="Monetized"
          value={monetizedCount}
          icon="dollar"
          color="amber"
          delay={0.08}
        />
        <StatCard
          label="Total Subscribers"
          value={formatNumber(totalSubs)}
          icon="users2"
          color="teal"
          delay={0.14}
        />
        <StatCard
          label="Total Revenue"
          value={formatMoney(totalRevenue)}
          icon="wallet"
          color="rose"
          delay={0.2}
        />
      </div>

      {/* Channel grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon="youtube"
            title="No channels yet"
            description="Create your first YouTube channel to start tracking subscribers, revenue, and performance."
            action={
              <Button onClick={openCreate} className="gap-2">
                <Icon name="plus" className="size-4" />
                New Channel
              </Button>
            }
          />
        </Card>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {channels.map((c) => (
            <ChannelCard
              key={c.id}
              channel={c}
              onEdit={() => openEdit(c)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </motion.div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="youtube" className="size-5 text-primary" />
              {editing ? "Edit Channel" : "Create New Channel"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-1">
            {/* Basic Info */}
            <FormSection
              title="Basic Info"
              icon="info"
              description="Identity & status"
            >
              <Field label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mindful Momentum"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Niche">
                  <Input
                    value={form.niche}
                    onChange={(e) =>
                      setForm({ ...form, niche: e.target.value })
                    }
                    placeholder="Self Improvement"
                  />
                </Field>
                <Field label="Language">
                  <Input
                    value={form.language}
                    onChange={(e) =>
                      setForm({ ...form, language: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <Input
                    value={form.country}
                    onChange={(e) =>
                      setForm({ ...form, country: e.target.value })
                    }
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Color accent">
                  <Select
                    value={form.color}
                    onValueChange={(v) => setForm({ ...form, color: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Color" />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="capitalize">{c}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Monetized">
                  <div className="flex items-center h-9">
                    <Switch
                      checked={form.monetized}
                      onCheckedChange={(v) =>
                        setForm({ ...form, monetized: v })
                      }
                    />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {form.monetized ? "Monetized" : "Not monetized"}
                    </span>
                  </div>
                </Field>
              </div>
            </FormSection>

            <Separator />

            {/* Metrics */}
            <FormSection
              title="Metrics"
              icon="bar-chart-3"
              description="Performance numbers"
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Subscribers">
                  <Input
                    type="number"
                    value={form.subscribers}
                    onChange={(e) =>
                      setForm({ ...form, subscribers: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Views">
                  <Input
                    type="number"
                    value={form.views}
                    onChange={(e) =>
                      setForm({ ...form, views: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Watch Hours">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.watchHours}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        watchHours: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Revenue ($)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.revenue}
                    onChange={(e) =>
                      setForm({ ...form, revenue: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="RPM ($)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.rpm}
                    onChange={(e) =>
                      setForm({ ...form, rpm: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Health Score (0-100)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.healthScore}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        healthScore: Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
            </FormSection>

            <Separator />

            {/* Branding */}
            <FormSection
              title="Branding"
              icon="palette"
              description="Logos, descriptions, keywords"
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Logo URL">
                  <Input
                    value={form.logoUrl}
                    onChange={(e) =>
                      setForm({ ...form, logoUrl: e.target.value })
                    }
                    placeholder="https://…"
                  />
                </Field>
                <Field label="Banner URL">
                  <Input
                    value={form.bannerUrl}
                    onChange={(e) =>
                      setForm({ ...form, bannerUrl: e.target.value })
                    }
                    placeholder="https://…"
                  />
                </Field>
              </div>
              <Field label="Description">
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  placeholder="What is this channel about?"
                />
              </Field>
              <Field label="Keywords (comma separated)">
                <Input
                  value={form.keywords}
                  onChange={(e) =>
                    setForm({ ...form, keywords: e.target.value })
                  }
                  placeholder="productivity, habits, mindset"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Social Links (JSON)">
                  <Input
                    value={form.socialLinks}
                    onChange={(e) =>
                      setForm({ ...form, socialLinks: e.target.value })
                    }
                    placeholder='{"twitter":"@handle"}'
                  />
                </Field>
                <Field label="AdSense Account">
                  <Input
                    value={form.adsenseAccount}
                    onChange={(e) =>
                      setForm({ ...form, adsenseAccount: e.target.value })
                    }
                    placeholder="adsense-xxx"
                  />
                </Field>
              </div>
            </FormSection>

            <Separator />

            {/* Notes & Goals */}
            <FormSection
              title="Notes & Goals"
              icon="clipboard-list"
              description="Strategy & reminders"
            >
              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="Internal notes about this channel…"
                />
              </Field>
              <Field label="Goals">
                <Textarea
                  value={form.goals}
                  onChange={(e) =>
                    setForm({ ...form, goals: e.target.value })
                  }
                  rows={2}
                  placeholder="Reach 500K subscribers by Q4"
                />
              </Field>
            </FormSection>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Icon name="refresh" className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Icon name="check" className="size-4" />
                  {editing ? "Save Changes" : "Create Channel"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete channel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              and remove it from the dashboard. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-500 hover:bg-rose-600 text-white gap-1"
            >
              {deleting ? (
                <Icon name="refresh" className="size-4 animate-spin" />
              ) : (
                <Icon name="trash" className="size-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}

// ─── Channel card ─────────────────────────────────────────────────────────
function ChannelCard({
  channel,
  onEdit,
  onDelete,
}: {
  channel: Channel;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = (channel.color as ChannelColor) || "emerald";
  const status = (channel.status as ChannelStatus) || "active";
  const banner = BANNER_GRADIENTS[color];
  const avatar = AVATAR_GRADIENTS[color];
  const healthColor = HEALTH_COLOR(channel.healthScore);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] },
        },
      }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="lift"
    >
      <Card className="overflow-hidden p-0 gap-0 border-border/60 hover:border-border">
        {/* Banner */}
        <div
          className={cn(
            "relative h-20 bg-gradient-to-br",
            banner
          )}
        >
          {channel.bannerUrl && (
            <img
              src={channel.bannerUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
            />
          )}
          <div className="absolute inset-0 bg-black/10" />

          {/* Avatar + identity */}
          <div className="absolute -bottom-6 left-4 flex items-end gap-3">
            <div
              className={cn(
                "size-14 rounded-2xl bg-gradient-to-br grid place-items-center text-white font-bold text-xl ring-2 ring-background shadow-lg overflow-hidden",
                avatar
              )}
            >
              {channel.logoUrl ? (
                <img
                  src={channel.logoUrl}
                  alt={channel.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                channel.name.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          {/* Status pill */}
          <div className="absolute top-2 right-2">
            <Pill color={STATUS_COLOR[status] || "emerald"}>
              <span className="capitalize">{status}</span>
            </Pill>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pt-8 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight truncate">
                {channel.name}
              </h3>
              {channel.niche && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {channel.niche}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onEdit}
                aria-label="Edit channel"
              >
                <Icon name="edit" className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                onClick={onDelete}
                aria-label="Delete channel"
              >
                <Icon name="trash" className="size-4" />
              </Button>
            </div>
          </div>

          {/* Metrics grid 2x3 */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Metric label="Subs" value={formatNumber(channel.subscribers)} />
            <Metric label="Views" value={formatNumber(channel.views)} />
            <Metric
              label="Watch hrs"
              value={formatNumber(channel.watchHours)}
            />
            <Metric
              label="Revenue"
              value={formatMoney(channel.revenue)}
            />
            <Metric label="RPM" value={`$${channel.rpm.toFixed(2)}`} />
            <Metric
              label="Health"
              value={channel.healthScore.toString()}
            />
          </div>

          {/* Health progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Icon name="gauge" className="size-3" />
                Health Score
              </span>
              <span
                className={cn(
                  "font-semibold",
                  colorFor(healthColor).text
                )}
              >
                {channel.healthScore}/100
              </span>
            </div>
            <Progress value={channel.healthScore} color={healthColor} />
          </div>

          <Separator />

          {/* Footer row */}
          <div className="flex items-center justify-between gap-2">
            {channel.monetized ? (
              <Pill color="emerald" icon="check-circle-2">
                Monetized
              </Pill>
            ) : (
              <Pill color="rose" icon="circle">
                Not Monetized
              </Pill>
            )}
            <span className="text-[11px] text-muted-foreground">
              Created {formatDate(channel.createdAt)}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Small metric cell ────────────────────────────────────────────────────
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2 border border-border/40">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums truncate">{value}</p>
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────
function FormSection({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-lg bg-primary/10 grid place-items-center">
          <Icon name={icon} className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-3 pl-1">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <Card className="overflow-hidden p-0 gap-0">
      <div className="h-20 bg-muted/40 shimmer" />
      <div className="px-4 pt-8 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-muted/60 shimmer" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 w-2/3 rounded bg-muted/60 shimmer" />
            <div className="h-2.5 w-1/3 rounded bg-muted/40 shimmer" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-muted/40 shimmer"
            />
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-muted/40 shimmer" />
      </div>
    </Card>
  );
}
