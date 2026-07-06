import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { findChannelsForUser } from "@/lib/channel-utils";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      channels, channelStats, totalVideos, totalVideosPublished, draftVideos,
      videosScheduled, tasksStats, recentActivities, goals, calendarEvents,
      topVideosRaw, upcomingTasksRaw
    ] = await Promise.all([
      findChannelsForUser(userId),
      db.channel.aggregate({ where: { userId }, _sum: { subscribers: true, views: true, watchHours: true, revenue: true } }),
      db.video.count({ where: { channel: { userId } } }),
      db.video.count({ where: { publishDate: { lte: now }, channel: { userId } } }),
      db.video.count({ where: { editingStatus: { not: "done" }, publishDate: null, channel: { userId } } }),
      db.card.count({ where: { stage: "scheduled", channel: { userId } } }),
      db.task.groupBy({ by: ['status'], where: { channel: { userId } }, _count: { _all: true } }),
      db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, type: true, message: true, section: true, createdAt: true } }),
      db.goal.findMany({ where: { type: { in: ["daily_habit", "upload"] } }, select: { id: true, title: true, current: true, target: true, unit: true, color: true, type: true } }),
      db.calendarEvent.count({ where: { channel: { userId }, date: { gte: now, lte: in30Days } } }),
      db.video.findMany({ where: { channel: { userId } }, orderBy: { views: 'desc' }, take: 5, select: { id: true, title: true, views: true, revenue: true, ctr: true, channel: { select: { name: true, color: true } } } }),
      db.task.findMany({ where: { status: { not: "done" }, channel: { userId } }, orderBy: { dueDate: 'asc' }, take: 6, select: { id: true, title: true, priority: true, status: true, category: true, progress: true, dueDate: true } })
    ]);

    const historicalStart = new Date(year, month - 5, 1);
    const [transactions, cardDates, taskDates] = await Promise.all([
      db.transaction.findMany({ where: { channel: { userId }, date: { gte: historicalStart, lt: new Date(year, month + 1, 1) } }, select: { type: true, amount: true, date: true } }),
      db.card.findMany({ where: { channel: { userId }, dueDate: { not: null } }, select: { dueDate: true } }),
      db.task.findMany({ where: { channel: { userId }, dueDate: { not: null } }, select: { dueDate: true } })
    ]);

    const totalChannels = channels.length;
    const totalSubscribers = channelStats._sum.subscribers || 0;
    const totalViews = channelStats._sum.views || 0;
    const watchTimeHours = channelStats._sum.watchHours || 0;
    const totalRevenue = channelStats._sum.revenue || 0;
    const monetizedChannels = channels.filter(c => c.monetized).length;

    const estimatedRPM = totalRevenue > 0 ? channels.reduce((s, c) => s + c.rpm * c.revenue, 0) / totalRevenue : 0;
    const channelHealth = totalChannels ? Math.round(channels.reduce((s, c) => s + c.healthScore, 0) / totalChannels) : 0;
    const tasksCompleted = tasksStats.find(t => t.status === "done")?._count._all || 0;
    const pendingTasks = tasksStats.filter(t => t.status !== "done").reduce((s, t) => s + t._count._all, 0);

    const revenueSeries: any[] = [];
    let monthlyRevenue = 0;

    for (let i = 5; i >= 0; i--) {
      const start = new Date(year, month - i, 1);
      const end = new Date(year, month - i + 1, 1);
      const filtered = transactions.filter(t => t.date.getTime() >= start.getTime() && t.date.getTime() < end.getTime());
      const inc = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const exp = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

      if (i === 0) monthlyRevenue = inc;

      revenueSeries.push({
        month: MONTH_NAMES[start.getMonth()],
        income: +inc.toFixed(2),
        expense: +exp.toFixed(2),
        profit: +(inc - exp).toFixed(2),
      });
    }

    const viewWeights = [0.11, 0.13, 0.15, 0.17, 0.2, 0.24];
    const viewsSeries = viewWeights.map((weight, idx) => ({
      month: MONTH_NAMES[new Date(year, month - (5 - idx), 1).getMonth()],
      views: Math.round(totalViews * weight)
    }));

    const subGrowthFactors = [0.76, 0.82, 0.87, 0.91, 0.96, 1.0];
    const subscriberGrowth = subGrowthFactors.map((factor, idx) => ({
      month: MONTH_NAMES[new Date(year, month - (5 - idx), 1).getMonth()],
      subs: Math.round(totalSubscribers * factor)
    }));

    const scheduledDates = new Set<string>();
    cardDates.forEach(c => c.dueDate && scheduledDates.add(c.dueDate.toISOString().slice(0, 10)));
    taskDates.forEach(t => t.dueDate && scheduledDates.add(t.dueDate.toISOString().slice(0, 10)));

    return NextResponse.json({
      totals: {
        totalChannels, totalVideos, totalVideosPublished, videosScheduled, draftVideos,
        monthlyRevenue, estimatedRPM, totalSubscribers, totalViews, watchTimeHours,
        monetizedChannels, tasksCompleted, pendingTasks, calendarEvents
      },
      channelHealth, revenueSeries, viewsSeries, subscriberGrowth,
      recentActivity: recentActivities.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
      upcomingTasks: upcomingTasksRaw.map(t => ({ ...t, dueDate: t.dueDate ? t.dueDate.toISOString() : null })),
      dailyGoals: goals.filter(g => g.type === "daily_habit"),
      weeklyGoals: goals.filter(g => g.type === "upload"),
      channelBreakdown: channels.map(({ name, color, subscribers, revenue, views }) => ({ name, color, subscribers, revenue, views })),
      topVideos: topVideosRaw.map(v => ({ id: v.id, title: v.title, views: v.views, revenue: v.revenue, ctr: v.ctr, channelName: v.channel?.name ?? "", channelColor: v.channel?.color ?? "emerald" })),
      scheduledDates: Array.from(scheduledDates),
    }, { status: 200 });

  } catch (error: any) {
    console.error("Dashboard API Optimization Crash Log:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}