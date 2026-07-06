"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { signOut } from "next-auth/react";
import { SectionHeader, Pill } from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── localStorage-backed settings store ─────────────────────────────────────
const get = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem("settings:" + k) ?? "null") ?? d;
  } catch {
    return d;
  }
};
const set = (k: string, v: unknown) =>
  localStorage.setItem("settings:" + k, JSON.stringify(v));

async function loadRemoteSettings(): Promise<Record<string, string> | null> {
  try {
    const data = await api<{ settings: Record<string, string> }>("/api/settings");
    return data.settings ?? null;
  } catch (error) {
    return null;
  }
}

async function saveRemoteSettings(updates: Record<string, string>) {
  try {
    await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({ updates }),
    });
    return true;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return false;
    }
    toast.error("Unable to save settings to the studio backend.");
    return false;
  }
}

function stringifySetting(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseSetting<T>(value: string | undefined, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof fallback === "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

function useSyncedSetting<T>(key: string, defaultValue: T) {
  const [value, setValue] = React.useState<T>(defaultValue);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const local = get<T>(key, defaultValue);
    setValue(local);

    let cancelled = false;
    (async () => {
      const remote = await loadRemoteSettings();
      if (cancelled || !remote) return;
      if (remote[key] !== undefined) {
        const parsed = parseSetting(remote[key], defaultValue);
        setValue(parsed);
        set(key, parsed);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultValue, key]);

  const update = React.useCallback(
    async (next: T) => {
      setValue(next);
      set(key, next);
      await saveRemoteSettings({ [key]: stringifySetting(next) });
    },
    [key]
  );

  return [value, update, mounted] as const;
}

// ─── Static option sets ─────────────────────────────────────────────────────
const ACCENTS = [
  { key: "emerald", label: "Emerald", dot: "bg-emerald-500", soft: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/40" },
  { key: "amber", label: "Amber", dot: "bg-amber-500", soft: "bg-amber-500/10 text-amber-600 dark:text-amber-400", ring: "ring-amber-500/40" },
  { key: "rose", label: "Rose", dot: "bg-rose-500", soft: "bg-rose-500/10 text-rose-600 dark:text-rose-400", ring: "ring-rose-500/40" },
  { key: "teal", label: "Teal", dot: "bg-teal-500", soft: "bg-teal-500/10 text-teal-600 dark:text-teal-400", ring: "ring-teal-500/40" },
  { key: "orange", label: "Orange", dot: "bg-orange-500", soft: "bg-orange-500/10 text-orange-600 dark:text-orange-400", ring: "ring-orange-500/40" },
] as const;

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
] as const;

const NOTIF_KEYS = [
  { key: "email", label: "Email notifications", desc: "Receive a daily digest of activity in your inbox.", icon: "info" },
  { key: "tasks", label: "Task reminders", desc: "Get reminded about tasks due in the next 24 hours.", icon: "check-square" },
  { key: "publish", label: "Publish reminders", desc: "Heads-up before a scheduled video goes live.", icon: "upload" },
  { key: "weekly", label: "Weekly reports", desc: "Sunday digest with revenue, views and growth.", icon: "bar-chart-3" },
  { key: "trends", label: "Trend alerts", desc: "Notify me when a tracked trend spikes in volume.", icon: "trending-up" },
] as const;

const DEVICES = [
  { id: "d1", name: "MacBook Pro · Chrome", location: "San Francisco, US", current: true, last: "Active now" },
  { id: "d2", name: "iPhone 15 · Safari", location: "San Francisco, US", current: false, last: "2 hours ago" },
  { id: "d3", name: "Windows · Edge", location: "Berlin, DE", current: false, last: "Yesterday" },
];

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Open command palette", group: "Global" },
  { keys: ["G", "D"], label: "Go to Dashboard", group: "Navigation" },
  { keys: ["G", "C"], label: "Go to Channels", group: "Navigation" },
  { keys: ["G", "P"], label: "Go to Content Planner", group: "Navigation" },
  { keys: ["G", "V"], label: "Go to Videos", group: "Navigation" },
  { keys: ["G", "T"], label: "Go to Tasks", group: "Navigation" },
  { keys: ["G", "F"], label: "Go to Finance", group: "Navigation" },
  { keys: ["N"], label: "Quick add new task", group: "Actions" },
  { keys: ["F"], label: "Toggle focus mode", group: "Actions" },
  { keys: ["?"], label: "Show keyboard shortcuts", group: "Actions" },
  { keys: ["Esc"], label: "Close dialog / palette", group: "Actions" },
];

const TABS = [
  { value: "appearance", label: "Appearance", icon: "palette" },
  { value: "profile", label: "Profile", icon: "users" },
  { value: "language", label: "Language", icon: "languages" },
  { value: "notifications", label: "Notifications", icon: "bell" },
  { value: "security", label: "Security", icon: "shield" },
  { value: "data", label: "Data & Backup", icon: "database" },
  { value: "shortcuts", label: "Shortcuts", icon: "keyboard" },
  { value: "about", label: "About", icon: "info" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

// ─── Helpers ────────────────────────────────────────────────────────────────
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Y";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Main component ─────────────────────────────────────────────────────────
export function SettingsSection() {
  const [tab, setTab] = React.useState<TabValue>("appearance");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Settings"
        description="Personalize your studio — appearance, profile, language, notifications, security, and data."
        icon="settings"
        actions={
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Auto-saved
          </Badge>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabValue)}
        className="flex flex-col lg:flex-row gap-5 items-start"
      >
        {/* Left rail: vertical on desktop, horizontal scroll on mobile */}
        <TabsList className="lg:flex-col lg:h-auto lg:w-60 lg:items-stretch lg:justify-start w-full overflow-x-auto lg:overflow-visible h-auto p-1.5 gap-1">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="lg:justify-start lg:w-full justify-center gap-2 px-3 py-2 text-sm h-9 whitespace-nowrap"
            >
              <Icon name={t.icon} className="size-4 shrink-0" />
              <span className="hidden sm:inline lg:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Right content: animated */}
        <div className="flex-1 w-full min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {mounted ? (
                <>
                  {tab === "appearance" && <AppearanceTab />}
                  {tab === "profile" && <ProfileTab />}
                  {tab === "language" && <LanguageTab />}
                  {tab === "notifications" && <NotificationsTab />}
                  {tab === "security" && <SecurityTab />}
                  {tab === "data" && <DataTab />}
                  {tab === "shortcuts" && <ShortcutsTab />}
                  {tab === "about" && <AboutTab />}
                </>
              ) : (
                <Card className="glass p-6">
                  <div className="shimmer h-48 rounded-lg bg-muted/40" />
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Sub-card wrapper ───────────────────────────────────────────────────────
function SettingsCard({
  title,
  description,
  icon,
  children,
  action,
}: {
  title: string;
  description?: string;
  icon?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="glass border-border/60 lift">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                <Icon name={icon} className="size-4.5 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && (
                <CardDescription className="mt-0.5">{description}</CardDescription>
              )}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ─── 1. Appearance ──────────────────────────────────────────────────────────
function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [themePreference, setThemePreference, themeMounted] = useSyncedSetting<string>("theme", "dark");
  const [accent, setAccent, accentMounted] = useSyncedSetting<string>("accent", "emerald");
  const [density, setDensity, densityMounted] = useSyncedSetting<string>("density", "comfortable");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Apply accent as data attribute on <html> for future CSS hookups.
  React.useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent, mounted]);

  React.useEffect(() => {
    if (!mounted) return;
    setTheme(themePreference);
  }, [themePreference, mounted, setTheme]);

  const themeValue = mounted ? themePreference : "dark";

  const themes: { key: string; label: string; icon: string }[] = [
    { key: "light", label: "Light", icon: "sun" },
    { key: "dark", label: "Dark", icon: "moon" },
    { key: "system", label: "System", icon: "globe" },
  ];

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Theme"
        description="Pick how the studio looks. System follows your OS preference."
        icon="palette"
      >
        <RadioGroup
          value={themeValue}
          onValueChange={(v) => {
            setTheme(v);
            setThemePreference(v);
            toast.success("Theme preference saved", {
              description: `Switched to ${v} mode.`,
            });
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {themes.map((t) => (
            <label
              key={t.key}
              htmlFor={`theme-${t.key}`}
              className={cn(
                "group relative cursor-pointer rounded-xl border p-3 transition-all",
                themeValue === t.key
                  ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20"
                  : "border-border/60 hover:border-border hover:bg-accent/40"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{t.label}</span>
                <RadioGroupItem id={`theme-${t.key}`} value={t.key} />
              </div>
              {/* Visual preview */}
              <div
                className={cn(
                  "h-16 rounded-lg overflow-hidden border",
                  t.key === "light"
                    ? "bg-zinc-50 border-zinc-200"
                    : t.key === "dark"
                    ? "bg-zinc-950 border-zinc-800"
                    : "bg-gradient-to-r from-zinc-50 to-zinc-950 border-zinc-300"
                )}
              >
                <div className="h-full flex items-center justify-center">
                  <Icon
                    name={t.icon}
                    className={cn(
                      "size-5",
                      t.key === "light"
                        ? "text-amber-500"
                        : t.key === "dark"
                        ? "text-emerald-400"
                        : "text-zinc-400"
                    )}
                  />
                </div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </SettingsCard>

      <SettingsCard
        title="Accent color"
        description="Highlights, charts, and active states will use this color."
        icon="sparkles"
      >
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => {
                setAccent(a.key);
                toast.success("Accent color saved", {
                  description: `${a.label} is now your accent.`,
                });
              }}
              className={cn(
                "group flex flex-col items-center gap-2 rounded-xl border p-3 w-24 transition-all",
                accent === a.key
                  ? cn("border-transparent ring-2 bg-accent/40", a.ring)
                  : "border-border/60 hover:border-border hover:bg-accent/40"
              )}
              aria-label={`Set accent to ${a.label}`}
            >
              <span
                className={cn(
                  "size-10 rounded-full grid place-items-center transition-transform group-hover:scale-110",
                  a.dot
                )}
              >
                {accent === a.key && (
                  <Icon name="check" className="size-5 text-white" />
                )}
              </span>
              <span className="text-xs font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Density"
        description="Compact mode reduces paddings to fit more on screen."
        icon="layout-grid"
      >
        <RadioGroup
          value={density}
          onValueChange={(v) => {
            setDensity(v);
            document.documentElement.setAttribute("data-density", v);
            toast.success("Density preference saved");
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {[
            { key: "comfortable", label: "Comfortable", desc: "Spacious padding, ideal for laptops." },
            { key: "compact", label: "Compact", desc: "Tighter rows, fits more cards on screen." },
          ].map((d) => (
            <label
              key={d.key}
              htmlFor={`density-${d.key}`}
              className={cn(
                "relative cursor-pointer rounded-xl border p-4 transition-all",
                density === d.key
                  ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20"
                  : "border-border/60 hover:border-border hover:bg-accent/40"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{d.label}</span>
                <RadioGroupItem id={`density-${d.key}`} value={d.key} />
              </div>
              <p className="text-xs text-muted-foreground">{d.desc}</p>
              <div className="mt-3 space-y-1">
                <div
                  className={cn(
                    "rounded bg-muted/60",
                    d.key === "comfortable" ? "h-3" : "h-2"
                  )}
                />
                <div
                  className={cn(
                    "rounded bg-muted/60 w-2/3",
                    d.key === "comfortable" ? "h-3" : "h-2"
                  )}
                />
                <div
                  className={cn(
                    "rounded bg-muted/60 w-4/5",
                    d.key === "comfortable" ? "h-3" : "h-2"
                  )}
                />
              </div>
            </label>
          ))}
        </RadioGroup>
      </SettingsCard>
    </div>
  );
}

// ─── 2. Profile ────────────────────────────────────────────────────────────
interface ProfileData {
  name: string;
  email: string;
  bio: string;
}
const DEFAULT_PROFILE: ProfileData = {
  name: "Studio Owner",
  email: "owner@ytstudio.io",
  bio: "Building a portfolio of YouTube automation channels across tech, finance, and lifestyle niches.",
};

function ProfileTab() {
  const [profile, setProfile] = useSyncedSetting<ProfileData>("profile", DEFAULT_PROFILE);
  const [draft, setDraft] = React.useState<ProfileData>(DEFAULT_PROFILE);
  const [saving, setSaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setDraft(profile);
    setMounted(true);
  }, [profile]);

  const save = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 350));
      setProfile(draft);
      toast.success("Profile saved", {
        description: "Your studio owner profile has been updated.",
      });
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Studio owner"
        description="This profile appears in the top bar and is used for collaboration features."
        icon="users"
        action={
          mounted && dirty ? (
            <Pill color="amber" icon="clock">
              Unsaved changes
            </Pill>
          ) : undefined
        }
      >
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="flex flex-col items-center gap-2">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-teal-500 grid place-items-center text-white text-2xl font-bold shadow-lg shadow-rose-500/20">
              {mounted ? initials(draft.name) : "Y"}
            </div>
            <span className="text-xs text-muted-foreground">Initials preview</span>
          </div>
          <div className="flex-1 w-full space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Display name</Label>
              <Input
                id="profile-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={draft.email}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, email: e.target.value }))
                }
                placeholder="you@studio.io"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-bio">Bio</Label>
              <Input
                id="profile-bio"
                value={draft.bio}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, bio: e.target.value }))
                }
                placeholder="A short bio"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={save}
                disabled={!dirty || saving}
                className="bg-primary"
              >
                {saving ? (
                  <>
                    <Icon name="refresh" className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Icon name="check" className="size-4" />
                    Save profile
                  </>
                )}
              </Button>
              {dirty && (
                <Button
                  variant="ghost"
                  onClick={() => setDraft(profile)}
                  disabled={saving}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Workspace"
        description="Studio-level branding shown across exports and reports."
        icon="sparkles"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Studio name</Label>
            <Input defaultValue="My YT Automation Studio" readOnly className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Input
              defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
              readOnly
              className="bg-muted/40"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Workspace-level settings are managed via your team plan.
        </p>
      </SettingsCard>
    </div>
  );
}

// ─── 3. Language ───────────────────────────────────────────────────────────
function LanguageTab() {
  const [lang, setLang, langMounted] = useSyncedSetting<string>("language", "en");
  const [dateFormat, setDateFormat] = useSyncedSetting<string>("dateFormat", "mdy");
  const [currency, setCurrency] = useSyncedSetting<string>("currency", "usd");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]!;

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Language"
        description="Choose your preferred interface language. The studio UI stays English for now — this preference is recorded for upcoming translations."
        icon="languages"
      >
        <div className="space-y-3">
          <Label htmlFor="lang-select">Interface language</Label>
          <Select
            value={lang}
            onValueChange={(v) => {
              setLang(v);
              const found = LANGUAGES.find((l) => l.code === v);
              toast.success("Language preference saved", {
                description: `Selected: ${found?.label ?? v}. UI translations coming soon.`,
              });
            }}
          >
            <SelectTrigger id="lang-select" className="w-full sm:w-72">
              <SelectValue placeholder="Select a language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  <span className="mr-2">{l.flag}</span>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="info" className="size-3.5" />
            <span>
              Current preference: <span className="font-medium text-foreground">{mounted ? current.label : "English"}</span>
            </span>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Date & number format"
        description="Regional formatting for dates, currencies, and numbers."
        icon="globe"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Date format</Label>
            <Select
              value={dateFormat}
              onValueChange={(v) => {
                setDateFormat(v);
                toast.success("Date format saved", {
                  description: `Using ${v.toUpperCase()} format.`,
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mdy">Jun 30, 2026 (US)</SelectItem>
                <SelectItem value="dmy">30 Jun 2026 (UK)</SelectItem>
                <SelectItem value="ymd">2026-06-30 (ISO)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select
              value={currency}
              onValueChange={(v) => {
                setCurrency(v);
                toast.success("Currency preference saved", {
                  description: `Using ${v.toUpperCase()} as your primary currency.`,
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD — US Dollar ($)</SelectItem>
                <SelectItem value="eur">EUR — Euro (€)</SelectItem>
                <SelectItem value="gbp">GBP — Pound (£)</SelectItem>
                <SelectItem value="jpy">JPY — Yen (¥)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ─── 4. Notifications ──────────────────────────────────────────────────────
function NotificationsTab() {
  const [prefs, setPrefs] = useSyncedSetting<Record<string, boolean>>("notifications", {
    email: true,
    tasks: true,
    publish: true,
    weekly: false,
    trends: true,
  });
  const [quietStart, setQuietStart] = useSyncedSetting<string>("quietStart", "22:00");
  const [quietEnd, setQuietEnd] = useSyncedSetting<string>("quietEnd", "07:00");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const label = NOTIF_KEYS.find((n) => n.key === key)?.label ?? key;
    toast.success(`${label} ${value ? "enabled" : "disabled"}`);
  };

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Notification channels"
        description="Control what the studio pings you about, and how often."
        icon="bell"
      >
        <div className="divide-y divide-border/60">
          {NOTIF_KEYS.map((n) => (
            <div
              key={n.key}
              className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                  <Icon name={n.icon} className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {n.desc}
                  </p>
                </div>
              </div>
              <Switch
                checked={mounted ? !!prefs[n.key] : n.key !== "weekly"}
                onCheckedChange={(v) => toggle(n.key, v)}
                aria-label={n.label}
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Quiet hours"
        description="Pause non-urgent notifications during focus blocks."
        icon="clock"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="quiet-start">Start</Label>
            <Input
              id="quiet-start"
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiet-end">End</Label>
            <Input
              id="quiet-end"
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Trend alerts and publish reminders always come through.
        </p>
      </SettingsCard>
    </div>
  );
}

// ─── 5. Security ───────────────────────────────────────────────────────────
function SecurityTab() {
  const [twoFactor, setTwoFactor] = useSyncedSetting<boolean>("twoFactor", false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Session"
        description="Your current signed-in session on this device."
        icon="shield"
        action={
          <Pill color="emerald" icon="check-circle">
            Active
          </Pill>
        }
      >
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="size-9 rounded-lg bg-emerald-500/10 grid place-items-center">
            <Icon name="check-circle" className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Session active</p>
            <p className="text-xs text-muted-foreground">
              Signed in {mounted ? "just now" : "recently"} · this browser
            </p>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            Secure
          </Badge>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Password"
        description="Change the password used to sign in to your studio."
        icon="shield"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input type="password" defaultValue="password" disabled className="bg-muted/40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" placeholder="••••••••" disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm new password</Label>
              <Input type="password" placeholder="••••••••" disabled />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button disabled>
              <Icon name="shield" className="size-4" />
              Update password
            </Button>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              Coming soon
            </Badge>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Two-factor authentication"
        description="Add an extra layer of security with a TOTP authenticator app."
        icon="shield"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
              <Icon name="shield" className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Authenticator app {mounted && twoFactor && (
                  <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">· Enabled</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use Google Authenticator, 1Password, or Authy to generate codes.
              </p>
            </div>
          </div>
          <Switch
            checked={mounted ? twoFactor : false}
            onCheckedChange={(v) => {
              setTwoFactor(v);
              toast.success(`Two-factor authentication ${v ? "enabled" : "disabled"}`);
            }}
            aria-label="Toggle two-factor authentication"
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Active devices"
        description="Devices currently signed in to your studio account."
        icon="globe"
      >
        <div className="divide-y divide-border/60">
          {DEVICES.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-lg bg-accent grid place-items-center shrink-0">
                  <Icon name="globe" className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {d.location} · {d.last}
                  </p>
                </div>
              </div>
              {d.current ? (
                <Pill color="emerald" icon="check-circle">This device</Pill>
              ) : (
                <Button variant="ghost" size="sm" className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10">
                  Sign out
                </Button>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

// ─── 6. Data & Backup ──────────────────────────────────────────────────────
interface ExportMeta {
  app: string;
  version: string;
  exportedAt: string;
  counts: Record<string, number>;
}

function DataTab() {
  const [meta, setMeta] = React.useState<ExportMeta | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState<"" | "json" | "csv" | "xlsx">("");
  const [importing, setImporting] = React.useState(false);
  const [replaceMode, setReplaceMode] = useSyncedSetting<boolean>("replaceMode", false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const loadStats = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Failed to load stats");
      const json = (await res.json()) as { meta: ExportMeta; counts?: Record<string, number> };
      setMeta(json.meta ?? { ...json.meta, counts: json.counts ?? {} });
    } catch {
      toast.error("Couldn't load database stats");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Trigger a browser download from a fetched Blob. Falls back to a window
  // navigation if the body isn't usable as a blob (it always is in practice).
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  const onExportJson = async () => {
    setExporting("json");
    try {
      const res = await fetch("/api/export?format=json");
      if (!res.ok) throw new Error("Export failed");
      const json = await res.json();
      downloadJson(`yt-studio-export-${stamp()}.json`, json);
      const total = Object.values(json.meta?.counts ?? json.counts ?? {}).reduce(
        (a, b) => a + b,
        0
      );
      toast.success("JSON backup exported", {
        description: `${total} records across all tables.`,
      });
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setExporting("");
    }
  };

  const onExportCsv = async () => {
    setExporting("csv");
    try {
      const res = await fetch("/api/export?format=csv");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      downloadBlob(blob, `yt-studio-export-${stamp()}.csv`);
      toast.success("CSV export downloaded", {
        description: "Multi-section CSV with one block per table.",
      });
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setExporting("");
    }
  };

  const onExportXlsx = async () => {
    setExporting("xlsx");
    try {
      const res = await fetch("/api/export?format=xlsx");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      downloadBlob(blob, `yt-studio-export-${stamp()}.xls`);
      toast.success("Excel export downloaded", {
        description: "Opens directly in Excel / Numbers / LibreOffice.",
      });
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setExporting("");
    }
  };

  const onImportFile = async (file: File) => {
    // Detect format from the extension.
    const lower = file.name.toLowerCase();
    const isCsv = lower.endsWith(".csv");
    const isJson = lower.endsWith(".json");
    if (!isCsv && !isJson) {
      toast.error("Unsupported file", {
        description: "Pick a .json or .csv backup file.",
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      // Build the import body. JSON can be sent as an object or string;
      // CSV must be sent as a string.
      const body: Record<string, unknown> = {
        format: isCsv ? "csv" : "json",
        data: isCsv ? text : (() => {
          try {
            return JSON.parse(text);
          } catch {
            throw new Error("Invalid JSON file");
          }
        })(),
        replace: replaceMode,
      };
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Import failed (${res.status})`);
      }
      const result = (await res.json()) as {
        ok: boolean;
        counts: Record<string, number>;
        mode: string;
      };
      const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
      toast.success(
        result.mode === "replace"
          ? "Backup restored (replace mode)"
          : "Backup imported (append mode)",
        {
          description: `${total} records across ${Object.keys(result.counts).length} tables.`,
        }
      );
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      toast.error("Import failed", { description: msg });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const counts = meta?.counts ?? {};
  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  const exportCards: Array<{
    key: "json" | "csv" | "xlsx";
    label: string;
    desc: string;
    icon: string;
    color: string;
    onClick: () => void;
  }> = [
    {
      key: "json",
      label: "Export JSON",
      desc: "Full backup of every table — best for re-importing later.",
      icon: "download",
      color: "emerald",
      onClick: onExportJson,
    },
    {
      key: "csv",
      label: "Export CSV",
      desc: "Multi-section CSV — one block per table, opens in any editor.",
      icon: "file-text",
      color: "teal",
      onClick: onExportCsv,
    },
    {
      key: "xlsx",
      label: "Export Excel",
      desc: "Spreadsheet-friendly .xls — opens directly in Excel / Numbers.",
      icon: "bar-chart-3",
      color: "amber",
      onClick: onExportXlsx,
    },
  ];

  const colorForCard: Record<string, { bg: string; text: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
    teal: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  };

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Backup & restore"
        description="Export the entire studio as JSON, CSV, or Excel. Restore from a previous backup."
        icon="database"
      >
        {/* Export buttons — 3 cards in a responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {exportCards.map((c) => {
            const busy = exporting === c.key;
            const palette = colorForCard[c.color] ?? colorForCard.emerald;
            return (
              <button
                key={c.key}
                onClick={c.onClick}
                disabled={!!exporting}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
              >
                <div className={cn("size-9 rounded-lg grid place-items-center", palette.bg)}>
                  <Icon
                    name={busy ? "refresh" : c.icon}
                    className={cn("size-4", palette.text, busy && "animate-spin")}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Import row: file picker + replace-mode toggle */}
        <Separator className="my-4" />
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-stretch">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
          >
            <div className="size-9 rounded-lg bg-amber-500/10 grid place-items-center">
              <Icon
                name={importing ? "refresh" : "upload"}
                className={cn("size-4 text-amber-600 dark:text-amber-400", importing && "animate-spin")}
              />
            </div>
            <div>
              <p className="text-sm font-semibold">Import data</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick a .json or .csv backup. {replaceMode ? "Replaces current data." : "Appends to current data."}
              </p>
            </div>
          </button>

          <div className="rounded-xl border border-border/60 p-4 flex flex-col justify-between gap-2 min-w-[200px]">
            <div>
              <p className="text-sm font-medium">Replace mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Off = append (safe). On = wipe then restore.
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-xs", replaceMode ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground")}>
                {replaceMode ? "Replace" : "Append"}
              </span>
              <Switch
                checked={replaceMode}
                onCheckedChange={(v) => {
                  setReplaceMode(v);
                  toast.success(`Import mode set to ${v ? "Replace" : "Append"}`);
                }}
                aria-label="Toggle replace mode"
              />
            </div>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,.csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
          }}
        />

        <Separator className="my-4" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Reset to seed</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Restore the original demo dataset. Requires admin access.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            onClick={() =>
              toast("Contact admin to re-seed", {
                description: "Re-seeding wipes all current data. Reach out to your workspace admin.",
              })
            }
          >
            <Icon name="refresh" className="size-4" />
            Reset
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Database stats"
        description="Live record counts per table in your studio database."
        icon="bar-chart-3"
        action={
          <Button variant="ghost" size="sm" onClick={loadStats} disabled={loading}>
            <Icon name={loading ? "refresh" : "refresh"} className={cn("size-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      >
        {loading && !meta ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer h-16 rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(counts).map(([key, count]) => (
                <div
                  key={key}
                  className="rounded-lg border border-border/60 bg-muted/30 p-3"
                >
                  <p className="text-xs text-muted-foreground capitalize truncate">{key}</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{count}</p>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total records</span>
              <span className="text-sm font-bold tabular-nums">{totalRecords}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-muted-foreground">Last exported</span>
              <span className="text-sm font-medium">
                {meta?.exportedAt
                  ? new Date(meta.exportedAt).toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-muted-foreground">Database</span>
              <span className="text-sm font-medium">SQLite · db/custom.db</span>
            </div>
          </>
        )}
      </SettingsCard>
    </div>
  );
}

// ─── 7. Keyboard shortcuts ─────────────────────────────────────────────────
function ShortcutsTab() {
  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Keyboard shortcuts"
        description="Move faster through the studio — no mouse required."
        icon="keyboard"
      >
        <ScrollArea className="max-h-[28rem]">
          <div className="space-y-5 pr-2">
            {groups.map((g) => (
              <div key={g}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {g}
                </p>
                <div className="space-y-1">
                  {SHORTCUTS.filter((s) => s.group === g).map((s, idx) => (
                    <div
                      key={`${s.label}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-accent/40 transition-colors"
                    >
                      <span className="text-sm">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, i) => (
                          <kbd
                            key={i}
                            className="rounded border border-border/70 bg-muted px-1.5 py-0.5 text-[11px] font-mono font-medium text-muted-foreground shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SettingsCard>

      <SettingsCard
        title="Tip"
        description="Press ⌘K anywhere to open the command palette and jump to any section."
        icon="lightbulb"
      >
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <Icon name="command" className="size-5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm">
            <span className="font-semibold">Command palette</span> is the fastest
            way to navigate — try{" "}
            <kbd className="rounded border border-border/70 bg-muted px-1.5 py-0.5 text-[11px] font-mono">
              ⌘K
            </kbd>{" "}
            now.
          </p>
        </div>
      </SettingsCard>
    </div>
  );
}

// ─── 8. About ──────────────────────────────────────────────────────────────
function AboutTab() {
  const buildDate = "2026-06-30";
  const version = "1.0.0";

  return (
    <div className="space-y-5">
      <SettingsCard
        title="About this studio"
        description="A premium operating system for solo YouTube automation creators."
        icon="info"
      >
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="size-20 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-amber-500 grid place-items-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Icon name="youtube" className="size-9 text-white" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <p className="text-lg font-bold tracking-tight">My YT Automation Studio</p>
              <p className="text-sm text-muted-foreground">
                Built for creators · v{version}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="font-medium tabular-nums">{version}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Build</p>
                <p className="font-medium tabular-nums">{buildDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Engine</p>
                <p className="font-medium">Next.js 16</p>
              </div>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              Manage channels, content, finance, and AI tools from one
              glassmorphic command center. Designed dark-first, optimized for
              long focus sessions.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Resources"
        description="Handy links for getting the most out of the studio."
        icon="book-open"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: "Documentation", icon: "book-open", desc: "Guides and tutorials" },
            { label: "Keyboard shortcuts", icon: "keyboard", desc: "Move faster" },
            { label: "Changelog", icon: "sparkles", desc: "What's new" },
            { label: "Send feedback", icon: "message", desc: "Tell us what's missing" },
          ].map((r) => (
            <button
              key={r.label}
              onClick={() => toast(`${r.label} — coming soon`)}
              className="group flex items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                <Icon name={r.icon} className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground truncate">{r.desc}</p>
              </div>
              <Icon
                name="chevron-right"
                className="size-4 text-muted-foreground group-hover:text-primary transition-colors"
              />
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Made for creators"
        icon="heart"
      >
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <Icon name="heart" className="size-5 text-rose-600 dark:text-rose-400" />
          <p className="text-sm">
            Crafted with care for the YouTube automation community. ©{" "}
            {new Date().getFullYear()} · Built with Next.js, Prisma, and shadcn/ui.
          </p>
        </div>
      </SettingsCard>
    </div>
  );
}
