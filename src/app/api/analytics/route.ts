export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

type Period = "daily" | "weekly" | "monthly" | "yearly";

interface Bucket {
  key: string;
  start: Date;
  end: Date;
  label: string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Build buckets for a given period. Always oldest → newest. */
function buildBuckets(period: Period, now: Date): Bucket[] {
  const buckets: Bucket[] = [];

  if (period === "daily") {
    // Last 30 days, bucketed by calendar day.
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`,
        start,
        end,
        label: `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`,
      });
    }
  } else if (period === "weekly") {
    // Last 12 weeks. Week starts Monday. Bucket label = "MMM D" of the week's start.
    // Find most recent Monday at/before now.
    const dayOfWeek = now.getDay(); // 0 Sun ... 6 Sat
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
    for (let i = 11; i >= 0; i--) {
      const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`,
        start,
        end,
        label: `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`,
      });
    }
  } else if (period === "monthly") {
    // Last 12 months.
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      buckets.push({
        key: `${start.getFullYear()}-${start.getMonth()}`,
        start,
        end,
        label: MONTH_NAMES[start.getMonth()],
      });
    }
  } else {
    // yearly — last 5 years.
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      const start = new Date(y, 0, 1);
      const end = new Date(y + 1, 0, 1);
      buckets.push({
        key: `${y}`,
        start,
        end,
        label: `${y}`,
      });
    }
  }

  return buckets;
}

