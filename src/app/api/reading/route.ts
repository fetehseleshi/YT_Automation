import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED_STATUS = ["todo", "reading", "done"];

/** GET /api/reading — list all reading items (createdAt desc). */
export async function GET() {
  try {
    const items = await db.readingItem.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[reading] GET error", e);
    return NextResponse.json(
      { error: "Failed to load reading list" },
      { status: 500 }
    );
  }
}

const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** POST /api/reading — create a new reading item. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const title = str(body.title).trim();
    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const status = ALLOWED_STATUS.includes(str(body.status))
      ? str(body.status)
      : "todo";

    const item = await db.readingItem.create({
      data: {
        title,
        url: normalizeUrl(str(body.url)),
        category: str(body.category, "general") || "general",
        status,
        notes: str(body.notes, ""),
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    console.error("[reading] POST error", e);
    return NextResponse.json(
      { error: "Failed to create reading item" },
      { status: 500 }
    );
  }
}
