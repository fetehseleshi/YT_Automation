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
const ALLOWED_COLORS = ["emerald", "amber", "rose", "teal", "orange"];

/**
 * GET /api/scripts?folder=&q=&channelId=&videoId=
 * Returns scripts ordered by updatedAt desc.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const folder = sp.get("folder")?.trim() || undefined;
  const q = sp.get("q")?.trim() || undefined;
  const channelId = sp.get("channelId")?.trim() || undefined;
  const videoId = sp.get("videoId")?.trim() || undefined;

  const where: {
    folder?: string;
    channelId?: string;
    videoId?: string;
    OR?: Array<{ title?: { contains: string }; content?: { contains: string } }>;
  } = {};
  if (folder) where.folder = folder;
  if (channelId) where.channelId = channelId;
  if (videoId) where.videoId = videoId;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { content: { contains: q } },
    ];
  }

  try {
    const scripts = await db.script.findMany({
      where,
      include: { channel: true, video: true },
      orderBy: { updatedAt: "desc" },
    });
    return successResponse({ scripts });
  } catch (err) {
    console.error("[scripts] GET error", err);
    return errorResponse("Failed to load scripts", 500);
  }
}

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().max(50000).optional().default(""),
  hook: z.string().max(500).optional().default(""),
  cta: z.string().max(500).optional().default(""),
  tags: z.string().max(500).optional().default(""),
  folder: z.string().max(100).optional().default("General"),
  status: z.string().optional().default("draft"),
  channelId: z.string().nullable().optional(),
  videoId: z.string().nullable().optional(),
});

/** POST /api/scripts — create a new script. */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, createSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  try {
    if (body.channelId) {
      const ch = await db.channel.findUnique({
        where: { id: body.channelId },
        select: { id: true },
      });
      if (!ch) return errorResponse("Channel not found", 400);
    }
    if (body.videoId) {
      const v = await db.video.findUnique({
        where: { id: body.videoId },
        select: { id: true },
      });
      if (!v) return errorResponse("Video not found", 400);
    }

    const wordCount = body.content
      ? body.content.trim().split(/\s+/).filter(Boolean).length
      : 0;

    const script = await db.script.create({
      data: {
        title: body.title.trim(),
        content: body.content ?? "",
        hook: body.hook ?? "",
        cta: body.cta ?? "",
        tags: body.tags ?? "",
        folder: body.folder || "General",
        status: clampString(body.status, ALLOWED_STATUSES, "draft"),
        channelId: body.channelId || null,
        videoId: body.videoId || null,
        wordCount,
      },
      include: { channel: true, video: true },
    });
    return successResponse({ script }, 201);
  } catch (err) {
    console.error("[scripts] POST error", err);
    return errorResponse("Failed to create script", 500);
  }
}

export { ALLOWED_STATUSES as SCRIPT_STATUSES, ALLOWED_COLORS as SCRIPT_COLORS };
