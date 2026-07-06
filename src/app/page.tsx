"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { useUI } from "@/lib/store";

import { DashboardSection } from "@/components/sections/dashboard";
import { ChannelsSection } from "@/components/sections/channels";
import { PlannerSection } from "@/components/sections/planner";
import { VideosSection } from "@/components/sections/videos";
import { AISection } from "@/components/sections/ai-assistant";
import { ResearchSection } from "@/components/sections/research";
import { CalendarSection } from "@/components/sections/calendar";
import { TasksSection } from "@/components/sections/tasks";
import { TeamSection } from "@/components/sections/team";
import { FilesSection } from "@/components/sections/files";
import { FinanceSection } from "@/components/sections/finance";
import { GoalsSection } from "@/components/sections/goals";
import { AnalyticsSection } from "@/components/sections/analytics";
import { AutomationSection } from "@/components/sections/automation";
import { SettingsSection } from "@/components/sections/settings";
import { ExtrasSection } from "@/components/sections/extras";

const SECTIONS: Record<string, React.ComponentType> = {
  dashboard: DashboardSection,
  channels: ChannelsSection,
  planner: PlannerSection,
  videos: VideosSection,
  ai: AISection,
  research: ResearchSection,
  calendar: CalendarSection,
  tasks: TasksSection,
  team: TeamSection,
  files: FilesSection,
  finance: FinanceSection,
  goals: GoalsSection,
  analytics: AnalyticsSection,
  automation: AutomationSection,
  settings: SettingsSection,
  extras: ExtrasSection,
};

export default function Home() {
  const { section, focusMode } = useUI();
  const [mounted, setMounted] = React.useState(false);

  // Hard stop layout loop guard
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // While rendering on server or before client settles, show a clean, static structural skeleton
  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 w-full px-3 lg:pl-[264px] pt-4 pb-6 max-w-[1400px] mx-auto animate-pulse">
          <div className="h-12 bg-muted rounded-xl mb-4 w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const Section = SECTIONS[section] ?? DashboardSection;

  return (
    <div className={`min-h-screen flex flex-col ${focusMode ? "focus-mode no-scrollbar" : ""}`}>
      <div className={focusMode ? "" : "aurora"} aria-hidden />

      <Sidebar />
      <Topbar />

      <main className={`flex-1 w-full px-3 lg:pl-[264px] pt-4 pb-6 ${focusMode ? "lg:pl-0" : ""}`}>
        <div className={`max-w-[1400px] mx-auto ${focusMode ? "px-6" : ""}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <SectionErrorBoundary name={section}>
                <Section />
              </SectionErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Footer />
      <CommandPalette />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto px-3 lg:pl-[264px] pb-3">
      <div className="glass rounded-2xl border border-border/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>YT Automation Studio · v1.0</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Built for creators</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">⌘K</kbd> Command
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">G</kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">D</kbd> Dashboard
          </span>
          <span suppressHydrationWarning>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}