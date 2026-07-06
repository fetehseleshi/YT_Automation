import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateChannelForUser } from "@/lib/channel-utils";

/** POST /api/youtube/disconnect — remove a YouTube connection (and its tokens). */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const connId = body?.connectionId;
  if (!connId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });

  const conn = await db.youtubeConnection.findUnique({ where: { id: connId } });
  if (!conn || conn.userId !== userId) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  // Detach the local channel's source (keep the data, mark manual)
  if (conn.channelId) {
    await updateChannelForUser(conn.channelId, userId, { source: "manual" });
  }
  await db.youtubeConnection.delete({ where: { id: connId } });
  return NextResponse.json({ ok: true });
}
