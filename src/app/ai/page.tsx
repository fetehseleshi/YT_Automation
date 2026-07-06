"use client";

import * as React from "react";
import { useUI } from "@/lib/store";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { AISection } from "@/components/sections/ai-assistant";

export default function AIPage() {
  const { setSection } = useUI();

  React.useEffect(() => {
    setSection("ai");
  }, [setSection]);

  return (
    <div className="min-h-screen flex flex-col">
      <Sidebar />
      <Topbar />
      <main className="flex-1 w-full px-3 lg:pl-[264px] pt-4 pb-6">
        <div className="max-w-[1400px] mx-auto">
          <AISection />
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
