import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  createChannelForUser,
  findChannelsForUser,
} from "@/lib/channel-utils";

/** GET /api/channels — list all channels for the current user, newest first. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const channels = await findChannelsForUser(userId);
    return NextResponse.json({ channels });
  } catch (e) {
    console.error("[channels] GET error", e);
    return NextResponse.json(
      { error: "Failed to load channels" },
      { status: 500 }
    );
  }
}

/** POST /api/channels — create a new channel. */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Channel name is required" },
        { status: 400 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;

    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const bool = (v: unknown, fallback = false) =>
      typeof v === "boolean" ? v : fallback;

    const allowedStatus = ["active", "paused", "growth", "new"];
    const status = allowedStatus.includes(str(body.status))
      ? str(body.status)
      : "active";

    const allowedColors = ["emerald", "amber", "rose", "teal", "orange"];
    const color = allowedColors.includes(str(body.color))
      ? str(body.color)
      : "emerald";

    const channel = await createChannelForUser(
      {
        name,
        niche: str(body.niche),
        language: str(body.language, "English"),
        country: str(body.country, "United States"),
        status,
        monetized: bool(body.monetized, false),
        adsenseAccount: str(body.adsenseAccount),
        logoUrl: str(body.logoUrl),
        bannerUrl: str(body.bannerUrl),
        description: str(body.description),
        keywords: str(body.keywords),
        socialLinks: str(body.socialLinks, "{}"),
        notes: str(body.notes),
        goals: str(body.goals),
        subscribers: Math.max(0, Math.floor(num(body.subscribers, 0))),
        views: Math.max(0, Math.floor(num(body.views, 0))),
        watchHours: Math.max(0, num(body.watchHours, 0)),
        revenue: Math.max(0, num(body.revenue, 0)),
        rpm: Math.max(0, num(body.rpm, 0)),
        healthScore: Math.min(
          100,
          Math.max(0, Math.floor(num(body.healthScore, 80)))
        ),
        color,
      },
      userId
    );

    return NextResponse.json({ channel }, { status: 201 });
  } catch (e) {
    console.error("[channels] POST error", e);
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 }
    );
  }
}
