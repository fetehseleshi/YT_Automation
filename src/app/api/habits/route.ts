import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/habits — list all habits. */
export async function GET() {
  try {
    const habits = await db.habit.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ habits });
  } catch (e) {
    console.error("[habits] GET error", e);
    return NextResponse.json(
      { error: "Failed to load habits" },
      { status: 500 }
    );
  }
}

const ALLOWED_COLORS = ["emerald", "amber", "rose", "teal", "orange"];

/** POST /api/habits — create a new habit. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Habit name is required" },
        { status: 400 }
      );
    }

    const num = (v: unknown, fallback: number) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.floor(n) : fallback;
    };
    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;

    const color = ALLOWED_COLORS.includes(str(body.color))
      ? str(body.color)
      : "emerald";
    const goal = Math.max(1, Math.min(7, num(body.goal, 7)));

    const habit = await db.habit.create({
      data: {
        name,
        goal,
        streak: 0,
        history: "[]",
        color,
      },
    });

    return NextResponse.json({ habit }, { status: 201 });
  } catch (e) {
    console.error("[habits] POST error", e);
    return NextResponse.json(
      { error: "Failed to create habit" },
      { status: 500 }
    );
  }
}
