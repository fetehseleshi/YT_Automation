import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  deleteChannelForUser,
  findChannelByIdForUser,
  updateChannelForUser,
} from "@/lib/channel-utils";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/channels/[id] — single channel. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const { id } = await params;
    const channel = await findChannelByIdForUser(id, userId);
    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ channel });
  } catch (e) {
    console.error("[channels] GET [id] error", e);
    return NextResponse.json(
      { error: "Failed to load channel" },
      { status: 500 }
    );
  }
}

/** PATCH /api/channels/[id] — partial update of provided fields. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await findChannelByIdForUser(id, userId);
    if (!existing) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = str(body.name).trim();
      if (!name) {
        return NextResponse.json(
          { error: "Channel name cannot be empty" },
          { status: 400 }
        );
      }
      data.name = name;
    }
    if ("niche" in body) data.niche = str(body.niche);
    if ("language" in body) data.language = str(body.language, "English");
    if ("country" in body) data.country = str(body.country, "United States");
    if ("status" in body) {
      const allowedStatus = ["active", "paused", "growth", "new"];
      data.status = allowedStatus.includes(str(body.status))
        ? str(body.status)
        : existing.status;
    }
    if ("monetized" in body) data.monetized = typeof body.monetized === "boolean" ? body.monetized : existing.monetized;
    if ("adsenseAccount" in body) data.adsenseAccount = str(body.adsenseAccount);
    if ("logoUrl" in body) data.logoUrl = str(body.logoUrl);
    if ("bannerUrl" in body) data.bannerUrl = str(body.bannerUrl);
    if ("description" in body) data.description = str(body.description);
    if ("keywords" in body) data.keywords = str(body.keywords);
    if ("socialLinks" in body) data.socialLinks = str(body.socialLinks, "{}");
    if ("notes" in body) data.notes = str(body.notes);
    if ("goals" in body) data.goals = str(body.goals);
    if ("subscribers" in body) data.subscribers = Math.max(0, Math.floor(num(body.subscribers, 0)));
    if ("views" in body) data.views = Math.max(0, Math.floor(num(body.views, 0)));
    if ("watchHours" in body) data.watchHours = Math.max(0, num(body.watchHours, 0));
    if ("revenue" in body) data.revenue = Math.max(0, num(body.revenue, 0));
    if ("rpm" in body) data.rpm = Math.max(0, num(body.rpm, 0));
    if ("healthScore" in body) data.healthScore = Math.min(100, Math.max(0, Math.floor(num(body.healthScore, 80))));
    if ("color" in body) {
      const allowedColors = ["emerald", "amber", "rose", "teal", "orange"];
      data.color = allowedColors.includes(str(body.color))
        ? str(body.color)
        : existing.color;
    }

    const channel = await updateChannelForUser(id, userId, data);
    return NextResponse.json({ channel });
  } catch (e) {
    console.error("[channels] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

/** DELETE /api/channels/[id] — delete a channel. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const { id } = await params;
    const existing = await findChannelByIdForUser(id, userId);
    if (!existing) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }
    await deleteChannelForUser(id, userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[channels] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete channel" },
      { status: 500 }
    );
  }
}
