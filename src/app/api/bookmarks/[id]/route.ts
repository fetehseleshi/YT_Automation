import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** PATCH /api/bookmarks/[id] — partial update. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.bookmark.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Bookmark not found" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const title = str(body.title).trim();
      if (!title) {
        return NextResponse.json(
          { error: "Bookmark title cannot be empty" },
          { status: 400 }
        );
      }
      data.title = title;
    }
    if ("url" in body) {
      const url = normalizeUrl(str(body.url));
      if (!url) {
        return NextResponse.json(
          { error: "Bookmark URL cannot be empty" },
          { status: 400 }
        );
      }
      data.url = url;
    }
    if ("category" in body) {
      data.category = str(body.category, existing.category) || "general";
    }

    const bookmark = await db.bookmark.update({ where: { id }, data });
    return NextResponse.json({ bookmark });
  } catch (e) {
    console.error("[bookmarks] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update bookmark" },
      { status: 500 }
    );
  }
}

/** DELETE /api/bookmarks/[id] — delete a bookmark. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.bookmark.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Bookmark not found" },
        { status: 404 }
      );
    }
    await db.bookmark.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[bookmarks] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete bookmark" },
      { status: 500 }
    );
  }
}
