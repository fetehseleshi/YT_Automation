import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = ["yearly", "subscriber", "revenue", "upload", "daily_habit"];
const ALLOWED_COLORS = ["emerald", "amber", "rose", "teal", "orange"];

/** PATCH /api/goals/[id] — partial update of provided fields. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const title = str(body.title).trim();
      if (!title) {
        return NextResponse.json(
          { error: "Goal title cannot be empty" },
          { status: 400 }
        );
      }
      data.title = title;
    }
    if ("type" in body) {
      data.type = ALLOWED_TYPES.includes(str(body.type))
        ? str(body.type)
        : existing.type;
    }
    if ("target" in body) data.target = Math.max(0, num(body.target, 0));
    if ("current" in body) data.current = Math.max(0, num(body.current, 0));
    if ("period" in body) data.period = str(body.period, existing.period);
    if ("unit" in body) data.unit = str(body.unit, existing.unit);
    if ("color" in body) {
      data.color = ALLOWED_COLORS.includes(str(body.color))
        ? str(body.color)
        : existing.color;
    }

    const goal = await db.goal.update({ where: { id }, data });
    return NextResponse.json({ goal });
  } catch (e) {
    console.error("[goals] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}

/** DELETE /api/goals/[id] — delete a goal. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }
    await db.goal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[goals] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
