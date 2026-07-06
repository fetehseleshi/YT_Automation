import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_COLORS = ["emerald", "amber", "rose", "teal", "orange"];

/** Format a Date as `yyyy-mm-dd` (local-time, no timezone shift). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Compute the current streak (consecutive days up to today).
 * If today is already logged, the streak includes today.
 * If today is not yet logged but yesterday was, the streak still counts
 * through yesterday (today isn't over yet).
 */
function computeStreak(historySet: Set<string>, today = new Date()): number {
  let streak = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!historySet.has(toISODate(cursor))) {
    // Today not done yet — start counting from yesterday without breaking.
    cursor.setDate(cursor.getDate() - 1);
  }
  while (historySet.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** PATCH /api/habits/[id] — partial update or `toggleToday`. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.habit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Habit not found" },
        { status: 404 }
      );
    }

    // Special action: toggle today's check-in.
    if (body.toggleToday === true) {
      let history: string[] = [];
      try {
        const parsed = JSON.parse(existing.history || "[]");
        if (Array.isArray(parsed)) {
          history = parsed.filter((d) => typeof d === "string");
        }
      } catch {
        history = [];
      }

      const todayISO = toISODate(new Date());
      const idx = history.indexOf(todayISO);
      if (idx >= 0) {
        history.splice(idx, 1);
      } else {
        history.push(todayISO);
      }
      // Deduplicate + sort ascending.
      history = Array.from(new Set(history)).sort();

      const streak = computeStreak(new Set(history));

      const habit = await db.habit.update({
        where: { id },
        data: {
          history: JSON.stringify(history),
          streak,
        },
      });
      return NextResponse.json({ habit });
    }

    // Standard partial update.
    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback: number) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.floor(n) : fallback;
    };

    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = str(body.name).trim();
      if (!name) {
        return NextResponse.json(
          { error: "Habit name cannot be empty" },
          { status: 400 }
        );
      }
      data.name = name;
    }
    if ("goal" in body) data.goal = Math.max(1, Math.min(7, num(body.goal, 7)));
    if ("color" in body) {
      data.color = ALLOWED_COLORS.includes(str(body.color))
        ? str(body.color)
        : existing.color;
    }
    if ("streak" in body) data.streak = Math.max(0, num(body.streak, 0));
    if ("history" in body) {
      // Allow caller to set history directly (must be an array of ISO date strings).
      let next: string[] = [];
      if (Array.isArray(body.history)) {
        next = body.history.filter((d) => typeof d === "string");
      } else if (typeof body.history === "string") {
        try {
          const parsed = JSON.parse(body.history);
          if (Array.isArray(parsed)) {
            next = parsed.filter((d) => typeof d === "string");
          }
        } catch {
          /* ignore malformed */
        }
      }
      data.history = JSON.stringify(Array.from(new Set(next)).sort());
    }

    const habit = await db.habit.update({ where: { id }, data });
    return NextResponse.json({ habit });
  } catch (e) {
    console.error("[habits] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update habit" },
      { status: 500 }
    );
  }
}

/** DELETE /api/habits/[id] — delete a habit. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.habit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Habit not found" },
        { status: 404 }
      );
    }
    await db.habit.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[habits] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete habit" },
      { status: 500 }
    );
  }
}
