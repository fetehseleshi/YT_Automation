import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** The 10 standard pipeline stages every new workflow starts with. */
export const STANDARD_STAGES = [
  "Idea",
  "Research",
  "Script",
  "Voiceover",
  "Editing",
  "Thumbnail",
  "SEO",
  "Upload",
  "Publish",
  "Analytics",
] as const;

export function buildStagesJson(): string {
  return JSON.stringify(
    STANDARD_STAGES.map((label) => ({
      key: label.toLowerCase(),
      label,
      done: false,
    }))
  );
}

/** GET /api/workflows — list all workflows, newest first. */
export async function GET() {
  try {
    const workflows = await db.workflow.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ workflows });
  } catch (e) {
    console.error("[workflows] GET error", e);
    return NextResponse.json(
      { error: "Failed to load workflows" },
      { status: 500 }
    );
  }
}

/** POST /api/workflows — create a new workflow.
 *  Required: name. Optional: videoTitle, channelName.
 *  Initializes stages JSON to the 10 standard stages all `done:false`,
 *  progress=0, status="active". */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v : fallback;

    const name = str(body.name).trim();
    if (!name) {
      return NextResponse.json(
        { error: "Workflow name is required" },
        { status: 400 }
      );
    }

    const workflow = await db.workflow.create({
      data: {
        name,
        videoTitle: str(body.videoTitle).trim(),
        channelName: str(body.channelName).trim(),
        stages: buildStagesJson(),
        progress: 0,
        status: "active",
      },
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (e) {
    console.error("[workflows] POST error", e);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}
