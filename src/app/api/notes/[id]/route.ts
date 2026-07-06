import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_COLORS = ["emerald", "amber", "rose", "teal", "orange"];
const ALLOWED_TYPES = ["quick", "sticky"];

const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;
const bool = (v: unknown, fallback = false) =>
  typeof v === "boolean" ? v : fallback;

/** PATCH /api/notes/[id] — partial update. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.note.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const title = str(body.title).trim();
      if (!title) {
        return NextResponse.json(
          { error: "Note title cannot be empty" },
          { status: 400 }
        );
      }
      data.title = title;
    }
    if ("content" in body) data.content = str(body.content);
    if ("pinned" in body) data.pinned = bool(body.pinned, false);
    if ("color" in body) {
      data.color = ALLOWED_COLORS.includes(str(body.color))
        ? str(body.color)
        : existing.color;
    }
    if ("type" in body) {
      data.type = ALLOWED_TYPES.includes(str(body.type))
        ? str(body.type)
        : existing.type;
    }

    const note = await db.note.update({ where: { id }, data });
    return NextResponse.json({ note });
  } catch (e) {
    console.error("[notes] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

/** DELETE /api/notes/[id] — delete a note. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.note.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }
    await db.note.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[notes] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
