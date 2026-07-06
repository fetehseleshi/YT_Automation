import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED_TYPES = ["income", "expense"];
const ALLOWED_CATEGORIES = [
  "adsense",
  "sponsorship",
  "merch",
  "software",
  "freelancer",
  "equipment",
  "tax",
  "other",
  "general",
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/finance/[id] — partial update of provided fields. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    const data: Record<string, unknown> = {};

    if ("type" in body) {
      data.type = ALLOWED_TYPES.includes(body.type as string)
        ? (body.type as string)
        : existing.type;
    }
    if ("category" in body) {
      data.category = ALLOWED_CATEGORIES.includes(body.category as string)
        ? (body.category as string)
        : existing.category;
    }
    if ("amount" in body) {
      const n =
        typeof body.amount === "number" ? body.amount : Number(body.amount);
      if (Number.isFinite(n) && n > 0) data.amount = round2(n);
    }
    if ("description" in body) {
      data.description =
        typeof body.description === "string"
          ? body.description.trim()
          : "";
    }
    if ("date" in body) {
      data.date = toDate(body.date, existing.date);
    }
    if ("channelId" in body) {
      if (typeof body.channelId === "string" && body.channelId.trim()) {
        const ch = await db.channel.findUnique({
          where: { id: body.channelId },
        });
        if (!ch) {
          return NextResponse.json(
            { error: "Channel not found" },
            { status: 400 },
          );
        }
        data.channelId = body.channelId;
      } else {
        data.channelId = null;
      }
    }

    const tx = await db.transaction.update({
      where: { id },
      data,
      include: {
        channel: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({
      transaction: {
        ...tx,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[finance] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 },
    );
  }
}

/** DELETE /api/finance/[id] — delete a transaction. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }
    await db.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[finance] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 },
    );
  }
}
