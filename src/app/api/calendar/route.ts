import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/calendar?month=YYYY-MM
 *
 * Returns a flat list of calendar events for the given month (default: current
 * month). Sources:
 *   - Cards with stage in ["scheduled","published"] and dueDate in month
 *   - Videos with publishDate in month
 *   - Tasks with dueDate in month
 *
 * Response shape:
 *   { events: CalendarEvent[], scheduledCount, publishedCount, taskCount }
 */
export async function GET(req: NextRequest) {
  const monthParam = req.nextUrl.searchParams.get("month");

  // Parse ?month=YYYY-MM (1-indexed month). Falls back to current month.
  const now = new Date();
  let year = now.getFullYear();
  let monthIdx = now.getMonth(); // 0-indexed
  if (monthParam) {
    const m = /^(\d{4})-(\d{2})$/.exec(monthParam);
    if (m) {
      year = parseInt(m[1], 10);
      monthIdx = parseInt(m[2], 10) - 1;
    }
  }

  const start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
  const endExclusive = new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);

  try {
    const [cards, videos, tasks] = await Promise.all([
      db.card.findMany({
        where: {
          stage: { in: ["scheduled", "published"] },
          dueDate: { gte: start, lt: endExclusive },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          stage: true,
          priority: true,
        },
      }),
      db.video.findMany({
        where: {
          publishDate: { gte: start, lt: endExclusive },
        },
        select: {
          id: true,
          title: true,
          publishDate: true,
        },
      }),
      db.task.findMany({
        where: {
          dueDate: { gte: start, lt: endExclusive },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
        },
      }),
    ]);

    type EventType = "scheduled" | "published" | "task";
    interface CalendarEvent {
      id: string;
      date: string;
      title: string;
      type: EventType;
      source: "content" | "video" | "task";
      priority?: string;
    }

    const events: CalendarEvent[] = [];

    for (const c of cards) {
      if (!c.dueDate) continue;
      events.push({
        id: `card:${c.id}`,
        date: c.dueDate.toISOString(),
        title: c.title,
        type: c.stage as EventType,
        source: "content",
        priority: c.priority,
      });
    }

    for (const v of videos) {
      if (!v.publishDate) continue;
      events.push({
        id: `video:${v.id}`,
        date: v.publishDate.toISOString(),
        title: v.title,
        type: "published",
        source: "video",
      });
    }

    for (const t of tasks) {
      if (!t.dueDate) continue;
      events.push({
        id: `task:${t.id}`,
        date: t.dueDate.toISOString(),
        title: t.title,
        type: "task",
        source: "task",
        priority: t.priority,
      });
    }

    const scheduledCount = cards.filter((c) => c.stage === "scheduled").length;
    const publishedCount =
      cards.filter((c) => c.stage === "published").length + videos.length;
    const taskCount = tasks.length;

    return NextResponse.json({
      events,
      scheduledCount,
      publishedCount,
      taskCount,
    });
  } catch (err) {
    console.error("[calendar] GET error", err);
    return NextResponse.json(
      { error: "Failed to load calendar events" },
      { status: 500 }
    );
  }
}
