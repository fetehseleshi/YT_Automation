"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import {
  SectionHeader,
  StatCard,
  EmptyState,
  Pill,
  Progress,
} from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api, formatMoney, colorFor } from "@/lib/api";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role =
  | "Script Writer"
  | "Editor"
  | "Voice Artist"
  | "Thumbnail Designer"
  | "SEO"
  | "Manager";

type MemberStatus = "active" | "inactive";

interface Member {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarUrl: string;
  status: string;
  rate: number;
  skills: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  totalTasks: number;
  openTasks: number;
}

interface FormState {
  name: string;
  role: Role;
  email: string;
  avatarUrl: string;
  status: MemberStatus;
  rate: string; // kept as string for the number input
  skills: string;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: Role[] = [
  "Script Writer",
  "Editor",
  "Voice Artist",
  "Thumbnail Designer",
  "SEO",
  "Manager",
];

const ROLE_META: Record<Role, { icon: string; color: string; gradient: string }> = {
  "Script Writer": { icon: "file-text", color: "emerald", gradient: "from-emerald-500 to-teal-600" },
  Editor: { icon: "film", color: "amber", gradient: "from-amber-500 to-orange-600" },
  "Voice Artist": { icon: "message", color: "rose", gradient: "from-rose-500 to-rose-700" },
  "Thumbnail Designer": { icon: "image", color: "teal", gradient: "from-teal-500 to-emerald-600" },
  SEO: { icon: "trending-up", color: "orange", gradient: "from-orange-500 to-amber-600" },
  Manager: { icon: "users", color: "emerald", gradient: "from-emerald-500 to-emerald-700" },
};

function roleMeta(role: string) {
  return ROLE_META[role as Role] ?? ROLE_META.Manager;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

const EMPTY_FORM: FormState = {
  name: "",
  role: "Manager",
  email: "",
  avatarUrl: "",
  status: "active",
  rate: "",
  skills: "",
  notes: "",
};

// ─── Section ─────────────────────────────────────────────────────────────────

export function TeamSection() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Member | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ members: Member[] }>("/api/team");
      setMembers(data.members);
    } catch (e) {
      toast.error("Failed to load team", {
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // ─── Summary stats ──────────────────────────────────────────────────────
  const total = members.length;
  const active = members.filter((m) => m.status === "active").length;
  const rolesCovered = new Set(members.map((m) => m.role)).size;
  const avgRate =
    total > 0 ? members.reduce((s, m) => s + (m.rate || 0), 0) / total : 0;

  const roleCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of members) map[m.role] = (map[m.role] || 0) + 1;
    return map;
  }, [members]);

  const filtered =
    roleFilter === "all" ? members : members.filter((m) => m.role === roleFilter);

  // ─── Dialog handlers ────────────────────────────────────────────────────
  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      name: m.name,
      role: (ROLES.includes(m.role as Role) ? m.role : "Manager") as Role,
      email: m.email,
      avatarUrl: m.avatarUrl,
      status: m.status === "inactive" ? "inactive" : "active",
      rate: m.rate ? String(m.rate) : "",
      skills: m.skills,
      notes: m.notes,
    });
    setDialogOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        role: form.role,
        email: form.email.trim(),
        avatarUrl: form.avatarUrl.trim(),
        status: form.status,
        rate: form.rate === "" ? 0 : Number(form.rate),
        skills: form.skills.trim(),
        notes: form.notes.trim(),
      };
      if (editing) {
        await api(`/api/team/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Member updated", { description: name });
      } else {
        await api("/api/team", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Member added", { description: name });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(editing ? "Failed to update member" : "Failed to add member", {
        description: (e as Error).message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const id = deletingId;
    setDeletingId(null);
    if (!id) return;
    try {
      await api(`/api/team/${id}`, { method: "DELETE" });
      toast.success("Member removed");
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      toast.error("Failed to delete member", {
        description: (e as Error).message,
      });
      await load();
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Team"
        description="Your creative crew — ready to scale with outsourcing"
        icon="users"
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Icon name="plus" className="size-4" />
            Invite Member
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Members"
          value={total}
          icon="users2"
          color="emerald"
          delay={0}
        />
        <StatCard
          label="Active"
          value={active}
          icon="check-circle"
          color="teal"
          delay={0.05}
          hint={`${total - active} inactive`}
        />
        <StatCard
          label="Roles Covered"
          value={rolesCovered}
          icon="layout-grid"
          color="amber"
          delay={0.1}
          hint={`of ${ROLES.length}`}
        />
        <StatCard
          label="Avg Hourly Rate"
          value={formatMoney(avgRate)}
          icon="dollar"
          color="orange"
          delay={0.15}
          hint="per hour"
        />
      </div>

      {/* Role filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={roleFilter === "all"}
          onClick={() => setRoleFilter("all")}
          label="All"
          count={total}
          color="emerald"
          icon="users2"
        />
        {ROLES.map((r) => {
          const meta = ROLE_META[r];
          return (
            <FilterChip
              key={r}
              active={roleFilter === r}
              onClick={() => setRoleFilter(r)}
              label={r}
              count={roleCounts[r] || 0}
              color={meta.color}
              icon={meta.icon}
            />
          );
        })}
      </div>

      {/* Members grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <MemberSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="users2"
          title={
            members.length === 0
              ? "No team members yet"
              : "No members match this role"
          }
          description={
            members.length === 0
              ? "Invite your first collaborator to start scaling production."
              : "Try a different role filter, or invite someone for this role."
          }
          action={
            <Button onClick={openCreate} className="gap-1.5">
              <Icon name="plus" className="size-4" />
              Invite Member
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((m, i) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(i * 0.04, 0.3),
                  ease: [0.2, 0.8, 0.2, 1],
                }}
              >
                <MemberCard
                  member={m}
                  onEdit={() => openEdit(m)}
                  onDelete={() => setDeletingId(m.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon
                name={editing ? "edit" : "plus"}
                className="size-4 text-primary"
              />
              {editing ? "Edit Member" : "Invite Member"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update profile, role, and rate for this collaborator."
                : "Add a new collaborator to your creative crew."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tm-name">
                Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="tm-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Alex Rivera"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tm-role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
                >
                  <SelectTrigger id="tm-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tm-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as MemberStatus }))
                  }
                >
                  <SelectTrigger id="tm-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="tm-email"
                  type="email"
                  className="pl-8"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="alex@studio.io"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tm-avatar">Avatar URL</Label>
                <Input
                  id="tm-avatar"
                  value={form.avatarUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, avatarUrl: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tm-rate">Rate ($/hr)</Label>
                <Input
                  id="tm-rate"
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.rate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rate: e.target.value }))
                  }
                  placeholder="35"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-skills">
                Skills{" "}
                <span className="text-xs text-muted-foreground">
                  (comma separated)
                </span>
              </Label>
              <Input
                id="tm-skills"
                value={form.skills}
                onChange={(e) =>
                  setForm((f) => ({ ...f, skills: e.target.value }))
                }
                placeholder="Research, storytelling, hooks"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-notes">Notes</Label>
              <Textarea
                id="tm-notes"
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Strengths, turnaround time, etc."
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving ? (
                  <Icon name="refresh" className="size-4 animate-spin" />
                ) : (
                  <Icon name="check" className="size-4" />
                )}
                {editing ? "Save changes" : "Add member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the member from your directory. Any tasks assigned
              to them will be set to &quot;unassigned&quot; automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500/40"
              onClick={confirmDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Member card ────────────────────────────────────────────────────────────

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: Member;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = roleMeta(member.role);
  const c = colorFor(meta.color);
  const skills = member.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const done = Math.max(0, member.totalTasks - member.openTasks);
  const completion =
    member.totalTasks > 0 ? (done / member.totalTasks) * 100 : 0;
  const isActive = member.status === "active";

  return (
    <Card className="group relative overflow-hidden p-4 sm:p-5 border-border/60 lift h-full">
      {/* Soft gradient glow top-right */}
      <div
        className={cn(
          "absolute -top-10 -right-10 size-28 rounded-full blur-3xl opacity-20",
          c.bg
        )}
        aria-hidden
      />

      <div className="flex items-start gap-3 relative">
        <Avatar className="size-12 ring-2 ring-border/40">
          {member.avatarUrl && (
            <AvatarImage src={member.avatarUrl} alt={member.name} />
          )}
          <AvatarFallback
            className={cn(
              "bg-gradient-to-br text-white font-semibold text-sm",
              meta.gradient
            )}
          >
            {initials(member.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold truncate leading-tight">
                {member.name}
              </p>
              <div className="mt-1">
                <Pill color={meta.color} icon={meta.icon}>
                  {member.role}
                </Pill>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  aria-label="Member actions"
                >
                  <Icon name="more-horizontal" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={onEdit} className="gap-2">
                  <Icon name="edit" className="size-3.5" />
                  Edit
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

          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0 max-w-full"
            >
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{member.email}</span>
            </a>
          )}
        </div>
      </div>

      {/* Status + rate row */}
      <div className="mt-3 flex items-center justify-between gap-2 relative">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            isActive
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
            )}
          />
          {isActive ? "Active" : "Inactive"}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {formatMoney(member.rate)}
          <span className="text-xs text-muted-foreground font-normal">/hr</span>
        </span>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.slice(0, 5).map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
          {skills.length > 5 && (
            <span className="text-[11px] text-muted-foreground self-center">
              +{skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Task stats */}
      <div className="mt-4 relative">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Tasks</span>
          <span className="tabular-nums">
            <span className={cn("font-semibold", member.openTasks > 0 ? c.text : "")}>
              {member.openTasks}
            </span>
            <span className="text-muted-foreground">
              {" "}
              open · {member.totalTasks} total
            </span>
          </span>
        </div>
        <div className="mt-1.5">
          <Progress value={completion} color={meta.color} />
        </div>
        {member.totalTasks > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            {done}/{member.totalTasks} done · {Math.round(completion)}%
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── Filter chip ────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color: string;
  icon: string;
}) {
  const c = colorFor(color);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? cn("border-transparent text-white shadow-sm", c.bg)
          : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border"
      )}
    >
      <Icon name={icon} className="size-3.5" />
      {label}
      <span
        className={cn(
          "tabular-nums rounded-full px-1.5 py-0.5 text-[10px]",
          active ? "bg-white/25" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </motion.button>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function MemberSkeleton() {
  return (
    <Card className="p-5 border-border/60">
      <div className="flex items-start gap-3">
        <div className="size-12 rounded-full shimmer bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded shimmer bg-muted" />
          <div className="h-5 w-24 rounded-full shimmer bg-muted" />
        </div>
        <div className="size-7 rounded shimmer bg-muted" />
      </div>
      <div className="mt-4 h-3 w-1/2 rounded shimmer bg-muted" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-4 w-12 rounded shimmer bg-muted" />
        <div className="h-4 w-16 rounded shimmer bg-muted" />
      </div>
      <div className="mt-4 h-1.5 w-full rounded shimmer bg-muted" />
    </Card>
  );
}
