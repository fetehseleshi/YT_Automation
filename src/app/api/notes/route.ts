import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED_COLORS = ["emerald", "amber", "rose", "teal", "orange"];
const ALLOWED_TYPES = ["quick", "sticky"];

/** GET /api/notes — list all notes (pinned first, then createdAt desc). */
export async function GET() {
  try {
    const notes = await db.note.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ notes });
  } catch (e) {
    console.error("[notes] GET error", e);
    return NextResponse.json(
      { error: "Failed to load notes" },
      { status: 500 }
    );
  }
}

const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;
const bool = (v: unknown, fallback = false) =>
  typeof v === "boolean" ? v : fallback;

/** POST /api/notes — create a new note. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const content = str(body.content).trim();
    const title = str(body.title).trim() || content.slice(0, 60);
    if (!title && !content) {
      return NextResponse.json(
        { error: "Note title or content is required" },
        { status: 400 }
      );
    }

    const color = ALLOWED_COLORS.includes(str(body.color))
      ? str(body.color)
      : "emerald";
    const type = ALLOWED_TYPES.includes(str(body.type))
      ? str(body.type)
      : "quick";

    const note = await db.note.create({
      data: {
        title,
        content,
        color,
        type,
        pinned: bool(body.pinned, false),
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (e) {
    console.error("[notes] POST error", e);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
