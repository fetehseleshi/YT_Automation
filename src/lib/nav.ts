import type { NavItem } from "./types";

export const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", group: "Overview" },
      { id: "analytics", label: "Analytics", icon: "bar-chart-3", group: "Overview" },
    ],
  },
  {
    group: "Content",
    items: [
      { id: "channels", label: "Channels", icon: "youtube", group: "Content" },
      { id: "planner", label: "Content Planner", icon: "kanban-square", group: "Content" },
      { id: "videos", label: "Video Database", icon: "film", group: "Content" },
      { id: "calendar", label: "Calendar", icon: "calendar-days", group: "Content" },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { id: "ai", label: "AI Assistant", icon: "sparkles", group: "Intelligence", badge: "AI" },
      { id: "research", label: "Trend Research", icon: "trending-up", group: "Intelligence" },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "tasks", label: "Tasks", icon: "check-square", group: "Operations" },
      { id: "team", label: "Team", icon: "users", group: "Operations" },
      { id: "files", label: "File Library", icon: "folder-open", group: "Operations" },
      { id: "automation", label: "Automation", icon: "workflow", group: "Operations" },
    ],
  },
  {
    group: "Business",
    items: [
      { id: "finance", label: "Finance", icon: "wallet", group: "Business" },
      { id: "goals", label: "Goals", icon: "target", group: "Business" },
    ],
  },
  {
    group: "Workspace",
    items: [
      { id: "extras", label: "Extras", icon: "layout-grid", group: "Workspace" },
      { id: "settings", label: "Settings", icon: "settings", group: "Workspace" },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
