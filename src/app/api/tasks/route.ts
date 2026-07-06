import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/tasks — list all tasks with channel + assignee.
 *  Optional filters: ?status= ?priority= ?category=
 *  Ordered by dueDate asc (nulls last), then createdAt desc. */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const category = url.searchParams.get("category");

    const allowedStatus = ["todo", "in_progress", "done"];
    const allowedPriority = ["low", "medium", "high", "urgent"];

    const where: Record<string, unknown> = {};
    if (status && allowedStatus.includes(status)) where.status = status;
    if (priority && allowedPriority.includes(priority)) where.priority = priority;
    if (category) where.category = category;

    const tasks = await db.task.findMany({
      where,
      include: {
        channel: { select: { id: true, name: true, color: true } },
        assignee: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    });

    return NextResponse.json({ tasks });
  } catch (e) {
    console.error("[tasks] GET error", e);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}

/** POST /api/tasks — create a new task. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const title = str(body.title).trim();
    if (!title) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    const allowedStatus = ["todo", "in_progress", "done"];
    const allowedPriority = ["low", "medium", "high", "urgent"];

    const status = allowedStatus.includes(str(body.status))
      ? str(body.status)
      : "todo";
    const priority = allowedPriority.includes(str(body.priority))
      ? str(body.priority)
      : "medium";

    // Optional relations — verify they exist before wiring up.
    const channelId = str(body.channelId);
    const assigneeId = str(body.assigneeId);

    if (channelId) {
      const ch = await db.channel.findUnique({ where: { id: channelId } });
      if (!ch) {
        return NextResponse.json(
          { error: "Channel not found" },
          { status: 400 }
        );
      }
    }
    if (assigneeId) {
      const m = await db.teamMember.findUnique({ where: { id: assigneeId } });
      if (!m) {
        return NextResponse.json(
          { error: "Team member not found" },
          { status: 400 }
        );
      }
    }

    const parseDate = (v: unknown): Date | null => {
      if (!v || typeof v !== "string" || v.trim() === "") return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };

    const task = await db.task.create({
      data: {
        title,
        description: str(body.description),
        priority,
        status,
        category: str(body.category, "general") || "general",
        progress: Math.min(100, Math.max(0, Math.floor(num(body.progress, 0)))),
        dueDate: parseDate(body.dueDate),
        reminder: parseDate(body.reminder),
        channelId: channelId || null,
        assigneeId: assigneeId || null,
      },
      include: {
        channel: { select: { id: true, name: true, color: true } },
        assignee: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    console.error("[tasks] POST error", e);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
