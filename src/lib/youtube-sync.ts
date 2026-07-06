/**
 * YouTube sync service — pulls real channel + video data via the YouTube Data API v3,
 * upserts into the local DB (dedupe by youtubeChannelId / youtubeVideoId), writes a
 * SyncLog, and captures an AnalyticsSnapshot.
 */
import { db } from "@/lib/db";
import {
  getValidAccessToken,
  fetchOwnChannel,
  fetchChannelVideos,
  classifyYouTubeError,
} from "@/lib/youtube";
import {
  createChannelForUser,
  findChannelByYoutubeIdForUser,
  updateChannelById,
} from "@/lib/channel-utils";

/** Convert a YouTube API channel item to our Channel fields. */
function mapChannel(item: any) {
  const sn = item.snippet || {};
  const st = item.statistics || {};
  const branding = item.brandingSettings || {};
  return {
    name: sn.title || "Untitled channel",
    youtubeChannelId: item.id,
    niche: (item.topicDetails?.topicCategories || []).map((t: string) => t.split("/").pop()).join(", ") || "",
    language: sn.defaultLanguage || sn.country || "English",
    country: sn.country || "",
    description: sn.description || "",
    keywords: branding.channel?.keywords || "",
    logoUrl: sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || "",
    bannerUrl: branding.image?.bannerImageUrl || "",
    subscribers: parseInt(st.subscriberCount || "0"),
    views: parseInt(st.viewCount || "0"),
    watchHours: 0, 
    revenue: 0, 
    source: "youtube",
    status: "active",
  };
}

/** Convert a YouTube playlistItem to our Video fields. */
function mapVideo(item: any) {
  const sn = item.snippet || {};
  const cd = item.contentDetails || {};
  const stats = item.statistics || {};
  const vidStatus = item.status || {};

  return {
    title: sn.title || "Untitled",
    description: sn.description || "",
    thumbnailUrl: sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || "",
    publishDate: sn.publishedAt ? new Date(sn.publishedAt) : null,
    youtubeVideoId: cd.videoId || item.id,
    videoUrl: cd.videoId ? `https://www.youtube.com/watch?v=${cd.videoId}` : "",
    duration: cd.duration || "",
    tags: Array.isArray(sn.tags) ? sn.tags.join(", ") : "",
    category: sn.categoryId || "",
    views: stats.viewCount ? parseInt(stats.viewCount) : 0,
    likes: stats.likeCount ? parseInt(stats.likeCount) : 0,
    comments: stats.commentCount ? parseInt(stats.commentCount) : 0,
    privacyStatus: vidStatus.privacyStatus || "public",
    source: "youtube",
  };
}

export interface SyncResult {
  ok: boolean;
  status: "success" | "partial" | "failed";
  channelTitle: string;
  channelId: string;
  videosProcessed: number;
  likes: number;
  comments: number;
  channelSubscribers: number;
  channelViews: number;
  error?: string;
  durationMs: number;
}

