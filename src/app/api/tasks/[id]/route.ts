import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/tasks/[id] — partial update of any provided fields. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const allowedStatus = ["todo", "in_progress", "done"];
    const allowedPriority = ["low", "medium", "high", "urgent"];

    const data: Record<string, unknown> = {};

    if ("title" in body) {
      const title = str(body.title).trim();
      if (!title) {
        return NextResponse.json(
          { error: "Task title cannot be empty" },
          { status: 400 }
        );
      }
      data.title = title;
    }
    if ("description" in body) data.description = str(body.description);
    if ("priority" in body) {
      data.priority = allowedPriority.includes(str(body.priority))
        ? str(body.priority)
        : existing.priority;
    }
    if ("status" in body) {
      data.status = allowedStatus.includes(str(body.status))
        ? str(body.status)
        : existing.status;
      // Auto-set progress when toggling status for a quick sanity state.
      if (data.status === "done") data.progress = 100;
      else if (data.status === "todo" && existing.progress === 100) {
        data.progress = 0;
      } else if (
        data.status === "in_progress" &&
        (existing.progress === 0 || existing.progress === 100)
      ) {
        data.progress = existing.progress === 100 ? 80 : 30;
      }
    }
    if ("category" in body) {
      const cat = str(body.category, "general");
      data.category = cat || "general";
    }
    if ("progress" in body) {
      data.progress = Math.min(
        100,
        Math.max(0, Math.floor(num(body.progress, 0)))
      );
    }
    if ("dueDate" in body) {
      const v = body.dueDate;
      if (v === null || v === "" || (typeof v === "string" && v.trim() === "")) {
        data.dueDate = null;
      } else {
        const d = new Date(String(v));
        data.dueDate = isNaN(d.getTime()) ? existing.dueDate : d;
      }
    }
    if ("reminder" in body) {
      const v = body.reminder;
      if (v === null || v === "" || (typeof v === "string" && v.trim() === "")) {
        data.reminder = null;
      } else {
        const d = new Date(String(v));
        data.reminder = isNaN(d.getTime()) ? existing.reminder : d;
      }
    }
    if ("channelId" in body) {
      const v = body.channelId;
      if (v === null || v === "" ) {
        data.channelId = null;
      } else {
        const ch = await db.channel.findUnique({ where: { id: String(v) } });
        if (!ch) {
          return NextResponse.json(
            { error: "Channel not found" },
            { status: 400 }
          );
        }
        data.channelId = String(v);
      }
    }
    if ("assigneeId" in body) {
      const v = body.assigneeId;
      if (v === null || v === "") {
        data.assigneeId = null;
      } else {
        const m = await db.teamMember.findUnique({ where: { id: String(v) } });
        if (!m) {
          return NextResponse.json(
            { error: "Team member not found" },
            { status: 400 }
          );
        }
        data.assigneeId = String(v);
      }
    }

    const task = await db.task.update({
      where: { id },
      data,
      include: {
        channel: { select: { id: true, name: true, color: true } },
        assignee: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ task });
  } catch (e) {
    console.error("[tasks] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

/** DELETE /api/tasks/[id] — delete a task. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }
    await db.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[tasks] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
