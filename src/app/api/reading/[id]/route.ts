import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_STATUS = ["todo", "reading", "done"];

const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** PATCH /api/reading/[id] — partial update. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.readingItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Reading item not found" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const title = str(body.title).trim();
      if (!title) {
        return NextResponse.json(
          { error: "Title cannot be empty" },
          { status: 400 }
        );
      }
      data.title = title;
    }
    if ("url" in body) data.url = normalizeUrl(str(body.url));
    if ("category" in body) {
      data.category = str(body.category, existing.category) || "general";
    }
    if ("status" in body) {
      data.status = ALLOWED_STATUS.includes(str(body.status))
        ? str(body.status)
        : existing.status;
    }
    if ("notes" in body) data.notes = str(body.notes, "");

    const item = await db.readingItem.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("[reading] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update reading item" },
      { status: 500 }
    );
  }
}

/** DELETE /api/reading/[id] — delete a reading item. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.readingItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Reading item not found" },
        { status: 404 }
      );
    }
    await db.readingItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reading] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete reading item" },
      { status: 500 }
    );
  }
}
