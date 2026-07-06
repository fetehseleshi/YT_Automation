import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/youtube/logs — sync logs for the user's connections. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const conns = await db.youtubeConnection.findMany({
    where: { userId },
    select: { id: true, channelTitle: true },
  });
  const connIds = conns.map((c) => c.id);
  if (connIds.length === 0) return NextResponse.json({ logs: [] });

  const logs = await db.syncLog.findMany({
    where: { youtubeConnId: { in: connIds } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const titleMap = new Map(conns.map((c) => [c.id, c.channelTitle]));
  return NextResponse.json({
    logs: logs.map((l) => ({
      ...l,
      channelTitle: titleMap.get(l.youtubeConnId) || "",
    })),
  });
}