/** Run a full sync (channel + videos) for a YoutubeConnection. */
export async function syncConnection(connId: string): Promise<SyncResult> {
  const startedAt = Date.now();
  const conn = await db.youtubeConnection.findUnique({ where: { id: connId } });
  if (!conn) {
    return { ok: false, status: "failed", channelTitle: "", channelId: "", videosProcessed: 0, likes: 0, comments: 0, channelSubscribers: 0, channelViews: 0, error: "Connection not found", durationMs: 0 };
  }

  // Mark in_progress
  await db.youtubeConnection.update({
    where: { id: connId },
    data: { lastSyncStatus: "in_progress", lastSyncProgress: 5, lastSyncError: "" },
  });

  const log = await db.syncLog.create({
    data: {
      youtubeConnId: connId,
      status: "started",
      resource: "full",
      message: "Sync started",
    },
  });

  let accessToken: string | null = null;
  try {
    accessToken = await getValidAccessToken(connId);
    if (!accessToken) {
      throw new Error("Access token unavailable — reconnect your YouTube account.");
    }

    // ─── 1. Channel ──────────────────────────────────────────────────────
    await db.youtubeConnection.update({ where: { id: connId }, data: { lastSyncProgress: 20 } });
    const ytChannel = await fetchOwnChannel(accessToken);
    if (!ytChannel) {
      throw new Error("No YouTube channel found for this account.");
    }
    const channelData = mapChannel(ytChannel);
    const videoCount = parseInt(ytChannel.statistics?.videoCount || "0");

    // Upsert local Channel by youtubeChannelId and owning user (fallback when Channel.userId is missing).
    let localChannel = await findChannelByYoutubeIdForUser(
      ytChannel.id,
      conn.userId
    );
    if (localChannel) {
      localChannel = await updateChannelById(localChannel.id, channelData);
    } else {
      const colors = ["emerald", "amber", "rose", "teal", "orange"];
      localChannel = await createChannelForUser(
        {
          ...channelData,
          color: colors[Math.floor(Math.random() * colors.length)],
        },
        conn.userId
      );
    }

    // Link connection → channel
    await db.youtubeConnection.update({
      where: { id: connId },
      data: {
        channelId: localChannel.id,
        channelTitle: localChannel.name,
        lastSyncProgress: 40,
      },
    });

    // ─── 2. Videos ───────────────────────────────────────────────────────
    const uploadsPlaylistId = ytChannel.contentDetails?.relatedPlaylists?.uploads || "";
    let videosProcessed = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let anyVideoErrors = false;

    if (uploadsPlaylistId) {
      const ytVideos = await fetchChannelVideos(accessToken, uploadsPlaylistId);
      await db.youtubeConnection.update({ where: { id: connId }, data: { lastSyncProgress: 70 } });

      for (const ytVid of ytVideos) {
        try {
          const v = mapVideo(ytVid);
          if (!v.youtubeVideoId) continue;

          const existing = await db.video.findUnique({
            where: { youtubeVideoId: v.youtubeVideoId },
          });
          if (existing) {
            await db.video.update({ where: { id: existing.id }, data: { ...v, channelId: localChannel.id } });
          } else {
            await db.video.create({
              data: { ...v, channelId: localChannel.id },
            });
          }

          videosProcessed++;
          totalLikes += v.likes;
          totalComments += v.comments;
        } catch (e) {
          anyVideoErrors = true;
          console.error("[sync] video upsert failed", e);
        }
      }
    }

    // ─── 3. Analytics snapshot ───────────────────────────────────────────
    await db.analyticsSnapshot.create({
      data: {
        channelId: localChannel.id,
        subscribers: channelData.subscribers,
        views: channelData.views,
        videos: videoCount,
        watchTimeHours: 0,
        revenue: 0,
        source: "youtube",
      },
    });

    // ─── 4. Finalize ─────────────────────────────────────────────────────
    const durationMs = Date.now() - startedAt;
    const finalStatus = anyVideoErrors ? "partial" : "success";

    await db.youtubeConnection.update({
      where: { id: connId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: finalStatus,
        lastSyncProgress: 100,
        lastSyncError: "",
      },
    });
    await db.syncLog.update({
      where: { id: log.id },
      data: {
        status: finalStatus,
        message: `Synced channel + ${videosProcessed} videos`,
        itemsProcessed: videosProcessed + 1,
        durationMs,
      },
    });

    return {
      ok: true,
      status: finalStatus,
      channelTitle: localChannel.name,
      channelId: localChannel.id,
      videosProcessed,
      likes: totalLikes,
      comments: totalComments,
      channelSubscribers: channelData.subscribers,
      channelViews: channelData.views,
      durationMs,
    };
  } catch (e: any) {
    const durationMs = Date.now() - startedAt;
    const errorMsg = e?.message || "Sync failed";
    const status = e?.message?.match(/\((\d+)\)/);
    const friendly = status ? classifyYouTubeError(parseInt(status[1]), errorMsg) : errorMsg;

    await db.youtubeConnection.update({
      where: { id: connId },
      data: { lastSyncStatus: "failed", lastSyncProgress: 0, lastSyncError: friendly },
    });
    await db.syncLog.update({
      where: { id: log.id },
      data: { status: "failed", error: friendly, durationMs },
    });
    return {
      ok: false,
      status: "failed",
      channelTitle: conn.channelTitle,
      channelId: conn.channelId || "",
      videosProcessed: 0,
      likes: 0,
      comments: 0,
      channelSubscribers: 0,
      channelViews: 0,
      error: friendly,
      durationMs,
    };
  }
}

/** Find connections due for auto-sync. */
export async function getDueAutoSyncs(): Promise<string[]> {
  const cutoff = new Date();
  const conns = await db.youtubeConnection.findMany({
    where: {
      autoSync: true,
      status: "active",
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: cutoff } }],
    },
    select: { id: true, lastSyncAt: true, syncIntervalHrs: true },
  });
  const due: string[] = [];
  for (const c of conns) {
    if (!c.lastSyncAt) {
      due.push(c.id);
      continue;
    }
    const ageHrs = (Date.now() - c.lastSyncAt.getTime()) / 3_600_000;
    if (ageHrs >= c.syncIntervalHrs) due.push(c.id);
  }
  return due;
}