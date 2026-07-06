import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

type StageEntry = { key: string; label: string; done: boolean };

const ALLOWED_STATUS = ["active", "completed", "paused"];

/** Safely parse the `stages` JSON string into an array of StageEntry.
 *  Returns `null` when the stored value cannot be interpreted as an array. */
function parseStages(raw: string): StageEntry[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(
        (s): s is StageEntry =>
          !!s &&
          typeof s === "object" &&
          typeof s.key === "string" &&
          typeof s.label === "string" &&
          typeof s.done === "boolean"
      )
      .map((s) => ({ key: s.key, label: s.label, done: s.done }));
  } catch {
    return null;
  }
}

/** PATCH /api/workflows/[id] — partial update.
 *  Special: if body has `toggleStage: "stageKey"`, flip that stage's `done`
 *  in the stages array, recompute progress = (doneCount/total)*100, set
 *  status="completed" if all done. Return updated workflow. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.workflow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;

    // ── Stage toggle path ────────────────────────────────────────────────
    if (typeof body.toggleStage === "string") {
      const stageKey = body.toggleStage.trim().toLowerCase();
      let stages = parseStages(existing.stages);
      if (!stages) {
        // Corrupt/empty stages — reset to empty array defensively.
        stages = [];
      }

      const idx = stages.findIndex((s) => s.key.toLowerCase() === stageKey);
      if (idx === -1) {
        return NextResponse.json(
          { error: `Stage "${stageKey}" not found` },
          { status: 400 }
        );
      }

      stages[idx] = { ...stages[idx], done: !stages[idx].done };

      const doneCount = stages.filter((s) => s.done).length;
      const total = stages.length || 1;
      const progress = Math.round((doneCount / total) * 100);
      const status = doneCount === total && total > 0 ? "completed" : "active";

      const workflow = await db.workflow.update({
        where: { id },
        data: {
          stages: JSON.stringify(stages),
          progress,
          status,
        },
      });

      return NextResponse.json({ workflow });
    }

    // ── Regular partial update path ─────────────────────────────────────
    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = str(body.name).trim();
      if (!name) {
        return NextResponse.json(
          { error: "Workflow name cannot be empty" },
          { status: 400 }
        );
      }
      data.name = name;
    }
    if ("videoTitle" in body) data.videoTitle = str(body.videoTitle).trim();
    if ("channelName" in body) data.channelName = str(body.channelName).trim();
    if ("status" in body) {
      data.status = ALLOWED_STATUS.includes(str(body.status))
        ? str(body.status)
        : existing.status;
    }
    if ("progress" in body) {
      const n = Number(body.progress);
      if (Number.isFinite(n)) {
        data.progress = Math.min(100, Math.max(0, Math.round(n)));
      }
    }
    if ("stages" in body) {
      // Accept either an array or a JSON string of stages.
      const incoming =
        typeof body.stages === "string" ? body.stages : JSON.stringify(body.stages);
      const parsed = parseStages(incoming);
      if (parsed) {
        data.stages = JSON.stringify(parsed);
        const doneCount = parsed.filter((s) => s.done).length;
        const total = parsed.length || 1;
        data.progress = Math.round((doneCount / total) * 100);
        data.status =
          doneCount === total && total > 0 ? "completed" : existing.status;
      }
    }

    const workflow = await db.workflow.update({
      where: { id },
      data,
    });

    return NextResponse.json({ workflow });
  } catch (e) {
    console.error("[workflows] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}

/** DELETE /api/workflows/[id] — delete a workflow. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.workflow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }
    await db.workflow.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[workflows] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
