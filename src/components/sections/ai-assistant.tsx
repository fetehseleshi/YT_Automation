"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { SectionHeader, Pill } from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import { api, uploadFile, relativeTime } from "@/lib/api";
import { cn, colorFor } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

/* ────────────────────────────────────────────────────────────────────────────
 * Tool config (client mirror). The server holds the canonical system prompts;
 * here we only need what the UI renders: label, description, icon, color, plus
 * a placeholder and example chips for the empty state.
 * ──────────────────────────────────────────────────────────────────────────── */
interface ToolConfig {
  label: string;
  description: string;
  icon: string;
  color: string;
  placeholder: string;
  examples: string[];
}

const TOOLS: Record<string, ToolConfig> = {
  ideas: {
    label: "Video Ideas",
    description: "Generate 8 specific, high-CTR YouTube video ideas",
    icon: "lightbulb",
    color: "teal",
    placeholder: "Describe your niche or topic for video ideas…",
    examples: [
      "Personal finance for new graduates",
      "AI productivity tools for solopreneurs",
      "Faceless history channel about the Cold War",
    ],
  },
  titles: {
    label: "Titles",
    description: "Generate 10 click-worthy title variations",
    icon: "file-text",
    color: "amber",
    placeholder: "What is the video about? Give a draft title or topic…",
    examples: [
      "How I built a $10K/mo faceless YouTube channel",
      "5 AI tools that replaced my entire workflow",
      "The truth about passive income on YouTube",
    ],
  },
  scripts: {
    label: "Scripts",
    description: "Write a full YouTube video script (hook, intro, 3-5 main points, CTA)",
    icon: "file-text",
    color: "emerald",
    placeholder: "Describe the video you want a full script for…",
    examples: [
      "8-minute script on the science of habit building",
      "Tutorial: how to set up a YouTube faceless automation stack",
      "Video essay on why the 4-day workweek is winning",
    ],
  },
  rewrite: {
    label: "Rewrite",
    description: "Rewrite the script to be more engaging, concise, and retention-optimized",
    icon: "edit",
    color: "rose",
    placeholder: "Paste the script you want rewritten…",
    examples: [
      "Paste your full script here for a retention pass",
      "Tighten this intro to under 30 seconds",
      "Make the CTA more persuasive",
    ],
  },
  hooks: {
    label: "Hooks",
    description: "Generate 10 scroll-stopping first-line hooks",
    icon: "zap",
    color: "amber",
    placeholder: "What's the video topic? We'll generate 10 first-line hooks…",
    examples: [
      "Topic: why most YouTubers quit in 6 months",
      "Topic: the truth about YouTube Shorts monetization",
      "Topic: how the algorithm actually works in 2025",
    ],
  },
  descriptions: {
    label: "Descriptions",
    description: "Write an SEO-optimized YouTube description with timestamps and keywords",
    icon: "list-checks",
    color: "teal",
    placeholder: "Give us the video title and topic for a full description…",
    examples: [
      "Title: 'How to automate a YouTube channel in 2025' — 12 min tutorial",
      "Topic: 5 Notion templates for content creators",
      "Title: 'The psychology of viral thumbnails'",
    ],
  },
  tags: {
    label: "Tags",
    description: "Generate 15 relevant YouTube tags/keywords",
    icon: "bookmark",
    color: "orange",
    placeholder: "Topic for tag research…",
    examples: [
      "Notion productivity tutorials",
      "Faceless YouTube automation",
      "Personal finance for beginners",
    ],
  },
  keywords: {
    label: "Keywords",
    description: "Keyword research: suggest primary + secondary keywords with rationale",
    icon: "search",
    color: "emerald",
    placeholder: "What topic should we research keywords for?…",
    examples: [
      "Keyword research for a YouTube automation channel",
      "Long-tail keywords for personal finance niche",
      "Keywords around 'AI video editing'",
    ],
  },
  thumbnails: {
    label: "Thumbnails",
    description: "Describe 5 high-CTR thumbnail concepts (visual, text overlay, emotion)",
    icon: "image",
    color: "rose",
    placeholder: "What's the video title/topic? We'll describe 5 thumbnail concepts…",
    examples: [
      "Title: 'I tried the $9 AI video editor for 30 days'",
      "Topic: 5 side hustles that actually work in 2025",
      "Title: 'Why your YouTube channel isn't growing'",
    ],
  },
  shorts: {
    label: "Shorts",
    description: "Generate 6 YouTube Shorts ideas from the topic",
    icon: "play",
    color: "teal",
    placeholder: "Topic to spin into Shorts ideas…",
    examples: [
      "Topic: 3 productivity hacks from Atomic Habits",
      "Topic: the morning routine of successful creators",
      "Topic: faceless channel niches exploding in 2025",
    ],
  },
  trending: {
    label: "Trending",
    description: "Suggest trending topics and angles in this niche",
    icon: "trending-up",
    color: "amber",
    placeholder: "What niche should we surface trending angles for?…",
    examples: [
      "Niche: AI productivity",
      "Niche: personal finance for Gen Z",
      "Niche: faceless YouTube automation",
    ],
  },
  summarize: {
    label: "Summarize",
    description: "Summarize the research into key actionable insights",
    icon: "clipboard-list",
    color: "emerald",
    placeholder: "Paste research, notes, or a transcript to summarize…",
    examples: [
      "Paste your competitor research notes here",
      "Paste a long transcript and we'll pull insights",
      "Paste 3 articles on a topic and get the key takeaways",
    ],
  },
  translate: {
    label: "Translate",
    description: "Translate the script into the requested language naturally",
    icon: "languages",
    color: "rose",
    placeholder: "Tell us the target language and paste the script…",
    examples: [
      "Translate this script into Spanish — [paste script]",
      "Localize into Hindi naturally — [paste script]",
      "Translate into Brazilian Portuguese — [paste script]",
    ],
  },
  seo: {
    label: "SEO Audit",
    description: "Audit and improve SEO: suggest title/keyword/description improvements",
    icon: "gauge",
    color: "orange",
    placeholder: "Paste your title + description for an SEO audit…",
    examples: [
      "Title: 'How to start a YouTube channel' — desc: 'in this video…'",
      "Audit this video's SEO — [paste title, desc, tags]",
      "Suggest better keywords for this title: …",
    ],
  },
};

