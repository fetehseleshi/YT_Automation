import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

/** Verifies if the required Google Client environment variables are configured. */
export function youtubeConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Generates the secure Google OAuth consent screen URI for redirection.
 */
export function buildAuthUrl(state: string): string {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/youtube/callback`;
  
  const options = {
    redirect_uri: redirectUri,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile"
    ].join(" "),
    state: state,
  };

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

/**
 * Exchanges the authorized URL callback code parameter for runtime tokens.
 */
export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope: string; token_type: string; }> {
  const url = "https://oauth2.googleapis.com/token";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/youtube/callback`;

  const values = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values).toString(),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Token exchange failed (${res.status}): ${errBody.error_description || res.statusText}`);
  }

  return res.json();
}

async function refreshAccessToken(connId: string, refreshToken: string): Promise<string | null> {
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values).toString(),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error("[YouTube API] refreshAccessToken failed:", res.status, errBody);
    await db.youtubeConnection.update({
      where: { id: connId },
      data: { status: "expired" },
    });
    return null;
  }

  const data = await res.json();
  if (!data.access_token) {
    console.error("[YouTube API] refreshAccessToken returned no access_token", data);
    await db.youtubeConnection.update({
      where: { id: connId },
      data: { status: "expired" },
    });
    return null;
  }

  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await db.youtubeConnection.update({
    where: { id: connId },
    data: {
      accessTokenEnc: encrypt(data.access_token),
      refreshTokenEnc: data.refresh_token ? encrypt(data.refresh_token) : undefined,
      tokenExpiresAt: expiresAt,
      status: "active",
    },
  });

  return data.access_token;
}

/**
 * CRASH-PROOF FIX: Safely retrieves the access token from the database, handling 
 * potential decryption errors elegantly if plain strings exist in historical database records.
 */
export async function getValidAccessToken(connId: string): Promise<string | null> {
  try {
    const conn = await db.youtubeConnection.findUnique({
      where: { id: connId },
      select: {
        accessTokenEnc: true,
        refreshTokenEnc: true,
        tokenExpiresAt: true,
      },
    });

    if (!conn) {
      console.warn(`[YouTube API] No connection found for ${connId}.`);
      return null;
    }

    const accessToken = decrypt(conn.accessTokenEnc);
    const refreshToken = decrypt(conn.refreshTokenEnc);
    const isExpired = conn.tokenExpiresAt ? conn.tokenExpiresAt.getTime() - Date.now() < 60_000 : false;

    if ((!accessToken || isExpired) && refreshToken) {
      const refreshed = await refreshAccessToken(connId, refreshToken);
      if (refreshed) return refreshed;
      return null;
    }

    if (!accessToken) {
      console.warn(`[YouTube API] No access token available for connection ${connId}.`);
      return null;
    }

    return accessToken;
  } catch (error) {
    console.error("[YouTube API] Error retrieving access token:", error);
    return null;
  }
}

/** Fetches the user's channel profile using native fetch. */
export async function fetchOwnChannel(accessToken: string) {
  try {
    const url = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings,topicDetails&mine=true";
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`(${res.status}) ${errorData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;
    return data.items[0];
  } catch (error: any) {
    console.error("[YouTube API] fetchOwnChannel failed:", error);
    throw new Error(error.message || "Failed to fetch channel.");
  }
}

/** PARAMETER FIX: Fetches video list items safely without adding illegal parameters like channelId. */
async function fetchPlaylistVideoIds(accessToken: string, playlistId: string) {
    const ids: string[] = [];
    let pageToken = "";

    while (true) {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.append("part", "contentDetails");
      url.searchParams.append("playlistId", playlistId);
      url.searchParams.append("maxResults", "50");
      if (pageToken) url.searchParams.append("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`(${res.status}) ${errorData.error?.message || res.statusText}`);
      }

      const data = await res.json();
      for (const item of data.items || []) {
        const videoId = item.contentDetails?.videoId;
        if (videoId) ids.push(videoId);
      }

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    return ids;
  }

  export async function fetchChannelVideos(accessToken: string, playlistId: string) {
    try {
      if (!playlistId || typeof playlistId !== "string") {
        console.warn("[YouTube API] fetchChannelVideos called with invalid playlistId:", playlistId);
        return [];
      }

      const ids = await fetchPlaylistVideoIds(accessToken, playlistId);
      if (ids.length === 0) return [];

      const videoItems: any[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const url = new URL("https://www.googleapis.com/youtube/v3/videos");
        url.searchParams.append("part", "snippet,statistics,contentDetails,status");
        url.searchParams.append("id", batch.join(","));

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(`(${res.status}) ${errorData.error?.message || res.statusText}`);
        }

        const data = await res.json();
        videoItems.push(...(data.items || []));
      }

      return videoItems;
  } catch (error: any) {
    console.error("[YouTube API] fetchChannelVideos error:", error);
    throw new Error(error.message || "Failed to fetch channel videos.");
  }
}

/** Classifies numerical Google API error states into descriptive messages. */
export function classifyYouTubeError(status: number, defaultMessage: string): string {
  switch (status) {
    case 400:
      return "YouTube API error (400): Request parameters or structure filters are invalid.";
    case 401:
      return "Authentication expired. Please disconnect and reconnect your YouTube channel.";
    case 403:
      return "Access denied or Daily API Quota Limit exceeded. Check Google Console restrictions.";
    case 404:
      return "Requested YouTube data layout could not be found.";
    default:
      return defaultMessage;
  }
}