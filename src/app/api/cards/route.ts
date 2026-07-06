import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/cards — return all cards with channel relation. */
export async function GET() {
  const cards = await db.card.findMany({
    include: { channel: true },
    orderBy: [{ stage: "asc" }, { position: "asc" }],
  });
  return NextResponse.json({ cards });
}

/** POST /api/cards — create a card. Position defaults to count of cards in stage. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    title,
    description,
    stage = "ideas",
    priority = "medium",
    channelId,
    dueDate,
    tags,
    assignee,
  } = body as {
    title?: string;
    description?: string;
    stage?: string;
    priority?: string;
    channelId?: string | null;
    dueDate?: string | null;
    tags?: string;
    assignee?: string;
  };

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }

  const count = await db.card.count({ where: { stage } });

  const card = await db.card.create({
    data: {
      title: title.trim(),
      description: description ?? "",
      stage,
      priority: priority ?? "medium",
      channelId: channelId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      tags: tags ?? "",
      assignee: assignee ?? "",
      position: count,
    },
    include: { channel: true },
  });

  return NextResponse.json({ card }, { status: 201 });
}