const TOOL_ORDER = [
  "ideas",
  "titles",
  "scripts",
  "rewrite",
  "hooks",
  "descriptions",
  "tags",
  "keywords",
  "thumbnails",
  "shorts",
  "trending",
  "summarize",
  "translate",
  "seo",
] as const;

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tool?: string;
  createdAt?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Shared types for the new AI tool tabs (image / tts / asr / history).
 * ──────────────────────────────────────────────────────────────────────────── */
interface AIHistoryItem {
  id: string;
  tool: string;
  category: "text" | "image" | "audio" | "speech";
  prompt: string;
  response: string;
  model: string;
  favorite: boolean;
  meta: string;
  createdAt: string;
  updatedAt: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  type: "thumbnail" | "logo" | "banner" | "illustration";
  createdAt: number;
}

interface GeneratedAudio {
  id: string;
  url: string;
  text: string;
  voice: string;
  speed: number;
  chars: number;
  createdAt: number;
}

const IMAGE_TYPES: {
  value: GeneratedImage["type"];
  label: string;
  hint: string;
  color: string;
}[] = [
  { value: "thumbnail", label: "Thumbnail", hint: "16:9 · bold · high-CTR", color: "rose" },
  { value: "logo", label: "Channel logo", hint: "1:1 · minimalist vector", color: "emerald" },
  { value: "banner", label: "Channel banner", hint: "16:5 · cinematic wide", color: "teal" },
  { value: "illustration", label: "Illustration", hint: "Detailed content art", color: "amber" },
];

const VOICE_OPTIONS = [
  { value: "tongtong", label: "Tongtong", hint: "Balanced default" },
  { value: "alloy", label: "Alloy", hint: "Neutral" },
  { value: "echo", label: "Echo", hint: "Warm male" },
  { value: "nova", label: "Nova", hint: "Bright female" },
  { value: "shimmer", label: "Shimmer", hint: "Soft airy" },
  { value: "onyx", label: "Onyx", hint: "Deep authoritative" },
];

const CATEGORY_META: Record<
  AIHistoryItem["category"],
  { label: string; icon: string; color: string }
