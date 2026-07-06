import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/cards/migrate
 *
 * One-time migration of legacy card stages to the new canonical set:
 *   script    -> writing
 *   voiceover -> voice
 *   ready     -> seo
 *
 * Idempotent: returns the counts of migrated cards per legacy stage.
 */
export async function POST() {
  const migrationMap: Record<string, string> = {
    script: "writing",
    voiceover: "voice",
    ready: "seo",
  };

  const result: Record<string, number> = {};
  try {
    for (const [from, to] of Object.entries(migrationMap)) {
      const updated = await db.card.updateMany({
        where: { stage: from },
        data: { stage: to },
      });
      result[from] = updated.count;
    }

    return NextResponse.json({
      ok: true,
      migrated: result,
      totalMigrated: Object.values(result).reduce((a, b) => a + b, 0),
    });
  } catch (err) {
    console.error("[cards/migrate] error", err);
    return NextResponse.json(
      { error: "Failed to migrate card stages" },
      { status: 500 }
    );
  }
}
