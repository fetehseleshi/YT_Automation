"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  SectionHeader,
  EmptyState,
  Pill,
  Progress,
} from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api, formatDate, relativeTime, colorFor } from "@/lib/api";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// ─── Types ───────────────────────────────────────────────────────────────────

type NoteColor = "emerald" | "amber" | "rose" | "teal" | "orange";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  type: "quick" | "sticky";
  createdAt: string;
  updatedAt: string;
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

type ReadingStatus = "todo" | "reading" | "done";

interface ReadingItem {
  id: string;
  title: string;
  url: string;
  category: string;
  status: ReadingStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface ClipboardEntry {
  id: string;
  text: string;
  at: number;
}

// ─── Static config ───────────────────────────────────────────────────────────

const PALETTE: NoteColor[] = ["emerald", "amber", "rose", "teal", "orange"];

const HEX: Record<string, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  teal: "#14b8a6",
  orange: "#f97316",
};
const hexFor = (c: string) => HEX[c] ?? HEX.emerald;

const QUOTES: { text: string; author: string }[] = [
  {
    text: "Done is better than perfect. Hit publish, then iterate.",
    author: "Creator Mantra",
  },
  {
    text: "Your first 100 videos are your film school. Make them fast.",
    author: "Casey Neistat",
  },
  {
    text: "Consistency beats intensity. Show up daily, even for ten minutes.",
    author: "Ali Abdaal",
  },
  {
    text: "The algorithm rewards watch time, not perfection. Hook hard, retain harder.",
    author: "Mr Beast",
  },
  {
    text: "Treat your channel like a product, not a hobby. Build, measure, learn.",
    author: "Think Media",
  },
  {
    text: "You don't rise to your goals — you fall to your systems. Build one today.",
    author: "James Clear",
  },
  {
    text: "The thumbnail is 80% of the click. Spend twice as long on it as the title.",
    author: "vidIQ Academy",
  },
  {
    text: "Audiences don't subscribe to content. They subscribe to people.",
    author: "Sean Cannell",
  },
  {
    text: "If you're not slightly embarrassed by your first videos, you launched too late.",
    author: "Reid Hoffman",
  },
  {
    text: "Every video is a search query answered. Solve a real problem clearly.",
    author: "SEO Playbook",
  },
  {
    text: "Edit ruthlessly. Cut every second that doesn't earn its place.",
    author: "Editing Craft",
  },
  {
    text: "The best camera is the one you'll actually use every day.",
    author: "Creator Wisdom",
  },
  {
    text: "Niche down until it hurts, then niche down again. Dominate a corner.",
    author: "Growth Notes",
  },
  {
    text: "Your audience is one video away from finding you. Make today's count.",
    author: "Channel North Star",
  },
  {
    text: "Focus on inputs you control — uploads, thumbnails, hooks. Outputs follow.",
    author: "Creator OS",
  },
];

const RESOURCES: {
  title: string;
  description: string;
  category: string;
  url: string;
  color: string;
}[] = [
  {
    title: "YouTube Creator Academy",
    description:
      "Official YouTube courses on growth, monetization, and channel fundamentals.",
    category: "Foundations",
    url: "https://creatoracademy.youtube.com",
    color: "rose",
  },
  {
    title: "Think Media",
    description:
      "Tutorials, gear reviews, and growth strategies for tech & lifestyle creators.",
    category: "Growth",
    url: "https://thinkmedia.com",
    color: "amber",
  },
  {
    title: "vidIQ Academy",
    description:
      "Data-driven keyword research, SEO, and channel audits from a leading toolmaker.",
    category: "SEO",
    url: "https://vidiq.com/academy",
    color: "teal",
  },
  {
    title: "Mr Beast Interviews",
    description:
      "Watch every long-form interview — study the psychology of retention and scale.",
    category: "Mindset",
    url: "https://youtube.com/results?search_query=mr+beast+interview",
    color: "orange",
  },
  {
    title: "Ali Abdaal — Productivity",
    description:
      "Systems, focus blocks, and sustainable creative workflows from a top educator.",
    category: "Productivity",
    url: "https://aliabdaal.com",
    color: "emerald",
  },
  {
    title: "Thumbnail Design Principles",
    description:
      "High-contrast color, faces, and curiosity gaps — the science of the click.",
    category: "Design",
    url: "https://youtube.com/results?search_query=youtube+thumbnail+design",
    color: "rose",
  },
  {
    title: "YouTube Algorithm Guide",
    description:
      "How recommendation, discovery, and Shorts ranking actually work in 2025.",
    category: "Algorithm",
    url: "https://youtube.com/howyoutubeworks",
    color: "teal",
  },
  {
    title: "SEO Fundamentals",
    description:
      "Titles, descriptions, tags, chapters — the on-page playbook that still matters.",
    category: "SEO",
    url: "https://youtube.com/results?search_query=youtube+seo+guide",
    color: "amber",
  },
];

