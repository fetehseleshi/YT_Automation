import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/files/[id] — partial update of provided fields.
 *   Auth required.
 *
 * DELETE /api/files/[id] — delete a file asset.
 *   If the row's URL points to a file under /public/uploads/, we also unlink
 *   the physical file (best-effort; missing-file errors are ignored).
 *   Auth required.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_TYPES = [
  "script",
  "voiceover",
  "video",
  "music",
  "thumbnail",
  "brand",
  "logo",
  "document",
];

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSessionUser();
  if (!session) return errorResponse("Unauthorized", 401);

  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const existing = await db.fileAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;

    const data: Record<string, unknown> = {};

    if ("name" in body) {
      const name = str(body.name).trim();
      if (!name) {
        return errorResponse("File name cannot be empty", 400);
      }
      data.name = name;
    }
    if ("type" in body) {
      data.type = ALLOWED_TYPES.includes(str(body.type))
        ? str(body.type)
        : existing.type;
    }
    if ("url" in body) data.url = str(body.url);
    if ("size" in body) data.size = str(body.size);
    if ("folder" in body) {
      const folder = str(body.folder).trim();
      data.folder = folder || "General";
    }
    if ("tags" in body) data.tags = str(body.tags);
    if ("notes" in body) data.notes = str(body.notes);

    const file = await db.fileAsset.update({ where: { id }, data });
    return NextResponse.json({ file });
  } catch (e) {
    console.error("[files] PATCH [id] error", e);
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSessionUser();
  if (!session) return errorResponse("Unauthorized", 401);

  try {
    const { id } = await params;
    const existing = await db.fileAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // If the asset points at a locally-uploaded file, best-effort unlink it.
    if (existing.url?.startsWith("/uploads/")) {
      const rel = existing.url.slice("/uploads/".length);
      // Guard against path traversal — only allow a bare filename.
      if (rel && !rel.includes("/") && !rel.includes("..")) {
        const abs = path.join(UPLOAD_DIR, rel);
        try {
          await fs.unlink(abs);
        } catch (e) {
          // File may already be missing — that's fine.
          console.warn(`[files] unlink skipped for ${rel}:`, e);
        }
      }
    }

    await db.fileAsset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[files] DELETE [id] error", e);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
