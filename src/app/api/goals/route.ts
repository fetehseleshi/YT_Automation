import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/goals — list all goals, oldest first (stable creation order). */
export async function GET() {
  try {
    const goals = await db.goal.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ goals });
  } catch (e) {
    console.error("[goals] GET error", e);
    return NextResponse.json(
      { error: "Failed to load goals" },
      { status: 500 }
    );
  }
}

const ALLOWED_TYPES = ["yearly", "subscriber", "revenue", "upload", "daily_habit"];
const ALLOWED_COLORS = ["emerald", "amber", "rose", "teal", "orange"];

/** POST /api/goals — create a new goal. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "Goal title is required" },
        { status: 400 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const type = ALLOWED_TYPES.includes(str(body.type))
      ? str(body.type)
      : "yearly";
    const color = ALLOWED_COLORS.includes(str(body.color))
      ? str(body.color)
      : "emerald";

    const goal = await db.goal.create({
      data: {
        title,
        type,
        target: Math.max(0, num(body.target, 0)),
        current: Math.max(0, num(body.current, 0)),
        period: str(body.period, new Date().getFullYear().toString()),
        unit: str(body.unit, ""),
        color,
      },
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (e) {
    console.error("[goals] POST error", e);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}
