import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomToken } from "@/lib/crypto";
import { getSessionUser } from "@/lib/auth";
import { buildAuthUrl, youtubeConfigured } from "@/lib/youtube";

/** GET /api/youtube/connect — redirect to Google OAuth to connect a YouTube channel. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!youtubeConfigured()) {
    return NextResponse.json(
      {
        error:
          "YouTube integration is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then add the redirect URI http://localhost:3000/api/youtube/callback in Google Cloud Console.",
      },
      { status: 503 }
    );
  }

  // CSRF state token (stored in a short-lived cookie)
  const state = randomToken(16);
  const url = buildAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set("yt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
