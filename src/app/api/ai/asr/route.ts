import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB cap

/** POST /api/ai/asr — Whisper-equivalent speech-to-text.
 *  Accepts multipart/form-data with `file` (audio blob) + optional `prompt`.
 *  Returns { text }. The SDK takes a base64 string for `file_base64`. */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an audio file" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const prompt = (form.get("prompt") as string | null)?.toString().trim() || "";

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Audio file is required" },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "Audio file is empty" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Audio file too large (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB)` },
      { status: 400 }
    );
  }

  try {
    // Read the uploaded audio into a base64 string for the SDK.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    const zai = await ZAI.create();
    // SDK expects { model?, file?, file_base64?, stream? } and returns parsed JSON.
    const result: any = await zai.audio.asr.create({
      model: "whisper",
      file_base64: base64,
    });

    // The response shape is provider-dependent; defensively extract text.
    const text: string =
      (typeof result?.text === "string" && result.text) ||
      (typeof result?.transcript === "string" && result.transcript) ||
      (Array.isArray(result?.segments) &&
        result.segments.map((s: any) => s?.text ?? "").join(" ").trim()) ||
      (typeof result === "string" && result) ||
      "";

    if (!text) {
      console.error("[ai/asr] no transcript returned", result);
      return NextResponse.json(
        { error: "Transcription returned no text. Try a clearer or longer audio clip." },
        { status: 200 }
      );
    }

    try {
      await db.aIHistory.create({
        data: {
          tool: "asr",
          category: "speech",
          prompt: prompt || "Audio transcription",
          response: text,
          model: "whisper",
          favorite: false,
          meta: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }),
        },
      });
    } catch (e) {
      console.error("[ai/asr] failed to save history", e);
    }

    return NextResponse.json({ text });
  } catch (e) {
    console.error("[ai/asr] transcription failed", e);
    return NextResponse.json(
      { error: "Transcription failed, please retry with a different audio file" },
      { status: 200 }
    );
  }
}