> = {
  text: { label: "Text", icon: "file-text", color: "emerald" },
  image: { label: "Image", icon: "image", color: "rose" },
  audio: { label: "Audio", icon: "music", color: "amber" },
  speech: { label: "Speech", icon: "message", color: "teal" },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Image Studio tab — generate thumbnails / logos / banners / illustrations.
 * ──────────────────────────────────────────────────────────────────────────── */
function ImageStudioTab() {
  const [prompt, setPrompt] = React.useState("");
  const [type, setType] = React.useState<GeneratedImage["type"]>("thumbnail");
  const [loading, setLoading] = React.useState(false);
  const [images, setImages] = React.useState<GeneratedImage[]>([]);

  async function generate() {
    const p = prompt.trim();
    if (!p || loading) return;
    setLoading(true);
    try {
      const data = await api<{ url: string; error?: string }>(
        "/api/ai/image",
        { method: "POST", body: JSON.stringify({ prompt: p, type }) }
      );
      if (data.error) {
        toast.error(data.error);
        return;
      }
      const img: GeneratedImage = {
        id: crypto.randomUUID(),
        url: data.url,
        prompt: p,
        type,
        createdAt: Date.now(),
      };
      setImages((prev) => [img, ...prev].slice(0, 6));
      toast.success("Image generated");
      setPrompt("");
    } catch (e) {
      console.error("[ai/image] failed", e);
      toast.error("Image generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function download(url: string, fallbackName: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      console.error("[download] failed", e);
      toast.error("Download failed");
    }
  }

  async function saveToFiles(img: GeneratedImage) {
    const typeMap: Record<GeneratedImage["type"], string> = {
      thumbnail: "thumbnail",
      logo: "logo",
      banner: "brand",
      illustration: "thumbnail",
    };
    try {
      await api("/api/files", {
        method: "POST",
        body: JSON.stringify({
          name: `${img.type}-${img.prompt.slice(0, 32).replace(/\s+/g, "-") || "ai-image"}`,
          type: typeMap[img.type],
          url: img.url,
          size: "AI-generated",
          folder: "AI Studio",
          tags: img.type,
          notes: img.prompt,
        }),
      });
      toast.success("Saved to File Library");
    } catch (e) {
      console.error("[save-to-files] failed", e);
      toast.error("Could not save to File Library");
    }
  }

  const activeType = IMAGE_TYPES.find((t) => t.value === type)!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <Card className="glass p-4 sm:p-5 border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-9 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 grid place-items-center">
            <Icon name="image" className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Image Studio</p>
            <p className="text-[11px] text-muted-foreground">
              Generate thumbnails, logos, banners, and illustrations with AI.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="img-prompt" className="text-xs text-muted-foreground">
              Prompt
            </Label>
            <Textarea
              id="img-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A futuristic neon cityscape at dusk with a glowing skyline, cinematic, vibrant"
              rows={3}
              className="resize-none bg-background/60"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Asset type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {IMAGE_TYPES.map((t) => {
                const c = colorFor(t.color);
                const active = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-primary/60 bg-primary/5 shadow-sm"
                        : "border-border/60 bg-card/40 hover:bg-accent/40"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          active ? "bg-primary" : c.dot
                        )}
                      />
                      <span className="text-xs font-semibold truncate">{t.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{t.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Style hint: <span className="text-foreground/80">{activeType.hint}</span>
            </p>
            <Button
              onClick={() => void generate()}
              disabled={loading || !prompt.trim()}
              className="min-w-32"
            >
              {loading ? (
                <>
                  <Icon name="refresh" className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Icon name="sparkles" className="size-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Gallery */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">This session</p>
          <p className="text-[11px] text-muted-foreground">
            {images.length} image{images.length === 1 ? "" : "s"}
          </p>
        </div>
        {images.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <div className="size-12 rounded-xl bg-rose-500/10 text-rose-500 grid place-items-center mx-auto mb-3">
              <Icon name="image" className="size-6" />
            </div>
            <p className="text-sm font-medium">No images yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Write a prompt above and hit Generate to create your first asset.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {images.map((img) => {
                const t = IMAGE_TYPES.find((x) => x.value === img.type)!;
                const c = colorFor(t.color);
                return (
                  <motion.div
                    key={img.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.25 }}
                    className="lift"
                  >
                    <Card className="overflow-hidden p-0 border-border/60">
                      <div className="relative aspect-video bg-muted/40 overflow-hidden">
                        <img
                          src={img.url}
                          alt={img.prompt}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute top-2 left-2">
                          <Pill color={t.color} icon={t.value === "thumbnail" ? "image" : "image"}>
                            {t.label}
                          </Pill>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                          {img.prompt}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => download(img.url, `ai-${img.type}.png`)}
                          >
                            <Icon name="download" className="size-3" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => void saveToFiles(img)}
                          >
                            <Icon name="upload" className="size-3" />
                            Save to Files
                          </Button>
                          <a
                            href={img.url}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "ml-auto inline-flex items-center gap-1 text-[11px] font-medium",
                              c.text
                            )}
                          >
                            <Icon name="external-link" className="size-3" />
                            Open
                          </a>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Voiceover tab — Kokoro-equivalent TTS.
 * ──────────────────────────────────────────────────────────────────────────── */
function VoiceoverTab() {
  const [text, setText] = React.useState("");
  const [voice, setVoice] = React.useState("tongtong");
  const [speed, setSpeed] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [audios, setAudios] = React.useState<GeneratedAudio[]>([]);

  async function generate() {
    const t = text.trim();
    if (!t || loading) return;
    if (t.length > 3000) {
      toast.error("Text is too long (max 3000 characters)");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{
        url: string;
        voice: string;
        speed: number;
        chars: number;
        error?: string;
      }>("/api/ai/tts", {
        method: "POST",
        body: JSON.stringify({ text: t, voice, speed }),
      });
      if (data.error) {
        toast.error(data.error);
        return;
      }
      const audio: GeneratedAudio = {
        id: crypto.randomUUID(),
        url: data.url,
        text: t,
        voice: data.voice,
        speed: data.speed,
        chars: data.chars,
        createdAt: Date.now(),
      };
      setAudios((prev) => [audio, ...prev].slice(0, 12));
      toast.success("Voiceover generated");
    } catch (e) {
      console.error("[ai/tts] failed", e);
      toast.error("Voiceover generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function download(url: string, name: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      console.error("[download] failed", e);
      toast.error("Download failed");
    }
  }

  async function saveToFiles(audio: GeneratedAudio) {
    try {
      await api("/api/files", {
        method: "POST",
        body: JSON.stringify({
          name: `voiceover-${audio.text.slice(0, 28).replace(/\s+/g, "-") || "ai"}`,
          type: "voiceover",
          url: audio.url,
          size: `${audio.chars} chars`,
          folder: "AI Studio",
          tags: `tts,${audio.voice}`,
          notes: audio.text.slice(0, 200),
        }),
      });
      toast.success("Saved to File Library");
    } catch (e) {
      console.error("[save-to-files] failed", e);
      toast.error("Could not save to File Library");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <Card className="glass p-4 sm:p-5 border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center">
            <Icon name="music" className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Voiceover (TTS)</p>
            <p className="text-[11px] text-muted-foreground">
              Turn scripts into natural-sounding voiceovers. Kokoro-equivalent engine.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tts-text" className="text-xs text-muted-foreground">
                Script to narrate
              </Label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {text.length} / 3000
              </span>
            </div>
            <Textarea
              id="tts-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your script here. Up to 3000 characters."
              rows={5}
              className="resize-none bg-background/60"
              disabled={loading}
              maxLength={3000}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Voice</Label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{v.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          · {v.hint}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Speed</Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {speed.toFixed(2)}×
                </span>
              </div>
              <div className="pt-2">
                <Slider
                  value={[speed]}
                  min={0.5}
                  max={2}
                  step={0.05}
                  onValueChange={(v) => setSpeed(v[0] ?? 1)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                  <span>0.5×</span>
                  <span>1×</span>
                  <span>2×</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Tip: shorter sentences sound more natural.
            </p>
            <Button
              onClick={() => void generate()}
              disabled={loading || !text.trim()}
              className="min-w-32"
            >
              {loading ? (
                <>
                  <Icon name="refresh" className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Icon name="play" className="size-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Recent voiceovers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Recent voiceovers</p>
          <p className="text-[11px] text-muted-foreground">
            {audios.length} track{audios.length === 1 ? "" : "s"}
          </p>
        </div>
        {audios.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <div className="size-12 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center mx-auto mb-3">
              <Icon name="music" className="size-6" />
            </div>
            <p className="text-sm font-medium">No voiceovers yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Paste your script and hit Generate to hear it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {audios.map((audio, i) => {
                const v = VOICE_OPTIONS.find((x) => x.value === audio.voice);
                return (
                  <motion.div
                    key={audio.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Card className="p-3 sm:p-4 border-border/60 lift">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
                          <Icon name="play" className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Pill color="amber" icon="music">
                              {v?.label ?? audio.voice}
                            </Pill>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {audio.speed.toFixed(2)}× · {audio.chars} chars
                            </span>
                            <span className="text-[11px] text-muted-foreground ml-auto">
                              #{audios.length - i}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
                            {audio.text}
                          </p>
                        </div>
                      </div>
                      <audio controls src={audio.url} className="w-full h-9" />
                      <div className="flex items-center gap-1.5 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => download(audio.url, `voiceover-${audio.voice}.wav`)}
                        >
                          <Icon name="download" className="size-3" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => void saveToFiles(audio)}
                        >
                          <Icon name="upload" className="size-3" />
                          Save to Files
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Transcribe tab — Whisper-equivalent ASR.
 * ──────────────────────────────────────────────────────────────────────────── */
function TranscribeTab() {
  const [file, setFile] = React.useState<File | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.type.startsWith("audio/") && !/\.(mp3|wav|m4a|ogg|flac|aac|webm)$/i.test(f.name)) {
      toast.error("Please choose an audio file (mp3, wav, m4a, etc.)");
      return;
    }
    setFile(f);
    setTranscript("");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function transcribe() {
    if (!file || loading) return;
    setLoading(true);
    setTranscript("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (prompt.trim()) fd.append("prompt", prompt.trim());
      const data = await uploadFile<{ text?: string; error?: string }>(
        "/api/ai/asr",
        fd
      );
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.text) {
        setTranscript(data.text);
        toast.success(`Transcribed ${data.text.length} characters`);
      } else {
        toast.error("No transcript returned");
      }
    } catch (e) {
      console.error("[ai/asr] failed", e);
      toast.error("Transcription failed. Please try a different file.");
    } finally {
      setLoading(false);
    }
  }

  async function copyTranscript() {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error("[copy] failed", e);
      toast.error("Could not copy");
    }
  }

  async function saveAsNote() {
    if (!transcript) return;
    try {
      await api("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: `Transcript — ${file?.name ?? "audio"}`.slice(0, 80),
          content: transcript,
          color: "teal",
          type: "quick",
          pinned: false,
        }),
      });
      toast.success("Saved as note");
    } catch (e) {
      console.error("[save-as-note] failed", e);
      toast.error("Could not save as note");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      <Card className="glass p-4 sm:p-5 border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 grid place-items-center">
            <Icon name="message" className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Transcribe (ASR)</p>
            <p className="text-[11px] text-muted-foreground">
              Upload an audio file and get a clean transcript. Whisper-equivalent engine.
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-2xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
            dragOver
              ? "border-primary/70 bg-primary/5"
              : "border-border/60 bg-background/40 hover:bg-accent/30"
          )}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="size-10 rounded-lg bg-teal-500/10 text-teal-500 grid place-items-center">
                <Icon name="music" className="size-5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {(file.size / 1024).toFixed(1)} KB · {file.type || "audio"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="ml-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setTranscript("");
                }}
              >
                <Icon name="x" className="size-4" />
              </Button>
            </div>
          ) : (
            <div>
              <div className="size-12 rounded-xl bg-teal-500/10 text-teal-500 grid place-items-center mx-auto mb-3">
                <Icon name="upload" className="size-6" />
              </div>
              <p className="text-sm font-medium">
                Drop an audio file here, or click to browse
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                mp3, wav, m4a, ogg, flac · max 25MB
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1.5 mt-3">
          <Label htmlFor="asr-prompt" className="text-xs text-muted-foreground">
            Context prompt (optional)
          </Label>
          <Input
            id="asr-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. This is a YouTube script about productivity."
            className="bg-background/60"
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-3">
          <p className="text-[11px] text-muted-foreground">
            {file
              ? "Ready to transcribe"
              : "Choose an audio file to begin"}
          </p>
          <Button
            onClick={() => void transcribe()}
            disabled={loading || !file}
            className="min-w-32"
          >
            {loading ? (
              <>
                <Icon name="refresh" className="size-4 animate-spin" />
                Transcribing…
              </>
            ) : (
              <>
                <Icon name="message" className="size-4" />
                Transcribe
              </>
            )}
          </Button>
        </div>
      </Card>

      {transcript && (
        <Card className="glass p-4 sm:p-5 border-border/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-teal-500/10 text-teal-500 grid place-items-center">
                <Icon name="file-text" className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Transcript</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {transcript.length} characters · {transcript.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => void copyTranscript()}
              >
                <Icon name={copied ? "check" : "copy"} className="size-3" />
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => void saveAsNote()}
              >
                <Icon name="sticky-note" className="size-3" />
                Save as Note
              </Button>
            </div>
          </div>
          <Textarea
            value={transcript}
            readOnly
            rows={10}
            className="resize-none bg-background/60 font-mono text-[13px] leading-relaxed"
          />
        </Card>
      )}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * History tab — full AI history with search / filter / favorite / delete.
 * ──────────────────────────────────────────────────────────────────────────── */
function HistoryTab() {
  const [items, setItems] = React.useState<AIHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category !== "all") params.set("category", category);
      if (favoritesOnly) params.set("favorite", "true");
      const data = await api<{ items: AIHistoryItem[] }>(
        `/api/ai/history?${params.toString()}`
      );
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error("[ai/history] load failed", e);
      toast.error("Failed to load AI history");
    } finally {
      setLoading(false);
    }
  }, [q, category, favoritesOnly]);

  // Debounced reload on filter changes.
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [load]);

  async function toggleFavorite(item: AIHistoryItem) {
    // Optimistic update.
    setItems((prev) =>
      prev.map((x) =>
        x.id === item.id ? { ...x, favorite: !x.favorite } : x
      )
    );
    setBusyId(item.id);
    try {
      await api("/api/ai/history", {
        method: "POST",
        body: JSON.stringify({
          action: item.favorite ? "unfavorite" : "favorite",
          id: item.id,
        }),
      });
    } catch (e) {
      // Revert.
      console.error("[history] favorite failed", e);
      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, favorite: item.favorite } : x
        )
      );
      toast.error("Failed to update favorite");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(item: AIHistoryItem) {
    const prev = items;
    setItems((curr) => curr.filter((x) => x.id !== item.id));
    setBusyId(item.id);
    try {
      await api("/api/ai/history", {
        method: "POST",
        body: JSON.stringify({ action: "delete", id: item.id }),
      });
      toast.success("Entry deleted");
    } catch (e) {
      console.error("[history] delete failed", e);
      setItems(prev);
      toast.error("Failed to delete entry");
    } finally {
      setBusyId(null);
    }
  }

  function parseMeta(meta: string): Record<string, unknown> {
    try {
      const v = JSON.parse(meta);
      return typeof v === "object" && v ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { text: 0, image: 0, audio: 0, speech: 0 };
    items.forEach((i) => {
      c[i.category] = (c[i.category] ?? 0) + 1;
    });
    return c;
  }, [items]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="space-y-4"
    >
      {/* Filter bar */}
      <Card className="glass p-3 sm:p-4 border-border/60">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search prompts and responses…"
              className="pl-9 bg-background/60"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-0.5 overflow-x-auto custom-scroll max-w-full">
              <CategoryChip
                label="All"
                active={category === "all"}
                count={items.length}
                onClick={() => setCategory("all")}
              />
              {(["text", "image", "audio", "speech"] as const).map((cat) => (
                <CategoryChip
                  key={cat}
                  label={CATEGORY_META[cat].label}
                  icon={CATEGORY_META[cat].icon}
                  color={CATEGORY_META[cat].color}
                  active={category === cat}
                  count={counts[cat] ?? 0}
                  onClick={() => setCategory(cat)}
                />
              ))}
            </div>
            <Button
              size="sm"
              variant={favoritesOnly ? "default" : "outline"}
              className="h-9"
              onClick={() => setFavoritesOnly((v) => !v)}
              aria-pressed={favoritesOnly}
            >
              <Icon name="star" className="size-4" />
              Favorites
            </Button>
          </div>
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4 border-border/60">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-muted/60 shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-muted/60 shimmer" />
                  <div className="h-3 w-2/3 rounded bg-muted/40 shimmer" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center">
          <div className="size-12 rounded-xl bg-accent grid place-items-center mx-auto mb-3">
            <Icon name="clipboard-list" className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No history yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {q || category !== "all" || favoritesOnly
              ? "No entries match your filters. Try clearing them."
              : "Generate something in the other tabs — it will show up here automatically."}
          </p>
          {(q || category !== "all" || favoritesOnly) && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                setQ("");
                setCategory("all");
                setFavoritesOnly(false);
              }}
            >
              <Icon name="x" className="size-4" />
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const cat = CATEGORY_META[item.category] ?? CATEGORY_META.text;
              const c = colorFor(cat.color);
              const isExpanded = expanded[item.id] ?? false;
              const meta = parseMeta(item.meta);
              const metaUrl = typeof meta.url === "string" ? meta.url : null;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4, scale: 0.99 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="p-3 sm:p-4 border-border/60 hover:bg-accent/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "size-9 rounded-lg grid place-items-center shrink-0",
                          c.soft
                        )}
                      >
                        <Icon name={cat.icon} className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Pill color={cat.color} icon={cat.icon}>
                            {cat.label}
                          </Pill>
                          <span className="text-[11px] text-muted-foreground">
                            tool: <span className="text-foreground/80">{item.tool}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-auto">
                            {relativeTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs font-medium line-clamp-2 leading-snug">
                          {item.prompt || "—"}
                        </p>
                        {item.response && (
                          <div className="mt-1">
                            <p
                              className={cn(
                                "text-xs text-muted-foreground whitespace-pre-wrap leading-snug",
                                !isExpanded && "line-clamp-3"
                              )}
                            >
                              {item.response}
                            </p>
                            {item.response.length > 180 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpanded((p) => ({
                                    ...p,
                                    [item.id]: !p[item.id],
                                  }))
                                }
                                className="text-[11px] text-primary hover:underline mt-1"
                              >
                                {isExpanded ? "Show less" : "Show more"}
                              </button>
                            )}
                          </div>
                        )}
                        {metaUrl && (
                          <div className="mt-2 flex items-center gap-2">
                            {item.category === "image" ? (
                              <img
                                src={metaUrl}
                                alt={item.prompt}
                                className="size-12 rounded-md object-cover border border-border/60"
                                loading="lazy"
                              />
                            ) : (
                              <a
                                href={metaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                              >
                                <Icon name="play" className="size-3" />
                                Play audio
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleFavorite(item)}
                          disabled={busyId === item.id}
                          className={cn(
                            "size-7 rounded-md grid place-items-center transition-colors",
                            item.favorite
                              ? "text-amber-500 hover:bg-amber-500/10"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                          aria-label={item.favorite ? "Unfavorite" : "Favorite"}
                          title={item.favorite ? "Unfavorite" : "Favorite"}
                        >
                          <Icon
                            name="star"
                            className="size-4"
                            fill={item.favorite ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteItem(item)}
                          disabled={busyId === item.id}
                          className="size-7 rounded-md grid place-items-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Icon name="trash" className="size-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function CategoryChip({
  label,
  icon,
  color,
  active,
  count,
  onClick,
}: {
  label: string;
  icon?: string;
  color?: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const c = color ? colorFor(color) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? c
            ? cn(c.soft, "shadow-sm")
            : "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
    >
      {icon && <Icon name={icon} className="size-3" />}
      {label}
      <span className="text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Markdown rendering with manual styling (we don't ship @tailwindcss/typography).
 * ──────────────────────────────────────────────────────────────────────────── */
const markdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => <h1 className="text-base font-bold mt-1 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 text-sm">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
  code: ({ className, children, ...rest }) => {
    // Fenced code blocks arrive with className="language-xxx"; render plain so
    // the surrounding <pre> provides the styling. Inline code gets a chip.
    const isBlock = /\blanguage-/.test(className || "");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-[12px]", className)} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted text-foreground rounded px-1 py-0.5 text-[12px] font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-muted/50 rounded-lg p-3 overflow-x-auto text-[12px] font-mono my-2">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-3" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
};

function TypingDots() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-primary/70"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * AISection
 * ──────────────────────────────────────────────────────────────────────────── */
export function AISection() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [selectedTool, setSelectedTool] = React.useState<string>("ideas");
  const [loading, setLoading] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(true);

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const tool = TOOLS[selectedTool] ?? TOOLS.ideas;

  /* Load history on mount. */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ messages: ChatMessage[] }>("/api/ai/history");
        if (!cancelled && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (e) {
        console.error("[ai] history load failed", e);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Auto-scroll to bottom on new message / loading change. */
  React.useEffect(() => {
    const root = scrollAreaRef.current;
    if (!root) return;
    const viewport = root.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    );
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading]);

  const focusInput = React.useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  function selectTool(key: string) {
    setSelectedTool(key);
    focusInput();
  }

  async function send(content?: string) {
    const text = (content ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      tool: selectedTool,
      createdAt: new Date().toISOString(),
    };
    const history = messages
      .filter((m) => m.content?.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await api<{ content: string; saved: boolean }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ tool: selectedTool, input: text, history }),
      });
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        tool: selectedTool,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      console.error("[ai] send failed", e);
      toast.error("Failed to reach the AI assistant. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I couldn't reach the AI service just now. Please check your connection and try again.",
          tool: selectedTool,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      focusInput();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  async function clearHistory() {
    if (messages.length === 0) return;
    try {
      await api("/api/ai/history", {
        method: "POST",
        body: JSON.stringify({ action: "clear" }),
      });
      setMessages([]);
      toast.success("Chat cleared");
    } catch (e) {
      console.error("[ai] clear history failed", e);
      toast.error("Failed to clear chat history");
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="AI Assistant"
        description="Your AI co-pilot for every step of content creation"
        icon="sparkles"
        actions={
          <Button variant="outline" size="sm" onClick={clearHistory} disabled={messages.length === 0}>
            <Icon name="refresh" className="size-4" />
            Clear chat
          </Button>
        }
      />

      <Tabs defaultValue="chat" className="w-full">
        <div className="overflow-x-auto custom-scroll -mx-1 px-1 pb-1">
          <TabsList className="h-9">
            <TabsTrigger value="chat" className="gap-1.5">
              <Icon name="sparkles" className="size-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-1.5">
              <Icon name="image" className="size-3.5" />
              Image Studio
            </TabsTrigger>
            <TabsTrigger value="tts" className="gap-1.5">
              <Icon name="music" className="size-3.5" />
              Voiceover
            </TabsTrigger>
            <TabsTrigger value="asr" className="gap-1.5">
              <Icon name="message" className="size-3.5" />
              Transcribe
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <Icon name="clipboard-list" className="size-3.5" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="space-y-5 mt-0 focus-visible:outline-none">

      {/* Tool grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2"
      >
        {TOOL_ORDER.map((key, i) => {
          const t = TOOLS[key];
          const c = colorFor(t.color);
          const active = selectedTool === key;
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => selectTool(key)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.025 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                active
                  ? "border-primary/60 bg-primary/5 shadow-sm"
                  : "border-border/60 bg-card/50 hover:border-border hover:bg-accent/40"
              )}
              aria-pressed={active}
              title={t.description}
            >
              <div
                className={cn(
                  "size-8 rounded-lg grid place-items-center shrink-0 transition-transform group-hover:scale-105",
                  c.soft
                )}
              >
                <Icon name={t.icon} className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{t.label}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                  {t.description}
                </p>
              </div>
              {active && (
                <motion.span
                  layoutId="tool-active-dot"
                  className="absolute top-2 right-2 size-1.5 rounded-full bg-primary"
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Chat panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Card className="glass overflow-hidden p-0 min-h-[55vh] h-[calc(100vh-22rem)] max-h-[82vh] flex flex-col border-border/60">
          {/* Gradient header */}
          <div className="relative shrink-0 px-4 sm:px-5 py-3 border-b border-border/60">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-amber-500/10 pointer-events-none" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-8 rounded-lg bg-primary/15 grid place-items-center shrink-0">
                  <Icon name="sparkles" className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">AI Co-pilot</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {messages.length === 0
                      ? "Ready when you are"
                      : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {loading && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    thinking
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 min-h-0 relative">
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className="px-4 sm:px-5 py-4 space-y-4">
                <AnimatePresence initial={false}>
                  {loadingHistory && messages.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon name="refresh" className="size-4 animate-spin" />
                        Loading chat history…
                      </div>
                    </div>
                  ) : messages.length === 0 && !loading ? (
                    <EmptyHero
                      toolKey={selectedTool}
                      onPickExample={(ex) => {
                        setInput(ex);
                        focusInput();
                      }}
                    />
                  ) : null}

                  {messages.map((m, i) => (
                    <MessageBubble key={m.id ?? `${i}-${m.role}`} message={m} />
                  ))}

                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-3"
                    >
                      <Avatar tool={selectedTool} />
                      <div className="glass rounded-2xl rounded-tl-sm border border-border/60">
                        <TypingDots />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border/60 bg-card/40 px-3 sm:px-4 py-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Pill color={tool.color} icon={tool.icon}>
                {tool.label}
              </Pill>
              <button
                type="button"
                onClick={() => setSelectedTool("ideas")}
                className="inline-flex items-center justify-center size-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Deselect tool"
              >
                <Icon name="x" className="size-3" />
              </button>
              <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[10px] font-mono">
                  Enter
                </kbd>{" "}
                to send ·{" "}
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[10px] font-mono">
                  Shift+Enter
                </kbd>{" "}
                for newline
              </span>
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder={tool.placeholder}
                className="resize-none min-h-[44px] max-h-40 bg-background/60"
                disabled={loading}
              />
              <Button
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                size="icon"
                className="size-10 shrink-0 rounded-xl"
                aria-label="Send message"
              >
                <Icon name="arrow-up-right" className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

        </TabsContent>

        <TabsContent value="image" className="mt-0 focus-visible:outline-none">
          <ImageStudioTab />
        </TabsContent>

        <TabsContent value="tts" className="mt-0 focus-visible:outline-none">
          <VoiceoverTab />
        </TabsContent>

        <TabsContent value="asr" className="mt-0 focus-visible:outline-none">
          <TranscribeTab />
        </TabsContent>

        <TabsContent value="history" className="mt-0 focus-visible:outline-none">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Empty hero — shown when there are no messages yet
 * ──────────────────────────────────────────────────────────────────────────── */
function EmptyHero({
  toolKey,
  onPickExample,
}: {
  toolKey: string;
  onPickExample: (text: string) => void;
}) {
  const t = TOOLS[toolKey] ?? TOOLS.ideas;
  const c = colorFor(t.color);
  return (
    <motion.div
      key={`empty-${toolKey}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center text-center py-10 sm:py-14 px-4"
    >
      <div className={cn("size-14 rounded-2xl grid place-items-center mb-4", c.soft)}>
        <Icon name={t.icon} className="size-7" />
      </div>
      <p className="text-base font-semibold">{t.label}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">{t.description}</p>
      <div className="mt-5 flex flex-col gap-2 w-full max-w-lg">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Try one of these
        </p>
        {t.examples.map((ex, i) => (
          <motion.button
            key={ex}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            whileHover={{ x: 2 }}
            onClick={() => onPickExample(ex)}
            className="text-left text-sm rounded-lg border border-border/60 bg-card/40 hover:bg-accent/40 hover:border-border px-3 py-2 transition-colors"
          >
            <span className="text-muted-foreground mr-2">→</span>
            {ex}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Single message bubble
 * ──────────────────────────────────────────────────────────────────────────── */
function Avatar({ tool }: { tool?: string }) {
  const t = tool ? TOOLS[tool] : undefined;
  const c = t ? colorFor(t.color) : colorFor("emerald");
  return (
    <div className={cn("size-8 rounded-lg grid place-items-center shrink-0", c.soft)}>
      <Icon name={t?.icon ?? "sparkles"} className="size-4" />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const t = message.tool ? TOOLS[message.tool] : undefined;
  const c = t ? colorFor(t.color) : colorFor("emerald");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("flex items-start gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "size-8 rounded-lg grid place-items-center shrink-0",
          isUser ? "bg-primary/15 text-primary" : c.soft
        )}
      >
        <Icon name={isUser ? "users2" : t?.icon ?? "sparkles"} className="size-4" />
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5",
          isUser
            ? "bg-primary/15 text-foreground rounded-tr-sm"
            : "glass border border-border/60 rounded-tl-sm"
        )}
      >
        {t && !isUser && (
          <div className="mb-3 flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                c.soft,
                c.text
              )}
            >
              {t.label}
            </span>
          </div>
        )}
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed space-y-3">
            <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  );
}
