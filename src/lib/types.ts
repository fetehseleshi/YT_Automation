export type SectionId =
  | "dashboard"
  | "channels"
  | "planner"
  | "videos"
  | "ai"
  | "research"
  | "calendar"
  | "tasks"
  | "team"
  | "files"
  | "finance"
  | "goals"
  | "analytics"
  | "automation"
  | "settings"
  | "extras";

export interface NavItem {
  id: SectionId;
  label: string;
  icon: string; // lucide icon name
  group: string;
  badge?: string;
}
