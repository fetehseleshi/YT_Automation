import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  parseBody,
  successResponse,
  errorResponse,
  clampString,
} from "@/lib/server-utils";

const ALLOWED_TYPES = ["publish", "meeting", "deadline", "reminder", "upload"];
const ALLOWED_COLORS = ["emerald", "amber", "rose", "teal", "orange"];

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    date: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => v === null || v === undefined || !isNaN(new Date(v).getTime()),
        "Invalid date"
      ),
    endDate: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => v === null || v === undefined || !isNaN(new Date(v).getTime()),
        "Invalid end date"
      ),
    type: z.string().optional(),
    channelId: z.string().nullable().optional(),
    color: z.string().optional(),
    reminder: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => v === null || v === undefined || !isNaN(new Date(v).getTime()),
        "Invalid reminder date"
      ),
    done: z.boolean().optional(),
  })
  .strict();

/** PATCH /api/calendar-events/[id] — partial update (incl. done toggle, date move for drag). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const parsed = await parseBody(req, patchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  try {
    const existing = await db.calendarEvent.findUnique({ where: { id } });
    if (!existing) return errorResponse("Event not found", 404);

    // Validate channel if provided
    if (body.channelId !== undefined && body.channelId) {
      const ch = await db.channel.findUnique({
        where: { id: body.channelId },
        select: { id: true },
      });
      if (!ch) return errorResponse("Channel not found", 400);
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description;
    if (body.date !== undefined)
      data.date = body.date === null ? existing.date : new Date(body.date);
    if (body.endDate !== undefined)
      data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.type !== undefined)
      data.type = clampString(body.type, ALLOWED_TYPES, existing.type);
    if (body.channelId !== undefined)
      data.channelId = body.channelId || null;
    if (body.color !== undefined)
      data.color = clampString(body.color, ALLOWED_COLORS, existing.color);
    if (body.reminder !== undefined)
      data.reminder = body.reminder ? new Date(body.reminder) : null;
    if (body.done !== undefined) data.done = body.done;

    const event = await db.calendarEvent.update({
      where: { id },
      data,
      include: { channel: true },
    });
    return successResponse({ event });
  } catch (err) {
    console.error("[calendar-events] PATCH [id] error", err);
    return errorResponse("Failed to update event", 500);
  }
}

/** DELETE /api/calendar-events/[id]. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const existing = await db.calendarEvent.findUnique({ where: { id } });
    if (!existing) return errorResponse("Event not found", 404);
    await db.calendarEvent.delete({ where: { id } });
    return successResponse({ ok: true });
  } catch (err) {
    console.error("[calendar-events] DELETE [id] error", err);
    return errorResponse("Failed to delete event", 500);
  }
}
