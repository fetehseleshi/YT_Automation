import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/videos — list videos with optional filters. */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const sp = req.nextUrl.searchParams;
  const channelId = sp.get("channelId")?.trim() || undefined;
  const status = sp.get("status")?.trim() || undefined;
  const q = sp.get("q")?.trim() || undefined;

  const where: any = {
    channel: { userId },
  };
  if (channelId) where.channelId = channelId;
  if (status) where.editingStatus = status;
  if (q) where.title = { contains: q };

  try {
    const videos = await db.video.findMany({
      where,
      include: { channel: true },
      orderBy: [{ publishDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ videos });
  } catch (e) {
    console.error("[videos] GET error", e);
    return NextResponse.json({ error: "Failed to load videos" }, { status: 500 });
  }
}

/** POST /api/videos — create a new video. */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body?.title ?? "").toString().trim();
  const channelId = (body?.channelId ?? "").toString().trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!channelId) {
    return NextResponse.json({ error: "Channel is required" }, { status: 400 });
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  // Verify the channel exists and belongs to the user
  const channel = await db.channel.findFirst({ where: { id: channelId, userId } });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const str = (v: unknown, fallback = "") =>
    typeof v === "string" ? v : fallback;
  const num = (v: unknown, fallback = 0) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const allowedStatus = ["not_started", "in_progress", "done"];
  const editingStatus = allowedStatus.includes(str(body.editingStatus))
    ? str(body.editingStatus)
    : "not_started";

  const publishDate =
    body.publishDate === null || body.publishDate === ""
      ? null
      : body.publishDate
        ? new Date(body.publishDate)
        : null;

  try {
    const video = await db.video.create({
      data: {
        title,
        channelId,
        description: str(body.description),
        keywords: str(body.keywords),
        tags: str(body.tags),
        script: str(body.script),
        hook: str(body.hook),
        cta: str(body.cta),
        thumbnailUrl: str(body.thumbnailUrl),
        voiceOverUrl: str(body.voiceOverUrl),
        editingStatus,
        publishDate,
        seoScore: Math.min(100, Math.max(0, Math.floor(num(body.seoScore, 0)))),
        videoUrl: str(body.videoUrl),
        views: Math.max(0, Math.floor(num(body.views, 0))),
        ctr: Math.max(0, num(body.ctr, 0)),
        retention: Math.max(0, num(body.retention, 0)),
        watchTime: Math.max(0, num(body.watchTime, 0)),
        revenue: Math.max(0, num(body.revenue, 0)),
        notes: str(body.notes),
      },
      include: { channel: true },
    });
    return NextResponse.json({ video }, { status: 201 });
  } catch (e) {
    console.error("[videos] POST error", e);
    return NextResponse.json(
      { error: "Failed to create video" },
      { status: 500 }
    );
  }
}
