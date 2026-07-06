# Task 8-c — Calendar Section Builder

**Agent:** Content Calendar Section Builder
**Task:** Build the CONTENT CALENDAR section (`CalendarSection`) + `/api/calendar` route.

## Work Log

- Read `/home/z/my-project/worklog.md` (Tasks 1-6, 7-a, 7-b, 7-c, 7-d) to inherit foundation conventions: dark-first glassmorphism, emerald/amber/rose/teal/orange palette (no blue/indigo), shared helpers (`SectionHeader`, `StatCard`, `Pill`, `EmptyState`, `Progress`, `Icon`, `api`), `db` from `@/lib/db`, Next 16 `NextRequest`/`NextResponse` conventions, async-free GET routes.
- Inspected: `prisma/schema.prisma` (Card.stage incl. `scheduled`/`published`, Card.dueDate, Task.dueDate, Video.publishDate), `prisma/seed.ts` (cards indexed 7=scheduled/null dueDate, 8=published/daysAhead(10); videos publishDate daysAgo; tasks dueDate daysAhead 0-7), `src/components/ui/checkbox.tsx`, `scroll-area.tsx`, `src/components/shared/ui.tsx`, `src/lib/api.ts`, `src/lib/utils.ts`, `src/components/icon.tsx`.
- Created `src/app/api/calendar/route.ts` (GET only):
  - Accepts `?month=YYYY-MM` query (validated via `/^(\d{4})-(\d{2})$/` regex); defaults to current UTC month on absence/malformed.
  - Computes `start = new Date(year, monthIdx, 1)` and `endExclusive = new Date(year, monthIdx + 1, 1)`.
  - Three parallel Prisma queries via `Promise.all`:
    - Cards where `stage in ["scheduled","published"]` AND `dueDate: { gte: start, lt: endExclusive }` → select id/title/dueDate/stage/priority.
    - Videos where `publishDate: { gte, lt }` → select id/title/publishDate.
    - Tasks where `dueDate: { gte, lt }` → select id/title/dueDate/priority.
  - Builds a flat `events[]` array with discriminator-prefixed ids (`card:`, `video:`, `task:`) to prevent collisions, ISO date strings, `type` ∈ `scheduled|published|task`, `source` ∈ `content|video|task`, optional `priority`.
  - Returns `{ events, scheduledCount, publishedCount, taskCount }`. `scheduledCount` = cards with stage "scheduled"; `publishedCount` = cards with stage "published" + videos; `taskCount` = tasks. Skips null dates defensively.
  - Try/catch → 500 with error message on failure.
