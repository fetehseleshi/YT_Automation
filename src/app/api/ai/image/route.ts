import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Short, filesystem-safe unique id (cuid-like). */
function createId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    randomUUID().slice(0, 8)
  );
}

/** Map of `type` → style guidance prepended to the user prompt. */
const STYLE_GUIDANCE: Record<string, string> = {
  thumbnail:
    "Bold, high-contrast, dramatic lighting, vivid saturated colors, leave clear empty space for a 3-word text overlay, YouTube thumbnail style, cinematic, eye-catching, 16:9 aspect ratio composition",
  logo:
    "Clean minimalist channel logo, vector-style, simple geometric shapes, centered composition, scalable, professional, single focal point, no clutter",
  banner:
    "Wide cinematic YouTube channel banner, landscape composition, atmospheric depth, balanced negative space, professional color grade, 16:5 aspect ratio composition",
  illustration:
    "Detailed content illustration, rich textures, narrative composition, soft cinematic lighting, depth of field, painterly quality",
};

const ALLOWED_TYPES = ["thumbnail", "logo", "banner", "illustration"];

/** POST /api/ai/image — generate an AI image (thumbnail/logo/banner/illustration),
 *  download to /public/uploads, persist an AIHistory row, return the URL. */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawPrompt = (body?.prompt ?? "").toString().trim();
  const type = ALLOWED_TYPES.includes(String(body?.type).trim())
    ? String(body?.type).trim()
    : "illustration";

  if (!rawPrompt) {
    return NextResponse.json(
      { error: "Prompt is required" },
      { status: 400 }
    );
  }

  const styleGuide = STYLE_GUIDANCE[type];
  const fullPrompt = `${styleGuide}. ${rawPrompt}. High quality, sharp focus, professional content creation asset.`;

  // Pick a size that matches the type's intended aspect ratio.
  const size: "1024x1024" | "1344x768" | "768x1344" | "1440x720" | "720x1440" =
    type === "thumbnail" || type === "banner"
      ? "1344x768"
      : type === "logo"
        ? "1024x1024"
        : "1024x1024";

  try {
    const zai = await ZAI.create();
    const result: any = await zai.images.generations.create({
      prompt: fullPrompt,
      size,
    });

    // SDK normalizes data items to { base64, format: "png" }.
    const item = result?.data?.[0];
    const base64: string | undefined = item?.base64 ?? item?.b64_json;
    if (!base64) {
      console.error("[ai/image] no image data returned", result);
      return NextResponse.json(
        { error: "Image generation failed, please retry" },
        { status: 200 }
      );
    }

    // Ensure the uploads directory exists.
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const id = createId();
    const fileName = `ai-img-${id}.png`;
    const filePath = path.join(uploadsDir, fileName);
    const buffer = Buffer.from(base64, "base64");
    await fs.writeFile(filePath, buffer);

    const url = `/uploads/${fileName}`;

    // Persist to AIHistory (best-effort — never break the response on db failure).
    try {
      await db.aIHistory.create({
        data: {
          tool: type,
          category: "image",
          prompt: rawPrompt.slice(0, 2000),
          response: "Generated image",
          model: "zai-image",
          favorite: false,
          meta: JSON.stringify({ url, type, size }),
        },
      });
    } catch (e) {
      console.error("[ai/image] failed to save history", e);
    }

    return NextResponse.json({ url, prompt: rawPrompt, type });
  } catch (e) {
    console.error("[ai/image] generation failed", e);
    return NextResponse.json(
      { error: "Image generation failed, please retry" },
      { status: 200 }
    );
  }
}