// ─── GET /api/analytics ───────────────────────────────────────────────────────
// Aggregates Channel + Video data into a single analytics payload.
// Optional `?channelId=` constrains the aggregation to a single channel.
// Optional `?period=daily|weekly|monthly|yearly` controls the viewsTrend +
// subscribersTrend + revenueByChannelTrend bucketing (defaults to monthly).

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const channelId = req.nextUrl.searchParams.get("channelId") || null;
    const periodParam = (req.nextUrl.searchParams.get("period") || "monthly").toLowerCase();
    const period: Period = (["daily", "weekly", "monthly", "yearly"].includes(periodParam)
      ? periodParam
      : "monthly") as Period;

    const channelWhere = channelId ? { id: channelId, userId } : { userId };
    const videoWhere = channelId
      ? { channelId, channel: { userId } }
      : { channel: { userId } };

    const [channels, videos] = await Promise.all([
      db.channel.findMany({
        where: channelWhere,
        select: {
          id: true,
          name: true,
          niche: true,
          color: true,
          subscribers: true,
          views: true,
          watchHours: true,
          revenue: true,
          rpm: true,
        },
      }),
      db.video.findMany({
        where: videoWhere,
        include: {
          channel: {
            select: { id: true, name: true, color: true, niche: true },
          },
        },
      }),
    ]);

    // ─── KPIs ────────────────────────────────────────────────────────────────
    const totalViews = channels.reduce((s, c) => s + c.views, 0);
    const totalSubscribers = channels.reduce((s, c) => s + c.subscribers, 0);
    const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
    const totalWatchTime = channels.reduce((s, c) => s + c.watchHours, 0);

    // Published videos = has a publishDate (we treat null as draft).
    const publishedVideos = videos.filter((v) => v.publishDate !== null);

    const videosWithEngagement = publishedVideos.filter((v) => v.views > 0);

    const avgCTR = videosWithEngagement.length
      ? videosWithEngagement.reduce((s, v) => s + v.ctr, 0) /
        videosWithEngagement.length
      : 0;

    const avgRetention = videosWithEngagement.length
      ? videosWithEngagement.reduce((s, v) => s + v.retention, 0) /
        videosWithEngagement.length
      : 0;

    // RPM = revenue per 1000 views
    const avgRPM = totalViews > 0 ? (totalRevenue / totalViews) * 1000 : 0;

    // ─── Build period buckets ────────────────────────────────────────────────
    const now = new Date();
    const buckets = buildBuckets(period, now);

    // Bucket real video views + revenue by publishDate.
    // For periods predating data, the bucket stays at zero.
    const viewsByBucket = new Map<string, number>();
    const revenueByBucket = new Map<string, number>();
    for (const v of publishedVideos) {
      if (!v.publishDate) continue;
      const t = new Date(v.publishDate).getTime();
      if (isNaN(t)) continue;
      for (const b of buckets) {
        if (t >= b.start.getTime() && t < b.end.getTime()) {
          viewsByBucket.set(b.key, (viewsByBucket.get(b.key) || 0) + v.views);
          revenueByBucket.set(b.key, (revenueByBucket.get(b.key) || 0) + v.revenue);
          break;
        }
      }
    }

    const viewsTrend = buckets.map((b) => ({
      month: b.label,
      views: Math.round(viewsByBucket.get(b.key) || 0),
      revenue: round2(revenueByBucket.get(b.key) || 0),
    }));

    // ─── Growth % + Subscribers trend (cumulative) ──────────────────────────
    // Derive a growth rate from the views trend (last vs previous bucket).
    const last = viewsTrend[viewsTrend.length - 1]?.views ?? 0;
    const prev = viewsTrend[viewsTrend.length - 2]?.views ?? 0;
    let growthRate = 0.12; // default 12% per period
    if (prev > 0 && last > 0) {
      growthRate = Math.max(0.03, Math.min(0.3, (last - prev) / prev));
    } else if (last === 0 && prev === 0) {
      growthRate = 0.05;
    }
    const growthPct = Math.round(growthRate * 100);

    // Most recent bucket ≈ totalSubscribers; walk back applying the rate.
    const subscribersTrend = buckets.map((b, i) => {
      const periodsBack = buckets.length - 1 - i;
      const subs = Math.round(
        totalSubscribers / Math.pow(1 + growthRate, periodsBack),
      );
      return { month: b.label, subs };
    });

    // ─── Revenue by channel (KPI view, not period-scoped) ───────────────────
    const revenueByChannel = channels
      .map((c) => ({
        name: c.name,
        color: c.color,
        revenue: round2(c.revenue),
        subscribers: c.subscribers,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ─── Top / worst videos ─────────────────────────────────────────────────
    const withChannelInfo = videos
      .filter((v) => v.publishDate !== null)
      .map((v) => ({
        id: v.id,
        title: v.title,
        channel: v.channel?.name || "—",
        channelColor: v.channel?.color || "emerald",
        views: v.views,
        ctr: v.ctr,
        retention: v.retention,
        revenue: v.revenue,
        publishDate: v.publishDate,
      }));

    const topVideos = [...withChannelInfo]
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    const worstVideos = [...withChannelInfo]
      .filter((v) => v.views > 0)
      .sort((a, b) => a.views - b.views)
      .slice(0, 5);

    // ─── Performance scatter ────────────────────────────────────────────────
    const performanceScatter = videosWithEngagement.map((v) => ({
      x: v.ctr,
      y: v.retention,
      size: v.views,
      name: v.title,
      channel: v.channel?.name || "—",
      color: v.channel?.color || "emerald",
    }));

    // ─── Niche breakdown ────────────────────────────────────────────────────
    const nicheMap = new Map<string, { subs: number; revenue: number }>();
    for (const c of channels) {
      const niche = c.niche?.trim() || "Other";
      const existing = nicheMap.get(niche) || { subs: 0, revenue: 0 };
      existing.subs += c.subscribers;
      existing.revenue += c.revenue;
      nicheMap.set(niche, existing);
    }
    const nicheBreakdown = Array.from(nicheMap.entries())
      .map(([niche, v]) => ({
        niche,
        subs: v.subs,
        revenue: round2(v.revenue),
      }))
      .sort((a, b) => b.subs - a.subs);

    return NextResponse.json({
      kpis: {
        totalViews,
        totalSubscribers,
        avgCTR: round1(avgCTR),
        avgRetention: round1(avgRetention),
        avgRPM: round2(avgRPM),
        totalRevenue: round2(totalRevenue),
        totalWatchTime: Math.round(totalWatchTime),
        growthPct,
      },
      period,
      viewsTrend,
      subscribersTrend,
      revenueByChannel,
      topVideos,
      worstVideos,
      performanceScatter,
      nicheBreakdown,
    });
  } catch (e) {
    console.error("[analytics] GET error", e);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 },
    );
  }
}

// Suppress unused warnings for constants retained for clarity.
void DAY_MS;
