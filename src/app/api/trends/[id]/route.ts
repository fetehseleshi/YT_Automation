import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/trends/[id] — partial update of any provided fields (including toggling bookmarked). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.trendItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Trend not found" },
        { status: 404 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const clamp0to100 = (v: unknown, fallback = 0) =>
      Math.min(100, Math.max(0, Math.floor(num(v, fallback))));

    const data: Record<string, unknown> = {};

    if ("topic" in body) {
      const topic = str(body.topic).trim();
      if (!topic) {
        return NextResponse.json(
          { error: "Topic cannot be empty" },
          { status: 400 }
        );
      }
      data.topic = topic;
    }
    if ("competitor" in body) data.competitor = str(body.competitor);
    if ("keyword" in body) data.keyword = str(body.keyword);
    if ("category" in body) data.category = str(body.category, "general");
    if ("source" in body) data.source = str(body.source);
    if ("notes" in body) data.notes = str(body.notes);
    if ("searchVolume" in body)
      data.searchVolume = Math.max(0, Math.floor(num(body.searchVolume, 0)));
    if ("difficulty" in body) data.difficulty = clamp0to100(body.difficulty, 0);
    if ("opportunity" in body) data.opportunity = clamp0to100(body.opportunity, 0);
    if ("bookmarked" in body)
      data.bookmarked =
        typeof body.bookmarked === "boolean"
          ? body.bookmarked
          : existing.bookmarked;

    const trend = await db.trendItem.update({ where: { id }, data });
    return NextResponse.json({ trend });
  } catch (e) {
    console.error("[trends] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update trend" },
      { status: 500 }
    );
  }
}

/** DELETE /api/trends/[id] — delete a trend item. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.trendItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Trend not found" },
        { status: 404 }
      );
    }
    await db.trendItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[trends] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete trend" },
      { status: 500 }
    );
  }
}
