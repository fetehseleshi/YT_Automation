import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** POST /api/cards/reorder — reorder a card into a new position (possibly new stage).
 *  Body: { cardId, newStage, newIndex }
 *  Loads all cards in newStage (excluding the moved one), inserts at newIndex,
 *  then reassigns positions 0..n sequentially. Returns the full updated list. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { cardId, newStage, newIndex } = body as {
    cardId?: string;
    newStage?: string;
    newIndex?: number;
  };

  if (!cardId || !newStage || typeof newIndex !== "number") {
    return NextResponse.json(
      { error: "cardId, newStage, newIndex are required" },
      { status: 400 }
    );
  }

  const movedCard = await db.card.findUnique({ where: { id: cardId } });
  if (!movedCard) {
    // Graceful: return current board state.
    const cards = await db.card.findMany({
      include: { channel: true },
      orderBy: [{ stage: "asc" }, { position: "asc" }],
    });
    return NextResponse.json({ cards });
  }

  // All cards currently in the destination stage, excluding the moved card.
  const stageCards = await db.card.findMany({
    where: { stage: newStage, NOT: { id: cardId } },
    orderBy: { position: "asc" },
  });

  const clamped = Math.max(0, Math.min(newIndex, stageCards.length));

  // Build the desired ordering: insert the moved card at the clamped index.
  const ordered = stageCards.slice();
  ordered.splice(clamped, 0, movedCard);

  // Update the moved card's stage first (if it changed).
  if (movedCard.stage !== newStage) {
    await db.card.update({
      where: { id: cardId },
      data: { stage: newStage },
    });
  }

  // Reassign positions 0..n sequentially.
  await Promise.all(
    ordered.map((c, i) =>
      db.card.update({ where: { id: c.id }, data: { position: i } })
    )
  );

  // Return the full updated board so the client can sync.
  const cards = await db.card.findMany({
    include: { channel: true },
    orderBy: [{ stage: "asc" }, { position: "asc" }],
  });

  return NextResponse.json({ cards });
}
