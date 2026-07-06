import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getSessionUser } from "@/lib/auth";
import { exchangeCode, fetchOwnChannel } from "@/lib/youtube";

/** GET /api/youtube/callback — handle OAuth callback, store encrypted tokens. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?yt_error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/?yt_error=missing_code", req.url));
  }

  // Validate state cookie (CSRF protection)
  const cookieState = req.cookies.get("yt_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL("/?yt_error=invalid_state", req.url));
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.redirect(new URL("/?yt_error=unauthenticated", req.url));
  }
  const userId = (session.user as any).id;

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Fetch the channel to get the YouTube channel ID
    const channel = await fetchOwnChannel(tokens.access_token);
    if (!channel) {
      return NextResponse.redirect(new URL("/?yt_error=no_channel", req.url));
    }

    // Upsert the connection (one per YouTube channel)
    const existing = await db.youtubeConnection.findUnique({
      where: { youtubeChannelId: channel.id },
    });

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    if (existing) {
      // Re-connecting an existing channel → update tokens
      await db.youtubeConnection.update({
        where: { id: existing.id },
        data: {
          userId,
          accessTokenEnc: encrypt(tokens.access_token),
          refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : existing.refreshTokenEnc,
          scope: tokens.scope,
          tokenExpiresAt: expiresAt,
          status: "active",
          channelTitle: channel.snippet?.title || existing.channelTitle,
          lastSyncError: "",
        },
      });
    } else {
      await db.youtubeConnection.create({
        data: {
          userId,
          youtubeChannelId: channel.id,
          channelTitle: channel.snippet?.title || "",
          accessTokenEnc: encrypt(tokens.access_token),
          refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : "",
          scope: tokens.scope,
          tokenExpiresAt: expiresAt,
          status: "active",
        },
      });
    }

    return NextResponse.redirect(new URL("/?yt_connected=1", req.url));
  } catch (e: any) {
    console.error("[youtube/callback] error", e);
    return NextResponse.redirect(
      new URL(`/?yt_error=${encodeURIComponent(e.message || "callback_failed")}`, req.url)
    );
  }
}
