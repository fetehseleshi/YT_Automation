import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/files — list files
 * POST /api/files — upload file to Supabase Storage + save DB record
 */

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

const IMAGE_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif",
]);

const VIDEO_EXT = new Set([
  "mp4", "webm", "mov", "avi", "mkv", "m4v", "ogv", "wmv",
]);

const AUDIO_EXT = new Set([
  "mp3", "wav", "ogg", "m4a", "aac", "flac", "opus", "weba",
]);

function detectAssetType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (IMAGE_EXT.has(ext)) return "thumbnail";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "music";
  if (["pdf", "doc", "docx", "xlsx", "txt"].includes(ext)) return "document";
  return "document";
}

function shortId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function str(v: FormDataEntryValue | null, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

// -------------------- GET --------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const where: any = {};

    const type = searchParams.get("type");
    if (type && type !== "all") where.type = type;

    const folder = searchParams.get("folder");
    if (folder && folder !== "all") where.folder = folder;

    const files = await db.fileAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ files });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load files" },
      { status: 500 }
    );
  }
}

// -------------------- POST --------------------
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return errorResponse("Unauthorized", 401);

  const contentType = req.headers.get("content-type") || "";

  // =========================
  // FILE UPLOAD (Supabase)
  // =========================
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file") as File;

      if (!file) return errorResponse("No file provided", 400);
      if (file.size === 0) return errorResponse("Empty file", 400);
      if (file.size > 25 * 1024 * 1024)
        return errorResponse("Max 25MB allowed", 413);

      const originalName = file.name;
      const ext = originalName.split(".").pop();
      const base = originalName.replace(/\.[^/.]+$/, "");

      const finalName = `${base}-${shortId()}.${ext}`;
      const filePath = `uploads/${finalName}`;

      const bytes = Buffer.from(await file.arrayBuffer());

      // 🔥 UPLOAD TO SUPABASE
      const { error } = await supabase.storage
        .from("uploads")
        .upload(filePath, bytes, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error(error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      // Get public URL
      const { data } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      const url = data.publicUrl;

      const type =
        ALLOWED_TYPES.includes(str(form.get("type")))
          ? str(form.get("type"))
          : detectAssetType(originalName);

      const folder = str(form.get("folder")).trim() || "General";
      const tags = str(form.get("tags"));
      const notes = str(form.get("notes"));

      const created = await db.fileAsset.create({
        data: {
          name: originalName,
          type,
          url,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          folder,
          tags,
          notes,
        },
      });

      return NextResponse.json({ file: created }, { status: 201 });
    } catch (e) {
      console.error("[UPLOAD ERROR]", e);
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }
  }

  // =========================
  // JSON MODE (manual link)
  // =========================
  try {
    const body = await req.json();

    const name = str(body.name).trim();
    if (!name) return errorResponse("Name required", 400);

    const file = await db.fileAsset.create({
      data: {
        name,
        type: str(body.type) || "document",
        url: str(body.url),
        size: str(body.size),
        folder: str(body.folder) || "General",
        tags: str(body.tags),
        notes: str(body.notes),
      },
    });

    return NextResponse.json({ file }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 }
    );
  }
}