const CHECKLIST_ITEMS: { id: string; label: string; hint: string }[] = [
  { id: "hook", label: "Hook in first 5 seconds", hint: "Pattern interrupt" },
  { id: "broll", label: "B-roll every 8s", hint: "Visual pacing" },
  { id: "subs", label: "Subtitles / captions added", hint: "Accessibility + retention" },
  { id: "thumb", label: "Custom thumbnail (high contrast)", hint: "Earn the click" },
  { id: "title", label: "Title under 60 chars", hint: "Mobile truncation" },
  { id: "desc", label: "Description with keywords", hint: "Search discovery" },
  { id: "tags", label: "Tags added", hint: "Topic signals" },
  { id: "endscreen", label: "End screen", hint: "Next-video funnel" },
  { id: "cards", label: "Cards", hint: "Contextual links" },
  { id: "chapters", label: "Chapter timestamps", hint: "Skip navigation + SERP" },
  { id: "playlist", label: "Playlist added", hint: "Session extension" },
  { id: "pinned", label: "Pinned comment", hint: "Drive engagement / CTA" },
];

const TABS: { id: string; label: string; icon: string }[] = [
  { id: "motivate", label: "Motivate", icon: "sparkles" },
  { id: "focus", label: "Focus", icon: "timer" },
  { id: "notes", label: "Notes", icon: "sticky-note" },
  { id: "bookmarks", label: "Bookmarks", icon: "bookmark" },
  { id: "clipboard", label: "Clipboard", icon: "clipboard-list" },
  { id: "reading", label: "Reading", icon: "book-open" },
  { id: "checklist", label: "Checklist", icon: "list-checks" },
  { id: "learn", label: "Learn", icon: "lightbulb" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mmss(total: number) {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// ─── 1. Motivate ─────────────────────────────────────────────────────────────

function MotivateTab() {
  const [index, setIndex] = React.useState(() =>
    Math.floor(Math.random() * QUOTES.length)
  );
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % QUOTES.length);
    }, 8000);
    return () => clearInterval(t);
  }, [paused]);

  const next = () => setIndex((i) => (i + 1) % QUOTES.length);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const quote = QUOTES[index];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card className="relative overflow-hidden border-border/60">
        {/* gradient backdrop */}
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(1100px 360px at 12% -10%, rgba(16,185,129,0.18), transparent 60%), radial-gradient(900px 320px at 92% 110%, rgba(245,158,11,0.16), transparent 60%), radial-gradient(700px 280px at 70% 20%, rgba(244,63,94,0.12), transparent 60%)",
          }}
        />
        <div className="relative p-6 sm:p-10 lg:p-14 min-h-[320px] sm:min-h-[380px] flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-emerald-500/15 grid place-items-center">
                <Icon name="sparkles" className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Daily Motivation
                </p>
                <p className="text-sm font-medium">{dateStr}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPaused((p) => !p)}
                    aria-label={paused ? "Resume rotation" : "Pause rotation"}
                  >
                    <Icon name={paused ? "play" : "pause"} className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{paused ? "Resume" : "Pause"}</TooltipContent>
              </Tooltip>
              <Button onClick={next}>
                <Icon name="refresh" className="size-4" />
                New quote
              </Button>
            </div>
          </div>

          <div className="flex-1 grid place-items-center text-center max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.figure
                key={index}
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                className="space-y-4"
              >
                <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-snug">
                  <span className="text-emerald-500 mr-1">&ldquo;</span>
                  {quote.text}
                  <span className="text-emerald-500 ml-1">&rdquo;</span>
                </blockquote>
                <figcaption className="text-sm sm:text-base text-muted-foreground">
                  — {quote.author}
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>

          <div className="mt-6 sm:mt-8 flex items-center justify-center gap-1.5">
            {QUOTES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to quote ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-6 bg-emerald-500"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── 2. Pomodoro ─────────────────────────────────────────────────────────────

type PomoMode = "focus" | "short" | "long";
const POMO_DURATIONS: Record<PomoMode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};
const POMO_META: Record<PomoMode, { label: string; color: string }> = {
  focus: { label: "Focus", color: "emerald" },
  short: { label: "Short Break", color: "teal" },
  long: { label: "Long Break", color: "amber" },
};

