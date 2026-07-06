import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/trends — list trends, optionally filtered by bookmarked + category, ordered by opportunity desc. */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const bookmarkedParam = url.searchParams.get("bookmarked");
    const categoryParam = url.searchParams.get("category");

    const where: Record<string, unknown> = {};
    if (bookmarkedParam === "true") where.bookmarked = true;
    if (categoryParam && categoryParam.trim()) {
      where.category = categoryParam.trim();
    }

    const trends = await db.trendItem.findMany({
      where,
      orderBy: { opportunity: "desc" },
    });
    return NextResponse.json({ trends });
  } catch (e) {
    console.error("[trends] GET error", e);
    return NextResponse.json(
      { error: "Failed to load trends" },
      { status: 500 }
    );
  }
}

/** POST /api/trends — create a new trend item. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const bool = (v: unknown, fallback = false) =>
      typeof v === "boolean" ? v : fallback;

    const topic = str(body.topic).trim();
    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const clamp0to100 = (v: unknown, fallback = 0) =>
      Math.min(100, Math.max(0, Math.floor(num(v, fallback))));

    const trend = await db.trendItem.create({
      data: {
        topic,
        competitor: str(body.competitor),
        keyword: str(body.keyword),
        searchVolume: Math.max(0, Math.floor(num(body.searchVolume, 0))),
        difficulty: clamp0to100(body.difficulty, 0),
        opportunity: clamp0to100(body.opportunity, 0),
        category: str(body.category, "general"),
        bookmarked: bool(body.bookmarked, false),
        notes: str(body.notes),
        source: str(body.source),
      },
    });

    return NextResponse.json({ trend }, { status: 201 });
  } catch (e) {
    console.error("[trends] POST error", e);
    return NextResponse.json(
      { error: "Failed to create trend" },
      { status: 500 }
    );
  }
}
