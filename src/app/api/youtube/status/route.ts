import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { youtubeConfigured } from "@/lib/youtube";

async function getConnectionStats(channelId: string | null) {
  if (!channelId) return { videoCount: 0, likes: 0, comments: 0 };

  const stats = await db.video.aggregate({
    where: { channelId },
    _count: { _all: true },
    _sum: { likes: true, comments: true },
  });

  return {
    videoCount: stats._count._all || 0,
    likes: stats._sum.likes || 0,
    comments: stats._sum.comments || 0,
  };
}

/** GET /api/youtube/status — connection + sync status for the current user. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const connections = await db.youtubeConnection.findMany({
    where: { userId },
    include: {
      channel: { select: { id: true, name: true, logoUrl: true, subscribers: true, views: true } },
      syncLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, status: true, resource: true, message: true, error: true, itemsProcessed: true, durationMs: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const enrichedConnections = await Promise.all(
    connections.map(async (c) => {
      const engagement = await getConnectionStats(c.channelId);
      return {
        id: c.id,
        youtubeChannelId: c.youtubeChannelId,
        channelTitle: c.channelTitle,
        status: c.status,
        lastSyncAt: c.lastSyncAt,
        lastSyncStatus: c.lastSyncStatus,
        lastSyncError: c.lastSyncError,
        lastSyncProgress: c.lastSyncProgress,
        autoSync: c.autoSync,
        syncIntervalHrs: c.syncIntervalHrs,
        channel: c.channel,
        recentLogs: c.syncLogs,
        videoCount: engagement.videoCount,
        likes: engagement.likes,
        comments: engagement.comments,
      };
    })
  );

  return NextResponse.json({
    configured: youtubeConfigured(),
    connections: enrichedConnections,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId = (session.user as any).id;
  const connId = body?.connectionId;
  if (!connId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
  }

  const connection = await db.youtubeConnection.findUnique({ where: { id: connId } });
  if (!connection || connection.userId !== userId) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const data: any = {};
  if (typeof body.autoSync === "boolean") data.autoSync = body.autoSync;
  if (typeof body.syncIntervalHrs === "number") data.syncIntervalHrs = Math.max(1, Math.min(body.syncIntervalHrs, 168));

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const updated = await db.youtubeConnection.update({ where: { id: connId }, data });
  return NextResponse.json({ ok: true, connection: { id: updated.id, autoSync: updated.autoSync, syncIntervalHrs: updated.syncIntervalHrs } });
}
