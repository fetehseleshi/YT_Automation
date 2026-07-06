"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { SectionHeader, StatCard, EmptyState, Pill } from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api, uploadFile, ApiError, formatDate, colorFor } from "@/lib/api";
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
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

type FileType =
  | "script"
  | "voiceover"
  | "video"
  | "music"
  | "thumbnail"
  | "brand"
  | "logo"
  | "document";

interface FileAsset {
  id: string;
  name: string;
  type: FileType;
  url: string;
  size: string;
  folder: string;
  tags: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface FileForm {
  name: string;
  type: FileType;
  url: string;
  size: string;
  folder: string;
  tags: string;
  notes: string;
}

interface UploadResult {
  url: string;
  name: string;
  size: string;
  sizeBytes: number;
  type: "image" | "video" | "audio" | "document";
  mimeType: string;
}

/** Map upload-detected category → FileAsset type. */
function categoryToType(cat: UploadResult["type"]): FileType {
  switch (cat) {
    case "image":
      return "thumbnail";
    case "video":
      return "video";
    case "audio":
      return "music";
    case "document":
    default:
      return "document";
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: FileForm = {
  name: "",
  type: "document",
  url: "",
  size: "",
  folder: "General",
  tags: "",
  notes: "",
};

const FILE_TYPES: Record<
  FileType,
  { label: string; icon: string; color: string; gradient: string }
> = {
  script: {
    label: "Script",
    icon: "file-text",
    color: "emerald",
    gradient: "from-emerald-500/30 via-emerald-600/10 to-transparent",
  },
  voiceover: {
    label: "Voiceover",
    icon: "message",
    color: "amber",
    gradient: "from-amber-500/30 via-amber-600/10 to-transparent",
  },
  video: {
    label: "Video",
    icon: "film",
    color: "rose",
    gradient: "from-rose-500/30 via-rose-600/10 to-transparent",
  },
  music: {
    label: "Music",
    icon: "music",
    color: "teal",
    gradient: "from-teal-500/30 via-teal-600/10 to-transparent",
  },
  thumbnail: {
    label: "Thumbnail",
    icon: "image",
    color: "orange",
    gradient: "from-orange-500/30 via-orange-600/10 to-transparent",
  },
  brand: {
    label: "Brand",
    icon: "palette",
    color: "emerald",
    gradient: "from-emerald-500/30 via-emerald-600/10 to-transparent",
  },
  logo: {
    label: "Logo",
    icon: "palette",
    color: "amber",
    gradient: "from-amber-500/30 via-amber-600/10 to-transparent",
  },
  document: {
    label: "Document",
    icon: "file-text",
    color: "teal",
    gradient: "from-teal-500/30 via-teal-600/10 to-transparent",
  },
};

const ALL_TYPES: FileType[] = [
  "script",
  "voiceover",
  "video",
  "music",
  "thumbnail",
  "brand",
  "logo",
  "document",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTags(tags: string): string[] {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function FilesSection() {
  const [files, setFiles] = React.useState<FileAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState<{
    type: string; // "all" | FileType
    folder: string; // "all" | folder name
  }>({ type: "all", folder: "all" });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FileAsset | null>(null);
  const [form, setForm] = React.useState<FileForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<FileAsset | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Upload state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<string>("");

  // ── Upload a real file via /api/upload ───────────────────────────────────────
  const onUploadFile = React.useCallback(
    async (file: File) => {
      if (file.size === 0) {
        toast.error("That file appears to be empty");
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        toast.error("File is larger than 25 MB");
        return;
      }
      setUploading(true);
      setUploadProgress(`Uploading ${file.name}…`);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const result = await uploadFile<UploadResult>("/api/upload", fd);
        // Fill the form with the upload metadata.
        setForm((f) => ({
          ...f,
          url: result.url,
          // Keep the user-typed name if they already entered one; otherwise
          // fall back to the uploaded file's sanitised name.
          name: f.name.trim() || result.name,
          size: result.size,
          type: categoryToType(result.type),
        }));
        toast.success("File uploaded", {
          description: `${result.name} · ${result.size}`,
        });
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
            ? e.message
            : "Upload failed";
        toast.error("Upload failed", { description: msg });
      } finally {
        setUploading(false);
        setUploadProgress("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    []
  );

  // ── Load files (server-side filters: type, folder) ───────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type !== "all") params.set("type", filters.type);
      if (filters.folder !== "all") params.set("folder", filters.folder);
      const qs = params.toString();
      const data = await api<{ files: FileAsset[] }>(
        `/api/files${qs ? `?${qs}` : ""}`
      );
      setFiles(data.files);
    } catch (e) {
      console.error("Failed to load files", e);
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [filters.type, filters.folder]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // ── Derived: folders + type counts (computed across all files for the
  // sidebar/chip counts — but we filter server-side, so when a type/folder is
  // active we show counts within the active subset). ────────────────────────
  const folders = React.useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => set.add(f.folder || "General"));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [files]);

  const typeCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    files.forEach((f) => {
      map[f.type] = (map[f.type] ?? 0) + 1;
    });
    return map;
  }, [files]);

  const folderCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    files.forEach((f) => {
      const key = f.folder || "General";
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [files]);

  // ── Dialog handlers ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      folder: filters.folder !== "all" ? filters.folder : "General",
      type: filters.type !== "all" ? (filters.type as FileType) : "document",
    });
    setDialogOpen(true);
  };

  const openEdit = (file: FileAsset) => {
    setEditing(file);
    setForm({
      name: file.name,
      type: file.type,
      url: file.url,
      size: file.size,
      folder: file.folder,
      tags: file.tags,
      notes: file.notes,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("File name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/files/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        toast.success("File updated");
      } else {
        await api("/api/files", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("File added");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      console.error("Failed to save file", e);
      toast.error(editing ? "Failed to update file" : "Failed to add file");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/files/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("File deleted");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      console.error("Failed to delete file", e);
      toast.error("Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalFiles = files.length;
  const totalFolders = folders.length;
  const topType = React.useMemo(() => {
    let best: { type: string; count: number } | null = null;
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (!best || count > best.count) best = { type, count };
    });
    return best as { type: string; count: number } | null;
  }, [typeCounts]);
  const topTypeMeta = topType ? FILE_TYPES[topType.type as FileType] : null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="File Library"
        description="Every asset, neatly organized"
        icon="folder-open"
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Icon name="plus" className="size-4" />
            Add File
          </Button>
        }
      />

      {/* ── Summary strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Files"
          value={totalFiles}
          icon="folder-open"
          color="emerald"
          hint="Across all folders"
          delay={0}
        />
        <StatCard
          label="Folders"
          value={totalFolders}
          icon="folder-open"
          color="teal"
          hint="Organized collections"
          delay={0.05}
        />
        <StatCard
          label={topTypeMeta ? `${topTypeMeta.label}s` : "Top Type"}
          value={topType ? topType.count : 0}
          icon={topTypeMeta?.icon ?? "file-text"}
          color={topTypeMeta?.color ?? "amber"}
          hint={topType ? "Most common type" : "No files yet"}
          delay={0.1}
        />
        <StatCard
          label="Media Files"
          value={
            (typeCounts.video ?? 0) +
            (typeCounts.voiceover ?? 0) +
            (typeCounts.music ?? 0) +
            (typeCounts.thumbnail ?? 0)
          }
          icon="film"
          color="rose"
          hint="Video · audio · images"
          delay={0.15}
        />
      </div>

      {/* ── Type filter chips + folder select ─────────────────────────────────── */}
      <Card className="glass p-3 border-border/60">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Icon name="filter" className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Type</span>
          </div>
          <div className="flex-1 min-w-0 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
            <div className="flex items-center gap-1.5 min-w-min">
              <FilterChip
                active={filters.type === "all"}
                onClick={() => setFilters((f) => ({ ...f, type: "all" }))}
                label="All"
                count={totalFiles}
                icon="layout-grid"
                color="emerald"
              />
              {ALL_TYPES.map((t) => {
                const meta = FILE_TYPES[t];
                const count = typeCounts[t] ?? 0;
                return (
                  <FilterChip
                    key={t}
                    active={filters.type === t}
                    onClick={() => setFilters((f) => ({ ...f, type: t }))}
                    label={meta.label}
                    count={count}
                    icon={meta.icon}
                    color={meta.color}
                  />
                );
              })}
            </div>
          </div>
          <Separator orientation="vertical" className="hidden lg:block h-8" />
          <div className="flex items-center gap-2 shrink-0">
            <Icon name="folder-open" className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Folder</span>
            <Select
              value={filters.folder}
              onValueChange={(v) => setFilters((f) => ({ ...f, folder: v }))}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="All folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All folders</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f} value={f}>
                    <span className="flex items-center justify-between gap-2 w-full">
                      <span className="truncate">{f}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {folderCounts[f]}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── Files grid ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <FileSkeleton key={i} />
          ))}
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          icon="folder-open"
          title={
            filters.type !== "all" || filters.folder !== "all"
              ? "No files match your filters"
              : "Your library is empty"
          }
          description={
            filters.type !== "all" || filters.folder !== "all"
              ? "Try a different type or folder to find what you're looking for."
              : "Add scripts, voiceovers, thumbnails, music, and other assets to keep them organized."
          }
          action={
            <div className="flex items-center gap-2">
              <Button onClick={openCreate} className="gap-1.5">
                <Icon name="plus" className="size-4" />
                Add File
              </Button>
              {(filters.type !== "all" || filters.folder !== "all") && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({ type: "all", folder: "all" })
                  }
                >
                  Clear filters
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          layout
        >
          <AnimatePresence mode="popLayout">
            {files.map((file, i) => (
              <FileCard
                key={file.id}
                file={file}
                index={i}
                onEdit={() => openEdit(file)}
                onDelete={() => setDeleteTarget(file)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Create / Edit dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon
                name={editing ? "edit" : "plus"}
                className="size-4 text-primary"
              />
              {editing ? "Edit file" : "Add file"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details of this file asset."
                : "Add a new asset to your file library."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="file-name">
                Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="file-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Discipline_Script_v3.docx"
                autoFocus
              />
            </div>

            {/* Type + Size */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="file-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as FileType }))
                  }
                >
                  <SelectTrigger id="file-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <Icon
                            name={FILE_TYPES[t].icon}
                            className={cn(
                              "size-3.5",
                              colorFor(FILE_TYPES[t].color).text
                            )}
                          />
                          {FILE_TYPES[t].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="file-size">Size</Label>
                <Input
                  id="file-size"
                  value={form.size}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, size: e.target.value }))
                  }
                  placeholder="e.g. 24 KB"
                />
              </div>
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label htmlFor="file-url">URL / path</Label>
              <Input
                id="file-url"
                value={form.url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, url: e.target.value }))
                }
                placeholder="file path or URL"
              />
              {form.url && (
                <p className="text-[11px] text-muted-foreground truncate">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="link" className="size-3" />
                    <span className="truncate">{form.url}</span>
                  </span>
                </p>
              )}
            </div>

            {/* File upload dropzone (real upload via /api/upload) */}
            <div className="space-y-1.5">
              <Label htmlFor="file-upload-input">Upload a real file</Label>
              <input
                ref={fileInputRef}
                id="file-upload-input"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUploadFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "group relative w-full rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-left transition-colors",
                  "hover:border-emerald-500/50 hover:bg-emerald-500/5",
                  uploading && "opacity-70 cursor-wait",
                  !uploading && "cursor-pointer"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-emerald-500/10 grid place-items-center shrink-0">
                    <Icon
                      name={uploading ? "refresh" : "upload"}
                      className={cn(
                        "size-5 text-emerald-600 dark:text-emerald-400",
                        uploading && "animate-spin"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {uploading ? (
                      <>
                        <p className="text-sm font-medium">
                          {uploadProgress || "Uploading…"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Saving to /public/uploads — please wait.
                        </p>
                      </>
                    ) : form.url && form.url.startsWith("/uploads/") ? (
                      <>
                        <p className="text-sm font-medium truncate">
                          {form.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {form.size} · click to replace
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          Drop or pick a file to upload
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Image · video · audio · document — max 25 MB.
                        </p>
                      </>
                    )}
                  </div>
                  {!uploading && form.url && form.url.startsWith("/uploads/") && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm((f) => ({ ...f, url: "", size: "" }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          setForm((f) => ({ ...f, url: "", size: "" }));
                        }
                      }}
                      className="size-7 rounded-md grid place-items-center text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Clear uploaded file"
                    >
                      <Icon name="x" className="size-3.5" />
                    </span>
                  )}
                </div>
              </button>
              <p className="text-[11px] text-muted-foreground">
                Or paste a URL manually above — both work.
              </p>
            </div>

            {/* Folder (with datalist of existing) */}
            <div className="space-y-1.5">
              <Label htmlFor="file-folder">Folder</Label>
              <Input
                id="file-folder"
                list="folders-datalist"
                value={form.folder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, folder: e.target.value }))
                }
                placeholder="General"
              />
              <datalist id="folders-datalist">
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Pick an existing folder or type a new one.
              </p>
            </div>

