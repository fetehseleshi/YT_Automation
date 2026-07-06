"use client";

import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Icon } from "@/components/icon";
import { useUI } from "@/lib/store";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { useTheme } from "next-themes";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  section: string;
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setSection } = useUI();
  const { setTheme } = useTheme();
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  // Reset query when palette closes
  React.useEffect(() => {
    if (!commandOpen) {
      setQ("");
      setResults([]);
    }
  }, [commandOpen]);

  // Debounced global search
  React.useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        /* ignore */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (section: any) => {
    setSection(section);
    setCommandOpen(false);
  };

  return (
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
      <DialogHeader className="sr-only">
        <DialogTitle>Command Palette</DialogTitle>
        <DialogDescription>Search or run a command</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 max-w-xl">
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          <CommandInput placeholder="Search or type a command…" value={q} onValueChange={setQ} />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No results found.</CommandEmpty>

            {results.length > 0 && (
              <CommandGroup heading="Search results">
                {results.slice(0, 6).map((r) => (
                  <CommandItem
                    key={r.id}
                    onSelect={() => go(r.section)}
                    className="gap-2"
                  >
                    <Icon name={iconForType(r.type)} className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                    </div>
                    <span className="text-[10px] uppercase text-muted-foreground">{r.type}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Navigation">
              {ALL_NAV_ITEMS.map((item) => (
                <CommandItem key={item.id} onSelect={() => go(item.id)} className="gap-2">
                  <Icon name={item.icon} className="size-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  setTheme("dark");
                  setCommandOpen(false);
                  toast.success("Dark mode enabled");
                }}
                className="gap-2"
              >
                <Icon name="moon" className="size-4 text-muted-foreground" />
                <span>Switch to dark mode</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setTheme("light");
                  setCommandOpen(false);
                  toast.success("Light mode enabled");
                }}
                className="gap-2"
              >
                <Icon name="sun" className="size-4 text-muted-foreground" />
                <span>Switch to light mode</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  useUI.getState().toggleFocusMode();
                  setCommandOpen(false);
                }}
                className="gap-2"
              >
                <Icon name="brain" className="size-4 text-muted-foreground" />
                <span>Toggle focus mode</span>
              </CommandItem>
              <CommandItem onSelect={() => go("ai")} className="gap-2">
                <Icon name="sparkles" className="size-4 text-muted-foreground" />
                <span>Open AI Assistant</span>
              </CommandItem>
              <CommandItem onSelect={() => go("planner")} className="gap-2">
                <Icon name="plus" className="size-4 text-muted-foreground" />
                <span>New content idea</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading="Tips">
              <div className="px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-2"><kbd className="rounded border bg-muted px-1">↑↓</kbd> Navigate</p>
                <p className="flex items-center gap-2"><kbd className="rounded border bg-muted px-1">↵</kbd> Select</p>
                <p className="flex items-center gap-2"><kbd className="rounded border bg-muted px-1">esc</kbd> Close</p>
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function iconForType(type: string): string {
  switch (type) {
    case "Channel": return "youtube";
    case "Video": return "film";
    case "Task": return "check-square";
    case "Trend": return "trending-up";
    default: return "circle";
  }
}
