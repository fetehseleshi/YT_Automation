"use client";

import { create } from "zustand";
import type { SectionId } from "./types";

interface UIState {
  // navigation
  section: SectionId;
  setSection: (s: SectionId) => void;

  // command palette
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;

  // sidebar (mobile)
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  // focus mode
  focusMode: boolean;
  toggleFocusMode: () => void;

  // global quick add
  quickAddOpen: boolean;
  setQuickAddOpen: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  section: "dashboard",
  setSection: (section) => set({ section, sidebarOpen: false }),

  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  focusMode: false,
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  quickAddOpen: false,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
}));
