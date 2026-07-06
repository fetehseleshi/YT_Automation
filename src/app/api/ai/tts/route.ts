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

const ALLOWED_VOICES = [
  "tongtong", // warm, default
  "chuichui",
  "xiaochen",
  "jam",
  "kazi",
  "douji",
  "luodo",
];

const DEFAULT_VOICE = "tongtong";

/** Kokoro's PCM is 16-bit signed LE mono at 24kHz. Wrap raw PCM in a 44-byte
 *  WAV header so browsers can play it via <audio>. */
function wrapPcmInWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcm.byteLength;
  const header = Buffer.alloc(44);
  let offset = 0;
  header.write("RIFF", offset); offset += 4;
  header.writeUInt32LE(36 + dataSize, offset); offset += 4;
  header.write("WAVE", offset); offset += 4;
  header.write("fmt ", offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4;
  header.writeUInt16LE(1, offset); offset += 2; // PCM
  header.writeUInt16LE(channels, offset); offset += 2;
  header.writeUInt32LE(sampleRate, offset); offset += 4;
  header.writeUInt32LE(byteRate, offset); offset += 4;
  header.writeUInt16LE(blockAlign, offset); offset += 2;
  header.writeUInt16LE(bitsPerSample, offset); offset += 2;
  header.write("data", offset); offset += 4;
  header.writeUInt32LE(dataSize, offset); offset += 4;
  return Buffer.concat([header, pcm], 44 + dataSize);
}

/** POST /api/ai/tts — Kokoro-equivalent text-to-speech.
 *  Body: { text, voice?, speed?, pitch? }
 *  Writes the resulting audio to /public/uploads and returns its URL. */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body?.text ?? "").toString().trim();
  if (!text) {
    return NextResponse.json(
      { error: "Text is required" },
      { status: 400 }
    );
  }
  if (text.length > 3000) {
    return NextResponse.json(
      { error: "Text is too long (max 3000 characters)" },
      { status: 400 }
    );
  }

  const voice = ALLOWED_VOICES.includes(String(body?.voice).toLowerCase())
    ? String(body!.voice).toLowerCase()
    : DEFAULT_VOICE;

  const rawSpeed = Number(body?.speed);
  const speed = Number.isFinite(rawSpeed) && rawSpeed >= 0.5 && rawSpeed <= 2
    ? rawSpeed
    : 1;

  // pitch is accepted for forward-compat but the SDK may not support it.
  const pitch = Number.isFinite(Number(body?.pitch)) ? Number(body!.pitch) : 0;
  const ttsBody: Record<string, unknown> = {
    input: text,
    voice,
    speed,
  };
  if (pitch !== 0) ttsBody.pitch = pitch;

  try {
    const zai = await ZAI.create();
    // SDK returns the raw fetch Response object for audio.tts.create.
    const response: Response = await zai.audio.tts.create(ttsBody as any);
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[ai/tts] upstream non-ok", response.status, errText);
      return NextResponse.json(
        { error: "Voiceover generation failed, please retry" },
        { status: 200 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer || buffer.length === 0) {
      console.error("[ai/tts] empty audio buffer");
      return NextResponse.json(
        { error: "Voiceover generation failed, please retry" },
        { status: 200 }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const isWav = contentType.includes("wav") || buffer.slice(0, 4).toString("ascii") === "RIFF";
    const isPcm = contentType.includes("pcm");
    // Always save as .wav — browsers play it natively.
    const finalBuffer = isWav ? buffer : isPcm ? wrapPcmInWav(buffer) : buffer;

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const id = createId();
    const fileName = `tts-${id}.wav`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, finalBuffer);

    const url = `/uploads/${fileName}`;

    try {
      await db.aIHistory.create({
        data: {
          tool: "tts",
          category: "audio",
          prompt: text.slice(0, 200),
          response: "Generated audio",
          model: "kokoro-tts",
          favorite: false,
          meta: JSON.stringify({ url, voice, speed, chars: text.length, format: "wav" }),
        },
      });
    } catch (e) {
      console.error("[ai/tts] failed to save history", e);
    }

    return NextResponse.json({ url, voice, speed, chars: text.length });
  } catch (e) {
    console.error("[ai/tts] generation failed", e);
    return NextResponse.json(
      { error: "Voiceover generation failed, please retry" },
      { status: 200 }
    );
  }
}
