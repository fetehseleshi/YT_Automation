import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ notifications: [], unread: 0 });

  const notifications = await db.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const unread = await db.notification.count({ where: { read: false } });
  return NextResponse.json({ notifications, unread });
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

  const { action } = body;
  if (action === "markAllRead") {
    await db.notification.updateMany({ where: { read: false }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }
  if (action === "markRead" && body.id) {
    await db.notification.update({ where: { id: body.id }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }
  if (action === "clearAll") {
    await db.notification.deleteMany({});
    return NextResponse.json({ ok: true });
  }
  // Create
  const { title, message, type = "info", section = "dashboard" } = body;
  if (!title || !message) {
    return NextResponse.json({ error: "title and message required" }, { status: 400 });
  }
  const n = await db.notification.create({
    data: { title, message, type, section },
  });
  return NextResponse.json(n, { status: 201 });
}
