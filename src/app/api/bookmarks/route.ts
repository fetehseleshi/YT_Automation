import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/bookmarks — list all bookmarks (createdAt desc). */
export async function GET() {
  try {
    const bookmarks = await db.bookmark.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ bookmarks });
  } catch (e) {
    console.error("[bookmarks] GET error", e);
    return NextResponse.json(
      { error: "Failed to load bookmarks" },
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

/** POST /api/bookmarks — create a new bookmark. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const url = normalizeUrl(str(body.url));
    if (!url) {
      return NextResponse.json(
        { error: "Bookmark URL is required" },
        { status: 400 }
      );
    }

    const title = str(body.title).trim() || url;

    const bookmark = await db.bookmark.create({
      data: {
        title,
        url,
        category: str(body.category, "general") || "general",
      },
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (e) {
    console.error("[bookmarks] POST error", e);
    return NextResponse.json(
      { error: "Failed to create bookmark" },
      { status: 500 }
    );
  }
}