function FocusTab() {
  const [mode, setMode] = React.useState<PomoMode>("focus");
  const [secondsLeft, setSecondsLeft] = React.useState(POMO_DURATIONS.focus);
  const [running, setRunning] = React.useState(false);
  const [endTime, setEndTime] = React.useState<number | null>(null);
  const [sessions, setSessions] = React.useState(0);

  // Load session count
  React.useEffect(() => {
    try {
      const key = "pomo-sessions";
      const dateKey = `pomo-date-${new Date().toDateString()}`;
      const lastDate = localStorage.getItem("pomo-date");
      if (lastDate !== new Date().toDateString()) {
        localStorage.setItem("pomo-date", new Date().toDateString());
        localStorage.removeItem(key);
        setSessions(0);
        return;
      }
      const raw = localStorage.getItem(key);
      setSessions(raw ? Number(raw) || 0 : 0);
    } catch {
      /* ignore */
    }
  }, []);

  // Tick
  React.useEffect(() => {
    if (!running || endTime == null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setRunning(false);
        setEndTime(null);
        if (mode === "focus") {
          const next = sessions + 1;
          setSessions(next);
          try {
            localStorage.setItem("pomo-sessions", String(next));
            localStorage.setItem("pomo-date", new Date().toDateString());
          } catch {
            /* ignore */
          }
          toast.success("Pomodoro complete! Take a break.");
        } else {
          toast.success("Break's over — back to focus.");
        }
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running, endTime, mode, sessions]);

  const start = () => {
    if (secondsLeft <= 0) setSecondsLeft(POMO_DURATIONS[mode]);
    setEndTime(Date.now() + Math.max(1, secondsLeft) * 1000);
    setRunning(true);
  };
  const pause = () => {
    setRunning(false);
    setEndTime(null);
  };
  const reset = () => {
    setRunning(false);
    setEndTime(null);
    setSecondsLeft(POMO_DURATIONS[mode]);
  };
  const switchMode = (m: PomoMode) => {
    setMode(m);
    setRunning(false);
    setEndTime(null);
    setSecondsLeft(POMO_DURATIONS[m]);
  };

  const total = POMO_DURATIONS[mode];
  const pct = total > 0 ? (secondsLeft / total) * 100 : 0;
  const color = POMO_META[mode].color;
  const stroke = hexFor(color);

  // SVG ring
  const size = 260;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct / 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="grid lg:grid-cols-[1fr_320px] gap-4"
    >
      <Card className="relative overflow-hidden border-border/60 p-6 sm:p-8 lg:p-10">
        <div
          className="absolute inset-0 opacity-80 pointer-events-none"
          style={{
            background: `radial-gradient(700px 280px at 50% 0%, ${stroke}22, transparent 60%)`,
          }}
        />
        <div className="relative flex flex-col items-center gap-6">
          {/* Mode selector */}
          <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1 gap-1">
            {(Object.keys(POMO_DURATIONS) as PomoMode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors",
                  mode === m
                    ? cn(
                        "bg-background shadow-sm",
                        colorFor(POMO_META[m].color).text
                      )
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {POMO_META[m].label}
              </button>
            ))}
          </div>

          {/* Ring */}
          <div
            className={cn(
              "relative grid place-items-center",
              running && "animate-pulse"
            )}
            style={{ width: size, height: size }}
          >
            <svg width={size} height={size} className="-rotate-90">
              <defs>
                <linearGradient
                  id={`pomo-grad-${color}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.7" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="1" />
                </linearGradient>
              </defs>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-muted/30"
                strokeWidth={strokeWidth}
              />
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={`url(#pomo-grad-${color})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circ}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 0.4, ease: "linear" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight">
                  {mmss(secondsLeft)}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {POMO_META[mode].label}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!running ? (
              <Button size="lg" onClick={start} className="min-w-32">
                <Icon name="play" className="size-4" />
                Start
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                onClick={pause}
                className="min-w-32"
              >
                <Icon name="pause" className="size-4" />
                Pause
              </Button>
            )}
            <Button size="lg" variant="ghost" onClick={reset}>
              <Icon name="refresh" className="size-4" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <Card className="relative overflow-hidden border-border/60 p-6 flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Today
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-bold tabular-nums">{sessions}</span>
            <span className="text-sm text-muted-foreground">
              focus {sessions === 1 ? "session" : "sessions"}
            </span>
          </div>
        </div>
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Focus duration</span>
            <span className="font-medium">25 min</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Short break</span>
            <span className="font-medium">5 min</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Long break</span>
            <span className="font-medium">15 min</span>
          </div>
        </div>
        <Separator />
        <div className="mt-auto rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Icon
              name="lightbulb"
              className="size-4 mt-0.5 text-amber-500 shrink-0"
            />
            <p>
              Work in focused sprints. After 4 focus sessions, take a long
              break to recharge.
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── 3. Notes ────────────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Folders are encoded as a "[Folder] Title" prefix on the note title. This
// avoids schema changes while still letting users group notes by folder.
// Tags are parsed from "#tag" tokens in the note content.

const FOLDER_PREFIX_RE = /^\[([^\]]+)\]\s*(.*)$/;
const TAG_RE = /(?:^|\s)#([\w-]+)/g;

function parseFolder(title: string): { folder: string | null; cleanTitle: string } {
  const m = FOLDER_PREFIX_RE.exec(title || "");
  if (!m) return { folder: null, cleanTitle: title || "" };
  const folder = m[1].trim();
  return { folder: folder || null, cleanTitle: m[2].trim() };
}

function parseTags(content: string): string[] {
  const tags = new Set<string>();
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(content || ""))) {
    const t = m[1].toLowerCase();
    if (t.length >= 1 && t.length <= 32) tags.add(t);
  }
  return Array.from(tags);
}

function buildTitle(folder: string | null, cleanTitle: string): string {
  if (folder && folder.trim()) {
    return `[${folder.trim()}] ${cleanTitle}`.trim();
  }
  return cleanTitle;
}

