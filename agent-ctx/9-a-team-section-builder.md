# Task 9-a — Team Section Builder

## Task
Build the TEAM section (`TeamSection`) + REST API at `/api/team` for the YT Automation Studio.

## Files Created (only these 3 — no shared files edited)
- `src/app/api/team/route.ts` — GET (members + totalTasks/openTasks), POST (create)
- `src/app/api/team/[id]/route.ts` — PATCH (partial update), DELETE (auto-unassigns tasks via onDelete:SetNull)
- `src/components/sections/team.tsx` — `TeamSection` named export, `"use client"`

## Key Implementation Details
- **Role → icon/color mapping**: Script Writer=file-text/emerald, Editor=film/amber, Voice Artist=message/rose, Thumbnail Designer=image/teal, SEO=trending-up/orange, Manager=users/emerald. Per-role gradient for avatar fallback (e.g. `from-emerald-500 to-teal-600`).
- **Mail icon**: not in shared `Icon` registry — imported directly from `lucide-react` in the component (does not touch shared files).
- **GET /api/team**: uses `_count.tasks` + a separate `tasks` query with `where: { status: { not: "done" } }` to compute `totalTasks` and `openTasks`. Ordered by `[{status: asc}, {createdAt: desc}]`.
- **Frontend**: SectionHeader with "Invite Member" action, 4 StatCards (Total/Active/Roles/Avg Rate), role filter chips with counts, responsive 1/2/3-col member grid with Avatar (gradient initials fallback), role Pill, status pill, mailto email, skills tags, Open/Total task stats + Progress bar, rate (formatMoney/hr), edit/delete DropdownMenu (hover-reveal), create/edit Dialog (name/role/status/email/avatarUrl/rate/skills/notes), AlertDialog delete confirmation, shimmer skeletons, EmptyState.
- **State**: members, loading, roleFilter, dialogOpen, editing, form, saving, deletingId. `load()` GETs `/api/team`.

## Verification
- `bun run lint` → zero errors/warnings.
- `GET /api/team` → 200, 5 seeded members each with `totalTasks:0, openTasks:0`.
- `POST` (full body) → 201; missing name → 400.
- `PATCH` (role/rate/status/notes) → 200 updated; empty name → 400.
- `DELETE` → 200 `{ok:true}`; second → 404.
- Task-count integration: assigned a todo task to Alex Rivera → `total=1 open=1`; marked done → `total=1 open=0`; reset to restore seed state.
- Dev log clean: `GET /api/team 200 in 8ms`, `GET / 200`.

## Notes for Downstream Agents
- `/api/team` is now available — `TasksSection` already loads it (was previously 404ing gracefully). Member objects include `totalTasks` and `openTasks` fields useful for any team-aware UI.
- `onDelete: SetNull` on `Task.assignee` means deleting a TeamMember automatically nulls `assigneeId` on their tasks — no manual cleanup required.
- Palette discipline maintained: emerald/amber/rose/teal/orange only (NO blue/indigo).