            {/* Tags (comma Input) */}
            <div className="space-y-1.5">
              <Label htmlFor="file-tags">Tags</Label>
              <Input
                id="file-tags"
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
                placeholder="comma, separated, tags"
              />
              {parseTags(form.tags).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {parseTags(form.tags).slice(0, 6).map((t) => (
                    <Pill key={t} color="teal">
                      {t}
                    </Pill>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="file-notes">Notes</Label>
              <Textarea
                id="file-notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Optional notes about this file…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editing && (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => {
                  setDialogOpen(false);
                  setDeleteTarget(editing);
                }}
              >
                <Icon name="trash" className="size-4 mr-1" />
                Delete
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || uploading || !form.name.trim()}>
              {(saving || uploading) && <Icon name="refresh" className="size-4 mr-1 animate-spin" />}
              {uploading ? "Uploading…" : editing ? "Save changes" : "Add file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  &ldquo;{deleteTarget.name}&rdquo; will be permanently removed
                  from your library. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={deleting}
            >
              {deleting && (
                <Icon name="refresh" className="size-4 mr-1 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Filter Chip ───────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  count,
  icon,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon: string;
  color: string;
}) {
  const c = colorFor(color);
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? cn(c.soft, "ring-1", c.ring)
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <Icon name={icon} className="size-3.5" />
      <span>{label}</span>
      <span
        className={cn(
          "tabular-nums text-[10px] rounded-full px-1.5 py-px",
          active
            ? "bg-foreground/10"
            : "bg-muted text-muted-foreground group-hover:bg-background/60"
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ─── File Card ─────────────────────────────────────────────────────────────────

function FileCard({
  file,
  index,
  onEdit,
  onDelete,
}: {
  file: FileAsset;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = FILE_TYPES[file.type] ?? FILE_TYPES.document;
  const c = colorFor(meta.color);
  const tags = parseTags(file.tags);

  const openFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer");
    } else {
      toast.info("No URL set for this file");
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.03, 0.4),
        ease: [0.2, 0.8, 0.2, 1],
      }}
      className="lift"
    >
      <Card className="group relative overflow-hidden p-0 border-border/60 hover:border-border transition-colors">
        {/* Decorative gradient by type */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 -top-10 h-24 bg-gradient-to-b opacity-60",
            meta.gradient
          )}
        />

        {/* Icon tile */}
        <div className="relative p-4 pb-2">
          <div
            className={cn(
              "size-12 rounded-xl grid place-items-center shrink-0",
              c.soft
            )}
          >
            <Icon name={meta.icon} className={cn("size-6", c.text)} />
          </div>

          {/* Hover actions overlay */}
          <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <CardAction
              icon="external-link"
              label={file.url ? "Open in new tab" : "No URL set"}
              color={meta.color}
              onClick={openFile}
            />
            <CardAction
              icon="edit"
              label="Edit"
              color="emerald"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            />
            <CardAction
              icon="trash"
              label="Delete"
              color="rose"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            />
          </div>
        </div>

        {/* Body */}
        <button
          onClick={onEdit}
          className="relative w-full text-left px-4 pb-4 space-y-2"
        >
          {/* Name (2-line clamp) */}
          <p className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]">
            {file.name}
          </p>

          {/* Type pill + size */}
          <div className="flex items-center justify-between gap-2">
            <Pill color={meta.color} icon={meta.icon}>
              {meta.label}
            </Pill>
            {file.size && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {file.size}
              </span>
            )}
          </div>

          {/* Folder label */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon name="folder-open" className="size-3 shrink-0" />
            <span className="truncate">{file.folder || "General"}</span>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 min-h-[1rem]">
              {tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {t}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}

          <Separator className="my-1" />

          {/* Created date */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Icon name="clock" className="size-3" />
              {formatDate(file.createdAt)}
            </span>
            {file.notes && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Icon name="sticky-note" className="size-3" />
                Notes
              </span>
            )}
          </div>
        </button>

        {/* Footer dropdown (always-visible affordance on mobile) */}
        <div className="absolute bottom-2 right-2 lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="size-7 rounded-md grid place-items-center text-muted-foreground hover:bg-accent">
                <Icon name="more-horizontal" className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (file.url)
                    window.open(file.url, "_blank", "noopener,noreferrer");
                  else toast.info("No URL set for this file");
                }}
              >
                <Icon name="external-link" className="size-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Icon name="edit" className="size-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 dark:text-rose-400"
                onClick={onDelete}
              >
                <Icon name="trash" className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </motion.div>
  );
}

