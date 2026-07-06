import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/videos/[id] — single video with channel. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const { id } = await params;
  try {
    const video = await db.video.findUnique({
      where: { id },
      include: { channel: true },
    });
    if (!video || video.channel?.userId !== userId) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    return NextResponse.json({ video });
  } catch (e) {
    console.error("[videos] GET by id error", e);
    return NextResponse.json(
      { error: "Failed to load video" },
      { status: 500 }
    );
  }
}

/** PATCH /api/videos/[id] — update provided fields. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Confirm existence first
  const existing = await db.video.findUnique({
    where: { id },
    include: { channel: true },
  });
  if (!existing || existing.channel?.userId !== userId) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const str = (v: unknown, fallback?: string) =>
    typeof v === "string" ? v : fallback ?? "";
  const num = (v: unknown, fallback = 0) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = str(body.title).trim();
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    data.title = title;
  }
  if (body.channelId !== undefined) {
    const channelId = str(body.channelId).trim();
    if (!channelId) {
      return NextResponse.json({ error: "Channel is required" }, { status: 400 });
    }
    const ch = await db.channel.findFirst({ where: { id: channelId, userId } });
    if (!ch) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    data.channelId = channelId;
  }
  if (body.description !== undefined) data.description = str(body.description);
  if (body.keywords !== undefined) data.keywords = str(body.keywords);
  if (body.tags !== undefined) data.tags = str(body.tags);
  if (body.script !== undefined) data.script = str(body.script);
  if (body.hook !== undefined) data.hook = str(body.hook);
  if (body.cta !== undefined) data.cta = str(body.cta);
  if (body.thumbnailUrl !== undefined) data.thumbnailUrl = str(body.thumbnailUrl);
  if (body.voiceOverUrl !== undefined) data.voiceOverUrl = str(body.voiceOverUrl);
  if (body.videoUrl !== undefined) data.videoUrl = str(body.videoUrl);
  if (body.notes !== undefined) data.notes = str(body.notes);

  if (body.editingStatus !== undefined) {
    const allowed = ["not_started", "in_progress", "done"];
    data.editingStatus = allowed.includes(str(body.editingStatus))
      ? str(body.editingStatus)
      : "not_started";
  }
  if (body.publishDate !== undefined) {
    data.publishDate =
      body.publishDate === null || body.publishDate === ""
        ? null
        : new Date(body.publishDate);
  }
  if (body.seoScore !== undefined) {
    data.seoScore = Math.min(100, Math.max(0, Math.floor(num(body.seoScore, 0))));
  }
  if (body.views !== undefined) {
    data.views = Math.max(0, Math.floor(num(body.views, 0)));
  }
  if (body.ctr !== undefined) {
    data.ctr = Math.max(0, num(body.ctr, 0));
  }
  if (body.retention !== undefined) {
    data.retention = Math.max(0, num(body.retention, 0));
  }
  if (body.watchTime !== undefined) {
    data.watchTime = Math.max(0, num(body.watchTime, 0));
  }
  if (body.revenue !== undefined) {
    data.revenue = Math.max(0, num(body.revenue, 0));
  }

  try {
    const video = await db.video.update({
      where: { id },
      data,
      include: { channel: true },
    });
    return NextResponse.json({ video });
  } catch (e) {
    console.error("[videos] PATCH error", e);
    return NextResponse.json(
      { error: "Failed to update video" },
      { status: 500 }
    );
  }
}

/** DELETE /api/videos/[id] — delete a video. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const { id } = await params;
  try {
    const existing = await db.video.findUnique({
      where: { id },
      include: { channel: true },
    });
    if (!existing || existing.channel?.userId !== userId) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    await db.video.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[videos] DELETE error", e);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    );
  }
}
