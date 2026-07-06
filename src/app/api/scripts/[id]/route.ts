import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  parseBody,
  successResponse,
  errorResponse,
  clampString,
} from "@/lib/server-utils";

const ALLOWED_STATUSES = ["draft", "review", "final"];

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(50000).optional(),
    hook: z.string().max(500).optional(),
    cta: z.string().max(500).optional(),
    tags: z.string().max(500).optional(),
    folder: z.string().max(100).optional(),
    status: z.string().optional(),
    channelId: z.string().nullable().optional(),
    videoId: z.string().nullable().optional(),
  })
  .strict();

/** GET /api/scripts/[id] — single script. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const script = await db.script.findUnique({
      where: { id },
      include: { channel: true, video: true },
    });
    if (!script) return errorResponse("Script not found", 404);
    return successResponse({ script });
  } catch (err) {
    console.error("[scripts] GET [id] error", err);
    return errorResponse("Failed to load script", 500);
  }
}

/** PATCH /api/scripts/[id] — partial update; auto-recomputes wordCount. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const parsed = await parseBody(req, patchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  try {
    const existing = await db.script.findUnique({ where: { id } });
    if (!existing) return errorResponse("Script not found", 404);

    if (body.channelId !== undefined && body.channelId) {
      const ch = await db.channel.findUnique({
        where: { id: body.channelId },
        select: { id: true },
      });
      if (!ch) return errorResponse("Channel not found", 400);
    }
    if (body.videoId !== undefined && body.videoId) {
      const v = await db.video.findUnique({
        where: { id: body.videoId },
        select: { id: true },
      });
      if (!v) return errorResponse("Video not found", 400);
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.content !== undefined) {
      data.content = body.content;
      data.wordCount = body.content
        ? body.content.trim().split(/\s+/).filter(Boolean).length
        : 0;
    }
    if (body.hook !== undefined) data.hook = body.hook;
    if (body.cta !== undefined) data.cta = body.cta;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.folder !== undefined) data.folder = body.folder || "General";
    if (body.status !== undefined)
      data.status = clampString(body.status, ALLOWED_STATUSES, existing.status);
    if (body.channelId !== undefined)
      data.channelId = body.channelId || null;
    if (body.videoId !== undefined) data.videoId = body.videoId || null;

    const script = await db.script.update({
      where: { id },
      data,
      include: { channel: true, video: true },
    });
    return successResponse({ script });
  } catch (err) {
    console.error("[scripts] PATCH [id] error", err);
    return errorResponse("Failed to update script", 500);
  }
}

/** DELETE /api/scripts/[id]. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await db.script.findUnique({ where: { id } });
    if (!existing) return errorResponse("Script not found", 404);
    await db.script.delete({ where: { id } });
    return successResponse({ ok: true });
  } catch (err) {
    console.error("[scripts] DELETE [id] error", err);
    return errorResponse("Failed to delete script", 500);
  }
}

export { ALLOWED_STATUSES as SCRIPT_STATUSES };
