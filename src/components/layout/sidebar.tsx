"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icon";
import { useUI } from "@/lib/store";
import { NAV_GROUPS } from "@/lib/nav";
import type { SectionId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const { section, setSection, sidebarOpen, setSidebarOpen, focusMode } = useUI();
  const { theme, setTheme } = useTheme();

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile floating sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed left-3 top-3 bottom-3 z-50 w-[270px] lg:hidden"
          >
            <SidebarContent
              section={section}
              setSection={setSection}
              theme={theme}
              setTheme={setTheme}
              onClose={() => setSidebarOpen(false)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop floating sidebar */}
      <aside className={cn("hidden lg:flex fixed left-3 top-3 bottom-3 z-30 w-[248px] flex-col", focusMode && "focus-dim")}>
        <SidebarContent
          section={section}
          setSection={setSection}
          theme={theme}
          setTheme={setTheme}
        />
      </aside>
    </>
  );
}

function SidebarContent({
  section,
  setSection,
  theme,
  setTheme,
  onClose,
}: {
  section: SectionId;
  setSection: (s: SectionId) => void;
  theme?: string;
  setTheme?: (t: string) => void;
  onClose?: () => void;
}) {
  return (
    <div className="glass-strong rounded-2xl border border-border/60 shadow-xl flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border/50 shrink-0">
        <div className="relative size-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 grid place-items-center shadow-lg shadow-emerald-500/30">
          <Icon name="youtube" className="size-5 text-white" />
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-amber-400 ring-2 ring-card" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">YT Studio</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Automation OS</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="size-8 lg:hidden" onClick={onClose}>
            <Icon name="x" className="size-4" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2.5 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.group}>
            <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.group}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "group relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all",
                      active
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-primary/90 shadow-md shadow-primary/20"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon
                      name={item.icon}
                      className={cn(
                        "size-4 shrink-0 relative z-10",
                        !active && "group-hover:scale-110 transition-transform"
                      )}
                    />
                    <span className="relative z-10 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "relative z-10 ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / status card */}
      <div className="p-2.5 border-t border-border/50 shrink-0">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 via-amber-500/5 to-rose-500/10 border border-border/50 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="rocket" className="size-4 text-emerald-500" />
            <p className="text-xs font-semibold">Studio Pro</p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug mb-2">
            All systems operational. 4 channels connected.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Live sync active</span>
          </div>
        </div>
        <button
          onClick={() => setTheme && setTheme(theme === "dark" ? "light" : "dark")}
          className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} className="size-4" />
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </div>
  );
}
