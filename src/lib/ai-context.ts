import { db } from "@/lib/db";

/**
 * AI Context Builder for SAINTAUTO
 * ---------------------------------
 * This gathers all YouTube + user data and formats it
 * into a clean context object for AI prompts.
 */

type ChannelSummary = {
  id: string;
  name: string;
  niche: string;
  language: string;
  country: string;
  status: string;
  monetized: boolean;
  subscribers: number;
  views: number;
  watchHours: number;
  revenue: number;
  healthScore: number;
  keywords: string[];
  topTopics: string[];
  recentVideos: {
    title: string;
    category: string;
    views: number;
    publishedAt: Date;
    source: string;
  }[];
  bestPerformingVideos: {
    title: string;
    views: number;
    watchTime: number;
    ctr: number;
    engagement: number;
  }[];
  worstPerformingVideos: {
    title: string;
    views: number;
    watchTime: number;
    ctr: number;
    engagement: number;
  }[];
};

type ChannelContext = {
  channel: {
    connected: boolean;
    lastSyncStatus: string;
    autoSync: boolean;
    connectedAt: Date | null;
  };
  channels: ChannelSummary[];
  videos: Array<{
    channelId: string;
    title: string;
    views: number;
    likes: number;
    comments: number;
    category: string;
    publishedAt: Date;
    source: string;
  }>;
  analytics: Array<{
    videoId: string;
    views: number;
    watchTime: number;
    ctr: number;
    engagementRate: number;
  }>;
  insights: {
    channelCount: number;
    bestPerformingVideos: Array<{
      title: string;
      channelId: string;
      views: number;
      watchTime: number;
      ctr: number;
      publishedAt: Date;
    }>;
    avgViews: number;
    avgEngagement: number;
    topTopics: string[];
  };
};

function normalizeTextToTopics(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 4);
}

/**
 * Main function used by AI route
 */
export async function getChannelContext(userId: string): Promise<ChannelContext | null> {
  try {
    if (!userId) return null;

    const [connection, channels, videos, analytics] = await Promise.all([
      db.youtubeConnection.findFirst({ where: { userId } }),
      db.channel.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: {
          videos: {
            orderBy: { publishedAt: "desc" },
            take: 12,
          },
        },
      }),
      db.video.findMany({
        where: { channel: { userId } },
        orderBy: { publishedAt: "desc" },
        take: 50,
      }),
      db.videoAnalytics.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    if (!connection) return null;

    const buildTopicMap = (itemText: string, target: Record<string, number>) => {
      normalizeTextToTopics(itemText).forEach((topic) => {
        target[topic] = (target[topic] || 0) + 1;
      });
    };

    const channelSummaries = channels.map((channel) => {
      const channelVideos = videos.filter((video) => video.channelId === channel.id);
      const sortedByViews = [...channelVideos].sort((a, b) => (b.views || 0) - (a.views || 0));
      const bestPerformingVideos = sortedByViews.slice(0, 5);
      const worstPerformingVideos = sortedByViews.slice(-5);
      const keywordTerms = (channel.keywords || "").split(",").map((term) => term.trim()).filter(Boolean);

      const topicMap: Record<string, number> = {};
      channelVideos.forEach((video) => {
        buildTopicMap(`${video.title} ${video.description} ${video.tags} ${video.keywords}`, topicMap);
      });

      const topTopics = Object.entries(topicMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic]) => topic);

      return {
        id: channel.id,
        name: channel.name,
        niche: channel.niche,
        language: channel.language,
        country: channel.country,
        status: channel.status,
        monetized: channel.monetized,
        subscribers: channel.subscribers,
        views: channel.views,
        watchHours: channel.watchHours,
        revenue: channel.revenue,
        healthScore: channel.healthScore,
        keywords: keywordTerms,
        topTopics,
        recentVideos: channel.videos.map((video) => ({
          title: video.title,
          category: video.category,
          views: video.views,
          publishedAt: video.publishedAt,
          source: video.source,
        })),
        bestPerformingVideos: bestPerformingVideos.map((video) => ({
          title: video.title,
          views: video.views,
          watchTime: video.watchTime,
          ctr: video.ctr,
          engagement: video.retention,
        })),
        worstPerformingVideos: worstPerformingVideos.map((video) => ({
          title: video.title,
          views: video.views,
          watchTime: video.watchTime,
          ctr: video.ctr,
          engagement: video.retention,
        })),
      };
    });

    const audienceTopicMap: Record<string, number> = {};
    videos.forEach((video) => {
      buildTopicMap(`${video.title} ${video.description} ${video.tags} ${video.keywords}`, audienceTopicMap);
    });

    const overallTopTopics = Object.entries(audienceTopicMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    const bestPerformingVideos = [...videos]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map((video) => ({
        title: video.title,
        channelId: video.channelId,
        views: video.views,
        watchTime: video.watchTime,
        ctr: video.ctr,
        publishedAt: video.publishedAt,
      }));

    const avgViews = videos.length > 0 ? Math.floor(videos.reduce((sum, video) => sum + (video.views || 0), 0) / videos.length) : 0;
    const avgEngagement = analytics.length > 0 ? Math.floor(analytics.reduce((sum, item) => sum + (item.engagementRate || 0), 0) / analytics.length) : 0;

    return {
      channel: {
        connected: true,
        lastSyncStatus: connection.lastSyncStatus ?? "unknown",
        autoSync: connection.autoSync ?? false,
        connectedAt: connection.updatedAt,
      },
      channels: channelSummaries,
      videos: videos.map((video) => ({
        channelId: video.channelId,
        title: video.title,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        category: video.category,
        publishedAt: video.publishedAt,
        source: video.source,
      })),
      analytics: analytics.map((item) => ({
        videoId: item.videoId,
        views: item.views,
        watchTime: item.watchTime,
        ctr: item.ctr,
        engagementRate: item.engagementRate,
      })),
      insights: {
        channelCount: channels.length,
        bestPerformingVideos,
        avgViews,
        avgEngagement,
        topTopics: overallTopTopics,
      },
    };
  } catch (error) {
    console.error("[AI Context Error]", error);
    return null;
  }
}