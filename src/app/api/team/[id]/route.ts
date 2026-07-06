import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/team/[id] — partial update of any provided fields. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.teamMember.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;
    const num = (v: unknown, fallback = 0) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const allowedRoles = [
      "Script Writer",
      "Editor",
      "Voice Artist",
      "Thumbnail Designer",
      "SEO",
      "Manager",
    ];
    const allowedStatus = ["active", "inactive"];

    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = str(body.name).trim();
      if (!name) {
        return NextResponse.json(
          { error: "Member name cannot be empty" },
          { status: 400 }
        );
      }
      data.name = name;
    }
    if ("role" in body) {
      data.role = allowedRoles.includes(str(body.role))
        ? str(body.role)
        : existing.role;
    }
    if ("email" in body) data.email = str(body.email).trim();
    if ("avatarUrl" in body) data.avatarUrl = str(body.avatarUrl).trim();
    if ("status" in body) {
      data.status = allowedStatus.includes(str(body.status))
        ? str(body.status)
        : existing.status;
    }
    if ("rate" in body) {
      data.rate = Math.max(0, num(body.rate, 0));
    }
    if ("skills" in body) data.skills = str(body.skills).trim();
    if ("notes" in body) data.notes = str(body.notes).trim();

    const member = await db.teamMember.update({
      where: { id },
      data,
    });

    return NextResponse.json({ member });
  } catch (e) {
    console.error("[team] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

/** DELETE /api/team/[id] — delete a member.
 *  Tasks where this member was the assignee are set to null assigneeId
 *  via onDelete: SetNull in the Prisma schema. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.teamMember.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }
    await db.teamMember.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[team] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete team member" },
      { status: 500 }
    );
  }
}
