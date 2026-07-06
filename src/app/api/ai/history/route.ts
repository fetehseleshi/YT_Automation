import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES = ["text", "image", "audio", "speech"];

/** GET /api/ai/history — full AI history with search/filter support.
 *
 *  Query params (all optional, all apply to the `items` list):
 *    ?q=           substring search across prompt + response
 *    ?category=    one of text | image | audio | speech
 *    ?favorite=true  only favorite entries
 *    ?tool=         filter by tool name (e.g. "ideas", "tts", "asr", "thumbnail")
 *
 *  Returns:
 *    {
 *      items: AIHistory[],         // last 100, filtered, newest first
 *      messages: ChatMessage[],    // last 50 chat messages, oldest-first (backward-compat
 *                                 //   with the existing chat's load() call)
 *    }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const favoriteRaw = searchParams.get("favorite");
    const favorite =
      favoriteRaw === "true" ? true : favoriteRaw === "false" ? false : null;
    const tool = searchParams.get("tool")?.trim() || "";

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { prompt: { contains: q } },
        { response: { contains: q } },
      ];
    }
    if (category && ALLOWED_CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (favorite !== null) {
      where.favorite = favorite;
    }
    if (tool) {
      where.tool = tool;
    }

    const [items, chatRows] = await Promise.all([
      db.aIHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      // Keep the chat history flowing for the existing chat panel.
      db.chatMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const messages = chatRows.reverse().map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      tool: m.tool,
      createdAt: m.createdAt.toISOString(),
    }));

    const serializedItems = items.map((h) => ({
      id: h.id,
      tool: h.tool,
      category: h.category,
      prompt: h.prompt,
      response: h.response,
      model: h.model,
      favorite: h.favorite,
      meta: h.meta,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    }));

    return NextResponse.json({ items: serializedItems, messages });
  } catch (e) {
    console.error("[ai/history] GET error", e);
    return NextResponse.json(
      { error: "Failed to load AI history", items: [], messages: [] },
      { status: 500 }
    );
  }
}

/** POST /api/ai/history — favorite/unfavorite/delete a row, or create a manual entry.
 *
 *  Body shapes:
 *    { action: "favorite" | "unfavorite", id }   → set favorite flag
 *    { action: "delete", id }                    → remove the row
 *    { tool, category, prompt, response }        → create a manual entry
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const str = (v: unknown, fallback = "") =>
    typeof v === "string" ? v : fallback;

  // ── Action routes ─────────────────────────────────────────────────────────
  if (body && typeof body.action === "string") {
    const action = body.action;
    const id = str(body.id);
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    try {
      if (action === "favorite" || action === "unfavorite") {
        const existing = await db.aIHistory.findUnique({ where: { id } });
        if (!existing) {
          return NextResponse.json(
            { error: "Entry not found" },
            { status: 404 }
          );
        }
        const updated = await db.aIHistory.update({
          where: { id },
          data: { favorite: action === "favorite" },
        });
        return NextResponse.json({ item: updated });
      }

      if (action === "delete") {
        const existing = await db.aIHistory.findUnique({ where: { id } });
        if (!existing) {
          return NextResponse.json(
            { error: "Entry not found" },
            { status: 404 }
          );
        }
        await db.aIHistory.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }

      if (action === "clear") {
        await db.chatMessage.deleteMany();
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    } catch (e) {
      console.error("[ai/history] POST action error", e);
      return NextResponse.json(
        { error: "Failed to update entry" },
        { status: 500 }
      );
    }
  }

  // ── Manual entry creation ─────────────────────────────────────────────────
  const prompt = str(body?.prompt).trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 }
    );
  }

  const category = ALLOWED_CATEGORIES.includes(str(body?.category))
    ? str(body!.category)
    : "text";

  try {
    const created = await db.aIHistory.create({
      data: {
        tool: str(body?.tool, "manual") || "manual",
        category,
        prompt,
        response: str(body?.response),
        model: str(body?.model, "manual"),
        favorite: false,
        meta: "{}",
      },
    });
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (e) {
    console.error("[ai/history] POST create error", e);
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 }
    );
  }
}