function NoteCard({
  note,
  onEdit,
  onTogglePin,
  onDelete,
  onTagClick,
}: {
  note: Note;
  onEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onTagClick: (tag: string) => void;
}) {
  const { folder, cleanTitle } = parseFolder(note.title);
  const tags = parseTags(note.content);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card
        className="relative overflow-hidden p-4 border-border/60 break-inside-avoid mb-3 lift"
        style={{
          boxShadow: `inset 3px 0 0 ${hexFor(note.color)}`,
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {note.pinned && (
              <Icon name="pin" className="size-3.5 text-amber-500 shrink-0" />
            )}
            <h4 className="text-sm font-semibold truncate">
              {cleanTitle || "Untitled"}
            </h4>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={onTogglePin}
                  aria-label={note.pinned ? "Unpin note" : "Pin note"}
                >
                  <Icon
                    name={note.pinned ? "pin-off" : "pin"}
                    className={cn(
                      "size-3.5",
                      note.pinned && "text-amber-500"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{note.pinned ? "Unpin" : "Pin"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={onEdit}
                  aria-label="Edit note"
                >
                  <Icon name="edit" className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 hover:text-rose-500"
                  onClick={onDelete}
                  aria-label="Delete note"
                >
                  <Icon name="trash" className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {note.content && (
          <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-li:my-0 prose-headings:text-foreground prose-strong:text-foreground/90 line-clamp-6">
            <ReactMarkdown>{note.content}</ReactMarkdown>
          </div>
        )}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 6).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTagClick(t)}
                className="inline-flex items-center rounded-full bg-muted/60 hover:bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                #{t}
              </button>
            ))}
            {tags.length > 6 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{tags.length - 6}
              </span>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize shrink-0"
              style={{
                backgroundColor: `${hexFor(note.color)}1a`,
                color: hexFor(note.color),
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: hexFor(note.color) }}
              />
              {note.type}
            </span>
            {folder && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium truncate">
                <Icon name="folder-open" className="size-2.5" />
                <span className="truncate max-w-[100px]">{folder}</span>
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatDate(note.updatedAt)}
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

function NoteDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Note | null;
  onSaved: () => void;
  onCreated: (note: Note) => void;
}) {
  // Editor state — folder + cleanTitle are split from the stored title.
  const [folder, setFolder] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [color, setColor] = React.useState<string>("emerald");
  const [type, setType] = React.useState<"quick" | "sticky">("quick");
  const [pinned, setPinned] = React.useState(false);

  // Track the live note id once created (for autosave via PATCH).
  const [liveId, setLiveId] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = React.useRef(false);
  const isEdit = !!editing?.id || !!liveId;

  // Sync form when dialog opens or editing target changes.
  React.useEffect(() => {
    if (!open) return;
    const parsed = editing ? parseFolder(editing.title) : { folder: null, cleanTitle: "" };
    setFolder(parsed.folder ?? "");
    setTitle(parsed.cleanTitle);
    setContent(editing?.content ?? "");
    setColor(editing?.color ?? "emerald");
    setType((editing?.type as "quick" | "sticky") ?? "quick");
    setPinned(editing?.pinned ?? false);
    setLiveId(editing?.id ?? null);
    setSaveState("idle");
    skipNextSaveRef.current = true;
  }, [open, editing]);

  // Autosave: debounce 800ms after the last keystroke.
  // For new notes (no liveId), create on first content/title, then PATCH.
  React.useEffect(() => {
    if (!open) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const composedTitle = buildTitle(folder || null, title);

    // Don't save if both empty (avoid creating empty notes).
    if (!composedTitle.trim() && !content.trim()) return;

    setSaveState("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        const payload = {
          title: composedTitle,
          content,
          color,
          type,
          pinned,
        };
        if (liveId) {
          // PATCH existing note. Only send title if non-empty (API requires).
          const patch: Record<string, unknown> = {
            content,
            color,
            type,
            pinned,
          };
          if (composedTitle.trim()) patch.title = composedTitle;
          const res = await api<{ note: Note }>(`/api/notes/${liveId}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          });
          onSaved();
          setSaveState("saved");
          setTimeout(
            () => setSaveState((p) => (p === "saved" ? "idle" : p)),
            1500
          );
          // suppress unused warning
          void res;
        } else {
          // Create new note, then switch to PATCH mode.
          const res = await api<{ note: Note }>("/api/notes", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setLiveId(res.note.id);
          onCreated(res.note);
          setSaveState("saved");
          setTimeout(
            () => setSaveState((p) => (p === "saved" ? "idle" : p)),
            1500
          );
        }
      } catch (e) {
        setSaveState("error");
        toast.error(e instanceof Error ? e.message : "Failed to save note");
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, folder, title, content, color, type, pinned, liveId]);

  const tags = parseTags(content);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Icon name={isEdit ? "edit" : "plus"} className="size-4 text-primary" />
              {isEdit ? "Edit note" : "New note"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium",
                saveState === "saving" && "text-amber-500",
                saveState === "saved" && "text-emerald-500",
                saveState === "error" && "text-rose-500",
                saveState === "idle" && "text-muted-foreground"
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
              {saveState === "idle" && isEdit && (
                <>
                  <Icon name="check-circle" className="size-3 opacity-60" />
                  Auto-saves
                </>
              )}
            </span>
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edits save automatically. Folders use [Folder] prefix on title. Tags are #hashtag tokens in content."
              : "Type to create — auto-saves after 800ms."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 overflow-y-auto pr-1 -mr-1">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title (without [Folder] prefix)"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note-folder">Folder</Label>
              <Input
                id="note-folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="e.g. Ideas"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="w-full">
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
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "quick" | "sticky")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick note</SelectItem>
                  <SelectItem value="sticky">Sticky note</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <Label htmlFor="note-pinned" className="text-sm cursor-pointer">
              Pin to top
            </Label>
            <Switch
              id="note-pinned"
              checked={pinned}
              onCheckedChange={setPinned}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="grid gap-2 min-w-0">
              <Label htmlFor="note-content">
                Content (markdown) <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="note-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"Write in markdown…\n\n# Heading\n- bullet\n- **bold** _italic_\n\n#tag1 #tag2"}
                rows={9}
                className="resize-none font-mono text-sm"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-2 min-w-0">
              <Label className="text-muted-foreground">Preview</Label>
              <div className="rounded-md border border-border/60 bg-background/40 p-3 min-h-[200px] max-h-[260px] overflow-y-auto">
                {content.trim() ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-li:my-0 prose-headings:text-foreground prose-strong:text-foreground/90">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Preview will appear here…
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotesTab() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Note | null>(null);
  const [search, setSearch] = React.useState("");
  const [folderFilter, setFolderFilter] = React.useState<string>("__all__");
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ notes: Note[] }>("/api/notes");
      setNotes(res.notes ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const togglePin = async (note: Note) => {
    const next = !note.pinned;
    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === note.id ? { ...n, pinned: next } : n
      );
      return [...updated].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
    try {
      await api(`/api/notes/${note.id}`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: next }),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update note");
      load();
    }
  };

  const deleteNote = async (note: Note) => {
    const prev = notes;
    setNotes((n) => n.filter((x) => x.id !== note.id));
    try {
      await api(`/api/notes/${note.id}`, { method: "DELETE" });
      toast.success("Note deleted");
    } catch (e) {
      setNotes(prev);
      toast.error(e instanceof Error ? e.message : "Failed to delete note");
    }
  };

  // Derived folder list from "[Folder] Title" prefixes.
  const folders = React.useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      const { folder } = parseFolder(n.title);
      if (folder) set.add(folder);
    }
    return Array.from(set).sort();
  }, [notes]);

  // Derived tag list (most common, capped for the sidebar).
  const allTags = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      for (const t of parseTags(n.content)) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t]) => t);
  }, [notes]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (folderFilter === "__pinned__" && !n.pinned) return false;
      if (
        folderFilter !== "__all__" &&
        folderFilter !== "__pinned__" &&
        parseFolder(n.title).folder !== folderFilter
      )
        return false;
      if (tagFilter && !parseTags(n.content).includes(tagFilter)) return false;
      if (q) {
        const hay = (n.title + " " + n.content).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, search, folderFilter, tagFilter]);

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  const ordered = [...pinned, ...others].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="sticky-note" className="size-4" />
          <span>
            {filtered.length} of {notes.length} {notes.length === 1 ? "note" : "notes"}
            {pinned.length > 0 && ` · ${pinned.length} pinned`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon
              name="search"
              className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="pl-8 h-9 w-full sm:w-[220px]"
            />
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Icon name="plus" className="size-4" />
            Add Note
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Folder + tag sidebar */}
        <Card className="glass p-3 hidden lg:block h-fit sticky top-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
            <Icon name="folder-open" className="size-3" />
            Folders
          </p>
          <div className="space-y-0.5">
            <FolderButton
              active={folderFilter === "__all__"}
              onClick={() => setFolderFilter("__all__")}
              icon="list-checks"
              label="All notes"
              count={notes.length}
            />
            <FolderButton
              active={folderFilter === "__pinned__"}
              onClick={() => setFolderFilter("__pinned__")}
              icon="pin"
              label="Pinned"
              count={notes.filter((n) => n.pinned).length}
            />
            <div className="my-1.5 h-px bg-border/60" />
            {folders.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/70 px-2 py-1 italic">
                No folders yet. Add a [Folder] prefix to a note title.
              </p>
            ) : (
              folders.map((f) => {
                const count = notes.filter(
                  (n) => parseFolder(n.title).folder === f
                ).length;
                return (
                  <FolderButton
                    key={f}
                    active={folderFilter === f}
                    onClick={() => setFolderFilter(f)}
                    icon="folder-open"
                    label={f}
                    count={count}
                  />
                );
              })
            )}
          </div>

          {allTags.length > 0 && (
            <>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mt-4 mb-2 flex items-center gap-1.5">
                <span className="text-base leading-none">#</span>
                Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {allTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTagFilter(tagFilter === t ? null : t)}
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] transition-colors",
                      tagFilter === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    #{t}
                  </button>
                ))}
              </div>
              {tagFilter && (
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className="mt-2 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <Icon name="x" className="size-3" />
                  Clear tag filter
                </button>
              )}
            </>
          )}
        </Card>

        {/* Notes grid */}
        <div>
          {loading ? (
            <div className="columns-1 sm:columns-2 lg:columns-2 xl:columns-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="mb-3 break-inside-avoid">
                  <Card className="p-4 border-border/60">
                    <div className="shimmer h-4 w-2/3 rounded mb-3" />
                    <div className="shimmer h-3 w-full rounded mb-2" />
                    <div className="shimmer h-3 w-1/2 rounded" />
                  </Card>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="sticky-note"
              title={
                notes.length === 0
                  ? "No notes yet"
                  : search || tagFilter || folderFilter !== "__all__"
                  ? "No notes match your filters"
                  : "No notes yet"
              }
              description={
                notes.length === 0
                  ? "Capture ideas, reminders, and quick thoughts as you create. Markdown supported — use #tags to organize."
                  : "Try adjusting your search, folder, or tag filter."
              }
              action={
                notes.length === 0 ? (
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Icon name="plus" className="size-4" />
                    Add your first note
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setTagFilter(null);
                      setFolderFilter("__all__");
                    }}
                  >
                    <Icon name="x" className="size-4" />
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <div className="columns-1 sm:columns-2 xl:columns-3 gap-3">
              <AnimatePresence>
                {ordered.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onTogglePin={() => togglePin(note)}
                    onEdit={() => {
                      setEditing(note);
                      setDialogOpen(true);
                    }}
                    onDelete={() => deleteNote(note)}
                    onTagClick={(t) => setTagFilter(t)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <NoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
        onCreated={(n) => {
          setNotes((prev) => [n, ...prev]);
        }}
      />
    </motion.div>
  );
}

function FolderButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
    >
      <Icon name={icon} className="size-3.5 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      <span
        className={cn(
          "text-[10px] tabular-nums rounded-full px-1.5 py-0.5",
          active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ─── 4. Bookmarks ────────────────────────────────────────────────────────────

function BookmarkDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Bookmark | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [category, setCategory] = React.useState("general");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setUrl(editing?.url ?? "");
      setCategory(editing?.category ?? "general");
    }
  }, [open, editing]);

  const submit = async () => {
    if (!url.trim()) {
      toast.error("URL is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/bookmarks/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, url, category }),
        });
        toast.success("Bookmark updated");
      } else {
        await api("/api/bookmarks", {
          method: "POST",
          body: JSON.stringify({ title, url, category }),
        });
        toast.success("Bookmark saved");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save bookmark");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit bookmark" : "New bookmark"}</DialogTitle>
          <DialogDescription>
            Save useful links for tools, research, and inspiration.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="bm-url">
              URL <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="bm-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bm-title">Title</Label>
            <Input
              id="bm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional — defaults to URL"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bm-cat">Category</Label>
            <Input
              id="bm-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Tools, Research, Design"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && (
              <Icon name="refresh" className="size-4 animate-spin" />
            )}
            {editing ? "Save changes" : "Add bookmark"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookmarksTab() {
  const [bookmarks, setBookmarks] = React.useState<Bookmark[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Bookmark | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ bookmarks: Bookmark[] }>("/api/bookmarks");
      setBookmarks(res.bookmarks ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [bookmarks, query]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Bookmark[]>();
    for (const b of filtered) {
      const k = b.category || "general";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const deleteBookmark = async (b: Bookmark) => {
    const prev = bookmarks;
    setBookmarks((arr) => arr.filter((x) => x.id !== b.id));
    try {
      await api(`/api/bookmarks/${b.id}`, { method: "DELETE" });
      toast.success("Bookmark removed");
    } catch (e) {
      setBookmarks(prev);
      toast.error(e instanceof Error ? e.message : "Failed to delete bookmark");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Icon
            name="search"
            className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookmarks…"
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Icon name="plus" className="size-4" />
          Add Bookmark
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title={query ? "No matches" : "No bookmarks yet"}
          description={
            query
              ? "Try a different search term."
              : "Save tools, references, and inspiration for quick access."
          }
          action={
            !query && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Icon name="plus" className="size-4" />
                Add a bookmark
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">{category}</h4>
                <Badge variant="secondary" className="text-[10px]">
                  {items.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((b) => (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22 }}
                    className="lift"
                  >
                    <Card className="p-3 border-border/60 flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-muted/60 grid place-items-center shrink-0">
                        <Icon
                          name="link"
                          className="size-4 text-muted-foreground"
                        />
                      </div>
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 group"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate group-hover:text-emerald-500 transition-colors">
                            {b.title}
                          </span>
                          <Icon
                            name="external-link"
                            className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {b.url.replace(/^https?:\/\//, "")}
                        </p>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 hover:text-rose-500"
                        onClick={() => deleteBookmark(b)}
                        aria-label="Delete bookmark"
                      >
                        <Icon name="trash" className="size-3.5" />
                      </Button>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <BookmarkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
      />
    </motion.div>
  );
}

// ─── 5. Clipboard ────────────────────────────────────────────────────────────

const CLIP_KEY = "clipboard-history";

function ClipboardTab() {
  const [entries, setEntries] = React.useState<ClipboardEntry[]>([]);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Load
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CLIP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setEntries(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Listen for copy events
  React.useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const sel = window.getSelection()?.toString() ?? "";
      const captured = (text || sel).trim();
      if (!captured) return;
      setEntries((prev) => {
        const next: ClipboardEntry[] = [
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: captured, at: Date.now() },
          ...prev.filter((x) => x.text !== captured),
        ].slice(0, 50);
        try {
          localStorage.setItem(CLIP_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    };
    window.addEventListener("copy", handler);
    return () => window.removeEventListener("copy", handler);
  }, []);

  const persist = (next: ClipboardEntry[]) => {
    setEntries(next);
    try {
      localStorage.setItem(CLIP_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const copyEntry = async (entry: ClipboardEntry) => {
    try {
      await navigator.clipboard.writeText(entry.text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't access clipboard");
    }
  };

  const deleteEntry = (id: string) => {
    persist(entries.filter((e) => e.id !== id));
  };

  const clearAll = () => {
    persist([]);
    toast.success("Clipboard cleared");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <Card className="relative overflow-hidden border-border/60 p-4 sm:p-5">
        <div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px 240px at 90% 0%, rgba(20,184,166,0.10), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-teal-500/15 grid place-items-center shrink-0">
              <Icon
                name="clipboard-list"
                className="size-5 text-teal-500"
              />
            </div>
            <div>
              <p className="text-sm font-semibold">Clipboard capture</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Copy any text on the page to capture it here. Newest first,
                max 50 entries.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">{entries.length} / 50</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={entries.length === 0}
            >
              <Icon name="trash" className="size-3.5" />
              Clear all
            </Button>
          </div>
        </div>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          icon="copy"
          title="Nothing captured yet"
          description="Select any text on this page and press Ctrl/Cmd+C — it'll appear here automatically."
        />
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scroll">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="lift"
              >
                <Card className="p-3 border-border/60 flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-muted/60 grid place-items-center shrink-0 mt-0.5">
                    <Icon
                      name="copy"
                      className="size-3.5 text-muted-foreground"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">
                      {entry.text}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(entry.at).toLocaleTimeString()} ·{" "}
                      {entry.text.length} chars
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => copyEntry(entry)}
                          aria-label="Copy"
                        >
                          <Icon
                            name={copiedId === entry.id ? "check" : "copy"}
                            className={cn(
                              "size-3.5",
                              copiedId === entry.id && "text-emerald-500"
                            )}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {copiedId === entry.id ? "Copied!" : "Copy again"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 hover:text-rose-500"
                          onClick={() => deleteEntry(entry.id)}
                          aria-label="Delete"
                        >
                          <Icon name="trash" className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ─── 6. Reading List ─────────────────────────────────────────────────────────

const READING_STATUS_META: Record<
  ReadingStatus,
  { label: string; color: string; icon: string; next: ReadingStatus }
> = {
  todo: {
    label: "To read",
    color: "rose",
    icon: "circle",
    next: "reading",
  },
  reading: {
    label: "Reading",
    color: "amber",
    icon: "circle-dot",
    next: "done",
  },
  done: {
    label: "Done",
    color: "emerald",
    icon: "check-circle",
    next: "todo",
  },
};

function ReadingDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ReadingItem | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [category, setCategory] = React.useState("general");
  const [status, setStatus] = React.useState<ReadingStatus>("todo");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setUrl(editing?.url ?? "");
      setCategory(editing?.category ?? "general");
      setStatus((editing?.status as ReadingStatus) ?? "todo");
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/reading/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, url, category, status, notes }),
        });
        toast.success("Reading item updated");
      } else {
        await api("/api/reading", {
          method: "POST",
          body: JSON.stringify({ title, url, category, status, notes }),
        });
        toast.success("Added to reading list");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to save reading item"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit reading item" : "New reading item"}
          </DialogTitle>
          <DialogDescription>
            Books, articles, and posts to learn from.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="rd-title">
              Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="rd-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deep Work — Cal Newport"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rd-url">URL</Label>
              <Input
                id="rd-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rd-cat">Category</Label>
              <Input
                id="rd-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Mindset"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              {(Object.keys(READING_STATUS_META) as ReadingStatus[]).map(
                (s) => {
                  const m = READING_STATUS_META[s];
                  const c = colorFor(m.color);
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                        status === s
                          ? cn(c.soft, "border-transparent")
                          : "border-border/60 hover:bg-muted/40"
                      )}
                    >
                      {m.label}
                    </button>
                  );
                }
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rd-notes">Notes</Label>
            <Textarea
              id="rd-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key takeaways, quotes…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && (
              <Icon name="refresh" className="size-4 animate-spin" />
            )}
            {editing ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadingTab() {
  const [items, setItems] = React.useState<ReadingItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<ReadingStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ReadingItem | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: ReadingItem[] }>("/api/reading");
      setItems(res.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load reading list");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const cycleStatus = async (item: ReadingItem) => {
    const next = READING_STATUS_META[item.status].next;
    const prev = items;
    setItems((arr) =>
      arr.map((x) => (x.id === item.id ? { ...x, status: next } : x))
    );
    try {
      await api(`/api/reading/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
    } catch (e) {
      setItems(prev);
      toast.error(
        e instanceof Error ? e.message : "Failed to update status"
      );
    }
  };

  const deleteItem = async (item: ReadingItem) => {
    const prev = items;
    setItems((arr) => arr.filter((x) => x.id !== item.id));
    try {
      await api(`/api/reading/${item.id}`, { method: "DELETE" });
      toast.success("Removed from list");
    } catch (e) {
      setItems(prev);
      toast.error(
        e instanceof Error ? e.message : "Failed to delete item"
      );
    }
  };

  const filtered = React.useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const counts = React.useMemo(() => {
    return {
      all: items.length,
      todo: items.filter((i) => i.status === "todo").length,
      reading: items.filter((i) => i.status === "reading").length,
      done: items.filter((i) => i.status === "done").length,
    };
  }, [items]);

  const filterBtns: { id: ReadingStatus | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "todo", label: "To read" },
    { id: "reading", label: "Reading" },
    { id: "done", label: "Done" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1 gap-1 overflow-x-auto max-w-full">
          {filterBtns.map((b) => (
            <button
              key={b.id}
              onClick={() => setFilter(b.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5",
                filter === b.id
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {b.label}
              <span className="text-[10px] text-muted-foreground">
                {counts[b.id]}
              </span>
            </button>
          ))}
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Icon name="plus" className="size-4" />
          Add
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="book-open"
          title={
            filter === "all" ? "Reading list is empty" : "Nothing here"
          }
          description={
            filter === "all"
              ? "Add books, articles, and videos you want to learn from."
              : "Try a different filter."
          }
          action={
            filter === "all" && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Icon name="plus" className="size-4" />
                Add item
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <AnimatePresence initial={false}>
            {filtered.map((item) => {
              const m = READING_STATUS_META[item.status];
              const c = colorFor(m.color);
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.22 }}
                  className="lift"
                >
                  <Card className="p-4 border-border/60 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Pill color={item.category ? "teal" : "emerald"}>
                            {item.category || "general"}
                          </Pill>
                        </div>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center gap-1"
                          >
                            <h4 className="text-sm font-semibold truncate group-hover:text-emerald-500 transition-colors">
                              {item.title}
                            </h4>
                            <Icon
                              name="external-link"
                              className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          </a>
                        ) : (
                          <h4 className="text-sm font-semibold truncate">
                            {item.title}
                          </h4>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => cycleStatus(item)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium shrink-0 transition-colors hover:opacity-80",
                              c.soft
                            )}
                            aria-label="Cycle status"
                          >
                            <Icon name={m.icon} className="size-3" />
                            {m.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Click to cycle status
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Added {formatDate(item.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 hover:text-rose-500"
                        onClick={() => deleteItem(item)}
                        aria-label="Delete item"
                      >
                        <Icon name="trash" className="size-3.5" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <ReadingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
      />
    </motion.div>
  );
}

// ─── 7. YouTube Checklist ────────────────────────────────────────────────────

const CHECKLIST_KEY = "yt-prepublish-checklist";

function ChecklistTab() {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const reset = () => {
    setChecked({});
    try {
      localStorage.removeItem(CHECKLIST_KEY);
    } catch {
      /* ignore */
    }
    toast.success("Checklist reset");
  };

  const doneCount = CHECKLIST_ITEMS.filter((i) => checked[i.id]).length;
  const pct = Math.round((doneCount / CHECKLIST_ITEMS.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <Card className="relative overflow-hidden border-border/60 p-5 sm:p-6">
        <div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px 240px at 0% 0%, rgba(244,63,94,0.10), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-rose-500/15 grid place-items-center shrink-0">
              <Icon name="list-checks" className="size-5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                Pre-publish checklist
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Run through every video before you hit publish. Saved to this
                browser.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <Icon name="refresh" className="size-3.5" />
            Reset
          </Button>
        </div>
        <div className="relative mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {doneCount} / {CHECKLIST_ITEMS.length} complete
            </span>
            <span className="font-semibold tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} color={pct === 100 ? "emerald" : "rose"} />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CHECKLIST_ITEMS.map((item, idx) => {
          const isOn = !!checked[item.id];
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.02 }}
              className="lift"
            >
              <Card
                className={cn(
                  "p-3 border-border/60 flex items-start gap-3 transition-colors",
                  isOn && "bg-emerald-500/[0.04]"
                )}
              >
                <Checkbox
                  checked={isOn}
                  onCheckedChange={() => toggle(item.id)}
                  className="mt-0.5"
                  id={`chk-${item.id}`}
                />
                <label
                  htmlFor={`chk-${item.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isOn && "line-through text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {item.hint}
                  </p>
                </label>
                {isOn && (
                  <Icon
                    name="check-circle"
                    className="size-4 text-emerald-500 shrink-0 mt-0.5"
                  />
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── 8. Learn ────────────────────────────────────────────────────────────────

function LearnTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <Card className="relative overflow-hidden border-border/60 p-4 sm:p-5">
        <div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px 240px at 100% 0%, rgba(245,158,11,0.12), transparent 60%)",
          }}
        />
        <div className="relative flex items-start gap-3">
          <div className="size-9 rounded-xl bg-amber-500/15 grid place-items-center shrink-0">
            <Icon name="lightbulb" className="size-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">Curated learning library</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hand-picked resources to level up every part of your channel.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {RESOURCES.map((r, idx) => {
          const c = colorFor(r.color);
          return (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.32,
                delay: idx * 0.04,
                ease: [0.2, 0.8, 0.2, 1],
              }}
              className="lift"
            >
              <Card className="relative overflow-hidden p-5 border-border/60 h-full flex flex-col gap-3">
                <div
                  className={cn(
                    "absolute -top-10 -right-10 size-24 rounded-full blur-2xl opacity-25",
                    c.bg
                  )}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <div
                    className={cn(
                      "size-10 rounded-xl grid place-items-center",
                      c.soft
                    )}
                  >
                    <Icon name="book-open" className="size-5" />
                  </div>
                  <Pill color={r.color}>{r.category}</Pill>
                </div>
                <div className="relative">
                  <h4 className="text-sm font-semibold leading-snug">
                    {r.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                    {r.description}
                  </p>
                </div>
                <div className="relative mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      window.open(r.url, "_blank", "noopener,noreferrer");
                      toast.success(`Opening: ${r.title}`);
                    }}
                  >
                    <Icon name="external-link" className="size-3.5" />
                    Open resource
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Extras Section ──────────────────────────────────────────────────────────

export function ExtrasSection() {
  const [tab, setTab] = React.useState("motivate");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Extras"
        description="A productivity toolkit — focus, capture, learn, ship."
        icon="layout-grid"
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="overflow-x-auto custom-scroll -mx-1 px-1 pb-1">
          <TabsList className="h-auto">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="gap-1.5 px-3 py-1.5"
              >
                <Icon name={t.icon} className="size-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="motivate">
          <MotivateTab />
        </TabsContent>
        <TabsContent value="focus">
          <FocusTab />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab />
        </TabsContent>
        <TabsContent value="bookmarks">
          <BookmarksTab />
        </TabsContent>
        <TabsContent value="clipboard">
          <ClipboardTab />
        </TabsContent>
        <TabsContent value="reading">
          <ReadingTab />
        </TabsContent>
        <TabsContent value="checklist">
          <ChecklistTab />
        </TabsContent>
        <TabsContent value="learn">
          <LearnTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
