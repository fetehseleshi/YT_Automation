import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  parseBody,
  successResponse,
  errorResponse,
} from "@/lib/server-utils";

const ALLOWED_TYPES = [
  "publish",
  "meeting",
  "deadline",
  "reminder",
  "upload",
] as const;
const ALLOWED_COLORS = [
  "emerald",
  "amber",
  "rose",
  "teal",
  "orange",
] as const;

/**
 * GET /api/calendar-events?month=YYYY-MM
 *   OR  /api/calendar-events?start=ISO&end=ISO
 * Returns events ordered by date asc.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const monthParam = sp.get("month");
  const startParam = sp.get("start");
  const endParam = sp.get("end");

  let start: Date;
  let endExclusive: Date;

  if (startParam && endParam) {
    start = new Date(startParam);
    endExclusive = new Date(endParam);
    if (isNaN(start.getTime()) || isNaN(endExclusive.getTime())) {
      return errorResponse("Invalid start/end dates", 400);
    }
  } else {
    // Default: provided month, or current month.
    const now = new Date();
    let year = now.getFullYear();
    let monthIdx = now.getMonth();
    if (monthParam) {
      const m = /^(\d{4})-(\d{2})$/.exec(monthParam);
      if (m) {
        year = parseInt(m[1], 10);
        monthIdx = parseInt(m[2], 10) - 1;
      } else {
        return errorResponse("Invalid month format (expected YYYY-MM)", 400);
      }
    }
    start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
    endExclusive = new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);
  }

  try {
    const events = await db.calendarEvent.findMany({
      where: {
        OR: [
          { date: { gte: start, lt: endExclusive } },
          {
            endDate: { gte: start, lt: endExclusive },
          },
        ],
      },
      include: { channel: true },
      orderBy: { date: "asc" },
    });
    return successResponse({ events });
  } catch (err) {
    console.error("[calendar-events] GET error", err);
    return errorResponse("Failed to load calendar events", 500);
  }
}

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().default(""),
  date: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !isNaN(new Date(v).getTime()), "Invalid date"),
  endDate: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) => v === null || v === undefined || !isNaN(new Date(v).getTime()),
      "Invalid end date"
    ),
  type: z.enum(ALLOWED_TYPES).optional().default("publish"),
  channelId: z.string().nullable().optional(),
  color: z.enum(ALLOWED_COLORS).optional().default("emerald"),
  reminder: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) => v === null || v === undefined || !isNaN(new Date(v).getTime()),
      "Invalid reminder date"
    ),
  done: z.boolean().optional().default(false),
});

/** POST /api/calendar-events — create a new event. */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, createSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  try {
    // Validate channel if provided
    if (body.channelId) {
      const ch = await db.channel.findUnique({
        where: { id: body.channelId },
        select: { id: true },
      });
      if (!ch) return errorResponse("Channel not found", 400);
    }

    const event = await db.calendarEvent.create({
      data: {
        title: body.title.trim(),
        description: body.description ?? "",
        date: new Date(body.date),
        endDate: body.endDate ? new Date(body.endDate) : null,
        type: body.type,
        channelId: body.channelId || null,
        color: body.color,
        reminder: body.reminder ? new Date(body.reminder) : null,
        done: body.done,
      },
      include: { channel: true },
    });
    return successResponse({ event }, 201);
  } catch (err) {
    console.error("[calendar-events] POST error", err);
    return errorResponse("Failed to create event", 500);
  }
}

// Re-export enum string lists for any consumer that wants them.
export {
  ALLOWED_TYPES as CALENDAR_EVENT_TYPES,
  ALLOWED_COLORS as CALENDAR_EVENT_COLORS,
};
