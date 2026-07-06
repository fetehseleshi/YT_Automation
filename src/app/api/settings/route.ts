import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const USER_ID = "local"; // single-user personal dashboard

export async function GET() {
  const rows = await db.setting.findMany({ where: { userId: USER_ID } });
  const settings: Record<string, string> = {};
  rows.forEach((r) => (settings[r.key] = r.value));
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates = body?.updates;
  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "updates object required" }, { status: 400 });
  }

  const ops = Object.entries(updates).map(([key, value]) =>
    db.setting.upsert({
      where: { userId_key: { userId: USER_ID, key } },
      update: { value: String(value) },
      create: { userId: USER_ID, key, value: String(value) },
    })
  );
  await Promise.all(ops);
  return NextResponse.json({ ok: true });
}