- Created `src/components/sections/calendar.tsx` (named export `CalendarSection`, `"use client"`):
  - **SectionHeader** — title "Content Calendar", description "Schedule and visualize your publishing pipeline", icon "calendar-days". Actions: glass pill month navigator (‹ / `MMMM yyyy` label / › — using `addMonths` from date-fns) + outline "Today" button (sets both month and selected date to today).
  - **Summary strip** — 3 `StatCard`s: Scheduled (teal/clock), Published (emerald/check-circle), Tasks Due (amber/list-checks). Each with hint + staggered delay (0 / 0.05 / 0.1).
  - **Legend** — small color key (teal/emerald/amber dots) with a "Today" ring sample, hidden on xs.
  - **Calendar grid** (custom, NOT shadcn Calendar): `grid-cols-7` of weekday headers (Sun-Sat uppercase tracking-wider) + 6×7 day-cell grid built with `eachDayOfInterval({ start: startOfWeek(startOfMonth(m)), end: endOfWeek(endOfMonth(m)) })`. Each cell is a `motion.button`:
    - Day number as a circle, emerald-filled when today.
    - `ring-2 ring-emerald-500/60` on today; `ring-2 ring-primary/40` on selected (non-today).
    - Out-of-month days dimmed to `opacity-40`, hover restores to 70.
    - Up to 3 event chips per cell, each a colored pill (teal/emerald/amber by type) with leading dot + truncated title (`title` attr for full text). "+N more" overflow indicator when more events exist.
    - Small event count badge in the top-right corner of each cell.
    - Staggered entrance (opacity+scale, delay by index capped at 0.18s).
    - `aria-label` includes weekday, date, and event count for screen readers.
  - **Selected day panel** (right column, glass Card with primary blur): shows weekday name + date, or "No day selected" prompt. `AnimatePresence` swaps content when selection changes. Lists all events for the day via `ScrollArea` (max-h-80), each with type `Pill`, source `Badge`, priority `Badge`, and `h:mm a` time stamp. Empty-day state shows a "perfect for deep work" hint.
  - **Publishing checklist** (glass Card with amber→emerald blur that shifts color when complete): 8 hardcoded items (Thumbnail created / Script finalized / Voice over recorded / Video edited / SEO optimized / End screen added / Cards added / Scheduled on YouTube), each with an icon, a `Checkbox`, and a strikethrough when checked. `Progress` bar shows completion %, color shifts amber→emerald on completion. "X/8 done" header + dynamic status text ("All set — ready to publish! 🎉" vs "N steps remaining"). "Reset" button clears all and toasts. State persisted to `localStorage` under key `publish-checklist` via a single `updateChecklist` callback.
  - **Mobile agenda** (`md:hidden` glass Card): when viewport is too narrow for the grid, shows a vertical agenda — events grouped by day (`YYYY-MM-DD`), sorted ascending, each group with a left border accent and `format(parseISO(k), "EEE, MMM d")` header. Each row shows dot + title + type Pill + source label + time. `ScrollArea` with `max-h-[28rem]`. Falls back to `EmptyState` if month has no events.
  - **State & data flow**: `currentMonth` Date (default `new Date()`), `data: CalendarResponse | null`, `loading`, `selectedDate: Date | null`, `checklist: Record<string, boolean>`. `useEffect` on `monthKey = format(currentMonth, "yyyy-MM")` triggers `api<CalendarResponse>('/api/calendar?month=' + monthKey)` with cancellation flag to avoid race conditions. Toast on fetch error. Checklist loaded once from localStorage on mount; persisted on every toggle.
  - **Memoization**: `eventsByDay` Map (YYYY-MM-DD → CalendarEvent[]) rebuilt only when `data` changes; `days` array rebuilt only when `currentMonth` changes.
- Palette discipline: ONLY teal/emerald/amber + muted neutral — no blue, no indigo, no violet. All chips, dots, rings, progress bars, blurs use the approved palette.
- Responsive: mobile-first. Single column on xs, summary stack at `sm`, calendar+side grid at `lg:grid-cols-3`, agenda takes over below `md`.
- Accessibility: semantic `<button>` cells with aria-labels, `<label>` wrapping each checkbox row, `sr-only`-friendly structure via Pill/Badge text, keyboard-focusable controls (`focus-visible:ring-2`).

## Verification

- `bun run lint` — passes with zero errors/warnings.
- `curl http://localhost:3000/api/calendar` → 200, returns `{events:[...], scheduledCount:0, publishedCount:16, taskCount:2}` for current month (June 2026).
- `curl http://localhost:3000/api/calendar?month=2026-07` → 200, returns 7 events (1 published card from content + 6 tasks) — confirms month filtering works across month boundaries.
- Dev log shows clean compiles, `GET /api/calendar 200 in 144ms`, `GET / 200` consistently.
- Did NOT edit any shared files (globals.css, page.tsx, layout.tsx, store.ts, api.ts, types.ts, nav.ts, icon.tsx, ui.tsx, lib/utils.ts). Only created the 2 specified files.

## Stage Summary

- Content Calendar section is complete and production-ready.
- `/api/calendar?month=YYYY-MM` returns a flat events list + 3 summary counts in a single ~10ms call (warm).
- `CalendarSection` is a dark-first, glassmorphic monthly calendar with: month navigation + Today button, 3 StatCards, custom 6×7 day grid (today ring, out-of-month dimming, max-3 chips per cell with "+N more" overflow, color-coded by type), selected-day detail panel with type/source/priority pills + timestamps, an 8-item publishing checklist persisted to localStorage with progress bar + reset, and a mobile-only agenda view that takes over below `md`.
- Palette stays within emerald/teal/amber (NO blue/indigo) per design system.
- Files created:
  - `src/app/api/calendar/route.ts` (new)
  - `src/components/sections/calendar.tsx` (overwrote stub)
- Ready for orchestrator to wire into the section switcher (already imported as `CalendarSection` in page.tsx).
