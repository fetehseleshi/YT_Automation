import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/team — list all team members with task counts.
 *  Each member is returned with `totalTasks` (all assigned) and `openTasks`
 *  (tasks whose status is NOT "done"). */
export async function GET() {
  try {
    const members = await db.teamMember.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          where: { status: { not: "done" } },
          select: { id: true },
        },
      },
    });

    const data = members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      email: m.email,
      avatarUrl: m.avatarUrl,
      status: m.status,
      rate: m.rate,
      skills: m.skills,
      notes: m.notes,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      totalTasks: m._count.tasks,
      openTasks: m.tasks.length,
    }));

    return NextResponse.json({ members: data });
  } catch (e) {
    console.error("[team] GET error", e);
    return NextResponse.json(
      { error: "Failed to load team members" },
      { status: 500 }
    );
  }
}

/** POST /api/team — create a new team member.
 *  Required: name. Optional: role, email, avatarUrl, status, rate, skills, notes. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const name = str(body.name).trim();
    if (!name) {
      return NextResponse.json(
        { error: "Member name is required" },
        { status: 400 }
      );
    }

    const allowedRoles = [
      "Script Writer",
      "Editor",
      "Voice Artist",
      "Thumbnail Designer",
      "SEO",
      "Manager",
    ];
    const role = allowedRoles.includes(str(body.role))
      ? str(body.role)
      : "Manager";

    const allowedStatus = ["active", "inactive"];
    const status = allowedStatus.includes(str(body.status))
      ? str(body.status)
      : "active";

    const member = await db.teamMember.create({
      data: {
        name,
        role,
        email: str(body.email).trim(),
        avatarUrl: str(body.avatarUrl).trim(),
        status,
        rate: Math.max(0, num(body.rate, 0)),
        skills: str(body.skills).trim(),
        notes: str(body.notes).trim(),
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    console.error("[team] POST error", e);
    return NextResponse.json(
      { error: "Failed to create team member" },
      { status: 500 }
    );
  }
}
