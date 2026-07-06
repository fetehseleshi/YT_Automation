import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/cards/[id] — update any fields.
 *  When stage changes (and no explicit position given), set position = count in new stage. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const {
    title,
    description,
    stage,
    priority,
    channelId,
    dueDate,
    tags,
    assignee,
    position,
  } = body as Record<string, unknown>;

  const existing = await db.card.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Compute new position.
  let newPosition = existing.position;
  const stageChanged =
    typeof stage === "string" && stage !== existing.stage;
  if (stageChanged) {
    const count = await db.card.count({ where: { stage: stage as string } });
    newPosition = count;
  }
  if (typeof position === "number" && Number.isFinite(position)) {
    newPosition = Math.max(0, Math.floor(position));
  }

  const card = await db.card.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(description !== undefined ? { description: String(description) } : {}),
      ...(stage !== undefined ? { stage: String(stage) } : {}),
      ...(priority !== undefined ? { priority: String(priority) } : {}),
      ...(channelId !== undefined
        ? { channelId: channelId ? String(channelId) : null }
        : {}),
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(String(dueDate)) : null }
        : {}),
      ...(tags !== undefined ? { tags: String(tags) } : {}),
      ...(assignee !== undefined ? { assignee: String(assignee) } : {}),
      position: newPosition,
    },
    include: { channel: true },
  });

  return NextResponse.json({ card });
}

/** DELETE /api/cards/[id] — delete a card. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await db.card.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
