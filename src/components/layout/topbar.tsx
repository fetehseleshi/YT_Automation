"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { signOut, useSession } from "next-auth/react";
import { Icon } from "@/components/icon";
import { useUI } from "@/lib/store";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { cn, colorFor } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/use-notifications";
import { relativeTime } from "@/lib/api";
import type { SectionId } from "@/lib/types";

const NOTIF_ICON: Record<string, { icon: string; color: string }> = {
  success: { icon: "check-circle", color: "emerald" },
  warning: { icon: "alert-triangle", color: "amber" },
  error: { icon: "alert-triangle", color: "rose" },
  info: { icon: "info", color: "teal" },
};

// Valid section ids we can safely navigate to.
const VALID_SECTIONS = new Set<string>(ALL_NAV_ITEMS.map((i) => i.id));

export function Topbar() {
  const { setCommandOpen, setSidebarOpen, section, focusMode, toggleFocusMode } = useUI();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = ALL_NAV_ITEMS.find((i) => i.id === section);

  return (
    <TooltipProvider delayDuration={300}>
      <header className={cn("sticky top-0 z-20 px-3 lg:pl-[264px] pt-3", focusMode && "focus-dim")}>
        <div className="glass rounded-2xl border border-border/60 shadow-sm flex items-center gap-2 px-3 h-14">
          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon"
            className="size-9 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" className="size-5" />
          </Button>

          {/* Section title */}
          <div className="flex items-center gap-2 min-w-0">
            {current && <Icon name={current.icon} className="size-4 text-primary shrink-0" />}
            <h1 className="text-sm font-semibold truncate hidden sm:block">
              {current?.label ?? "Dashboard"}
            </h1>
          </div>

          {/* Search trigger */}
          <button
            onClick={() => setCommandOpen(true)}
            className="group ml-2 flex-1 max-w-md flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 hover:bg-accent/50 px-3 h-9 text-sm text-muted-foreground transition-colors"
          >
            <Icon name="search" className="size-4 shrink-0" />
            <span className="flex-1 text-left truncate">Search or jump to…</span>
            <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            {/* Quick add */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => useUI.getState().setSection("tasks")}
                  aria-label="Quick add"
                >
                  <Icon name="plus" className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Quick add</TooltipContent>
            </Tooltip>

            {/* Focus mode */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("size-9 focus-mode-toggle", focusMode && "text-primary bg-primary/10")}
                  onClick={toggleFocusMode}
                  aria-label="Focus mode"
                  data-focus-button
                >
                  <Icon name="brain" className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{focusMode ? "Exit focus mode" : "Focus mode"}</TooltipContent>
            </Tooltip>

            {/* Notifications */}
            <NotificationsBell />

            {/* Theme toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                >
                  {mounted && (
                    <motion.span
                      key={theme}
                      initial={{ rotate: -30, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Icon name={theme === "dark" ? "sun" : "moon"} className="size-5" />
                    </motion.span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>

            {/* Profile + account menu */}
            <ProfileMenu />
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

// ─── Notifications bell with Popover dropdown ─────────────────────────────────
function NotificationsBell() {
  const { setSection } = useUI();
  const {
    notifications,
    unread,
    loading,
    refresh,
    markAllRead,
    markRead,
    clearAll,
  } = useNotifications();
  const [open, setOpen] = React.useState(false);

  // Fetch on open.
  React.useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Poll every 60s while open.
  React.useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [open, refresh]);

  const handleClick = async (n: (typeof notifications)[number]) => {
    if (!n.read) {
      await markRead(n.id);
    }
    setOpen(false);
    if (n.section && VALID_SECTIONS.has(n.section)) {
      setSection(n.section as SectionId);
    } else if (n.section) {
      toast(`Notification: ${n.title}`, {
        description: `Section "${n.section}" not navigable`,
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAll();
      toast.success("Notifications cleared");
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 relative"
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
            >
              <Icon name="bell" className="size-5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-card tabular-nums">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-1.5rem)] p-0 glass-strong border-border/60"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6 rounded-md bg-primary/10 grid place-items-center shrink-0">
              <Icon name="bell" className="size-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Notifications</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleMarkAllRead}
              disabled={unread === 0 || loading}
            >
              <Icon name="check" className="size-3.5 mr-1" />
              Mark all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-rose-500 hover:text-rose-500 hover:bg-rose-500/10"
              onClick={handleClearAll}
              disabled={notifications.length === 0 || loading}
            >
              <Icon name="trash" className="size-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* List */}
        {loading && notifications.length === 0 ? (
          <div className="px-3 py-6 grid place-items-center">
            <div className="size-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="size-10 rounded-xl bg-emerald-500/10 grid place-items-center mx-auto mb-3">
              <Icon name="check-circle" className="size-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground mt-1">
              New notifications will appear here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="divide-y divide-border/40">
              {notifications.map((n) => {
                const cfg = NOTIF_ICON[n.type] ?? NOTIF_ICON.info;
                const c = colorFor(cfg.color);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50 relative",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    {/* Unread dot */}
                    {!n.read && (
                      <span className="absolute top-3 right-2.5 size-1.5 rounded-full bg-rose-500 shrink-0" />
                    )}
                    <div
                      className={cn(
                        "size-7 rounded-lg grid place-items-center shrink-0 mt-0.5",
                        c.soft,
                      )}
                    >
                      <Icon name={cfg.icon} className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs font-semibold truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                        {relativeTime(n.createdAt)}
                        {n.section && (
                          <>
                            <span aria-hidden> · </span>
                            <span className="capitalize">{n.section}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="border-t border-border/60 px-3 py-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setOpen(false);
              setSection("analytics");
            }}
          >
            <Icon name="bar-chart-3" className="size-3.5 mr-1" />
            View all
          </Button>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {notifications.length} total
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Profile menu with account info + logout ──────────────────────────────────
function ProfileMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);
  const [emailVerified, setEmailVerified] = React.useState<boolean | null>(null);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => setEmailVerified(!!d.user?.emailVerified))
      .catch(() => setEmailVerified(false));
  }, [open]);

  async function resendVerify() {
    setSending(true);
    try {
      const res: any = await api("/api/auth/resend-verification", { method: "POST" });
      if (res.alreadyVerified) {
        toast.success("Your email is already verified.");
        setEmailVerified(true);
      } else if (res.verifyLink) {
        toast.success("Verification link ready — opening.");
        window.open(res.verifyLink, "_blank");
      } else {
        toast.success("Verification email sent.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to resend");
    } finally {
      setSending(false);
    }
  }

  function logout() {
    signOut({ callbackUrl: "/" });
  }

  const name = session?.user?.name || "You";
  const email = session?.user?.email || "";
  const initial = name.charAt(0).toUpperCase() || "Y";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="ml-1 flex items-center gap-2 rounded-full pl-1 pr-3 h-9 hover:bg-accent/60 transition-colors">
          <div className="size-7 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 grid place-items-center text-white text-xs font-bold shadow">
            {initial}
          </div>
          <span className="hidden md:block text-xs font-medium max-w-[80px] truncate">{name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="p-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 grid place-items-center text-white text-sm font-bold shadow">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
          </div>
          {emailVerified === false && (
            <div className="mt-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 p-2">
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-1.5">Email not verified</p>
              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={resendVerify} disabled={sending}>
                {sending ? "Sending…" : "Send verification link"}
              </Button>
            </div>
          )}
        </div>
        <div className="p-1.5">
          <button
            onClick={() => { setOpen(false); useUI.getState().setSection("settings"); }}
            className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-accent/60 transition-colors"
          >
            <Icon name="settings" className="size-4 text-muted-foreground" /> Settings
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Icon name="x" className="size-4" /> Sign out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