function CardAction({
  icon,
  label,
  color,
  onClick,
  as = "button",
  href,
  target,
  rel,
}: {
  icon: string;
  label: string;
  color: string;
  onClick: (e: React.MouseEvent) => void;
  as?: "button" | "a";
  href?: string;
  target?: string;
  rel?: string;
}) {
  const c = colorFor(color);
  const cls = cn(
    "size-7 rounded-md grid place-items-center bg-background/80 backdrop-blur border border-border/60 shadow-sm transition-colors",
    "hover:scale-105 active:scale-95",
    c.text,
    "hover:bg-accent"
  );
  if (as === "a") {
    return (
      <a
        href={href || "#"}
        target={target}
        rel={rel}
        onClick={onClick}
        aria-label={label}
        title={label}
        className={cls}
      >
        <Icon name={icon} className="size-3.5" />
      </a>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cls}
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function FileSkeleton() {
  return (
    <Card className="p-4 border-border/60 overflow-hidden">
      <div className="size-12 rounded-xl shimmer" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-5/6 rounded shimmer" />
        <div className="h-3 w-3/5 rounded shimmer" />
        <div className="h-5 w-1/2 rounded-full shimmer mt-3" />
        <div className="h-2.5 w-2/3 rounded shimmer" />
        <div className="h-2.5 w-1/2 rounded shimmer" />
      </div>
    </Card>
  );
}
