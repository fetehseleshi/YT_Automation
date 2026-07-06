import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncConnection } from "@/lib/youtube-sync";
import { youtubeConfigured } from "@/lib/youtube";

/** POST /api/youtube/sync — manually trigger a sync for a connection. */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!youtubeConfigured()) {
    return NextResponse.json(
      { error: "YouTube integration is not configured. Add GOOGLE_CLIENT_ID/SECRET to .env." },
      { status: 503 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body */
  }

  const userId = (session.user as any).id;
  const connId = body?.connectionId;

  let connection;
  if (connId) {
    connection = await db.youtubeConnection.findUnique({ where: { id: connId } });
    if (!connection || connection.userId !== userId) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
  } else {
    // Sync the user's first connection
    connection = await db.youtubeConnection.findFirst({ where: { userId } });
    if (!connection) {
      return NextResponse.json(
        { error: "No YouTube account connected. Click 'Connect YouTube' first." },
        { status: 404 }
      );
    }
  }

  // Run sync (synchronous within the request; could be backgrounded for large libraries)
  const result = await syncConnection(connection.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
