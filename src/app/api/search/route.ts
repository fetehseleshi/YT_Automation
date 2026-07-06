import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/search?q=<query>
 *
 * Global search across all major content types. Returns a flat list of
 * { id, title, subtitle, type, section } results.
 *
 * Types searched:
 *   - Channels       (name / niche)        → section "channels"
 *   - Videos         (title)               → section "videos"
 *   - Tasks          (title)               → section "tasks"
 *   - Trends         (topic / keyword)     → section "research"
 *   - Scripts        (title / content)     → section "videos"   (no scripts nav)
 *   - Notes          (title / content)     → section "extras"
 *   - FileAssets     (name / tags / folder)→ section "files"
 *   - Bookmarks      (title / url)         → section "extras"
 *   - ReadingItems   (title)               → section "extras"
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  type Result = {
    id: string;
    title: string;
    subtitle: string;
    type: string;
    section: string;
  };
  const results: Result[] = [];

  try {
    const [
      channels,
      videos,
      tasks,
      trends,
      scripts,
      notes,
      files,
      bookmarks,
      reading,
    ] = await Promise.all([
      db.channel.findMany({
        where: {
          OR: [{ name: { contains: q } }, { niche: { contains: q } }],
        },
        take: 3,
      }),
      db.video.findMany({
        where: { title: { contains: q } },
        take: 4,
        include: { channel: true },
      }),
      db.task.findMany({
        where: { title: { contains: q } },
        take: 3,
      }),
      db.trendItem.findMany({
        where: {
          OR: [{ topic: { contains: q } }, { keyword: { contains: q } }],
        },
        take: 3,
      }),
      db.script.findMany({
        where: {
          OR: [{ title: { contains: q } }, { content: { contains: q } }],
        },
        take: 3,
      }),
      db.note.findMany({
        where: {
          OR: [{ title: { contains: q } }, { content: { contains: q } }],
        },
        take: 3,
      }),
      db.fileAsset.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { tags: { contains: q } },
            { folder: { contains: q } },
          ],
        },
        take: 3,
      }),
      db.bookmark.findMany({
        where: {
          OR: [{ title: { contains: q } }, { url: { contains: q } }],
        },
        take: 3,
      }),
      db.readingItem.findMany({
        where: { title: { contains: q } },
        take: 3,
      }),
    ]);

    channels.forEach((c) =>
      results.push({
        id: c.id,
        title: c.name,
        subtitle: `${c.niche} · ${c.subscribers.toLocaleString()} subs`,
        type: "Channel",
        section: "channels",
      })
    );
    videos.forEach((v) =>
      results.push({
        id: v.id,
        title: v.title,
        subtitle: v.channel?.name ?? "Unassigned",
        type: "Video",
        section: "videos",
      })
    );
    tasks.forEach((t) =>
      results.push({
        id: t.id,
        title: t.title,
        subtitle: `${t.priority} · ${t.status}`,
        type: "Task",
        section: "tasks",
      })
    );
    trends.forEach((t) =>
      results.push({
        id: t.id,
        title: t.topic,
        subtitle: `${t.searchVolume.toLocaleString()} searches/mo`,
        type: "Trend",
        section: "research",
      })
    );
    scripts.forEach((s) =>
      results.push({
        id: s.id,
        title: s.title || "Untitled script",
        subtitle: s.folder
          ? `${s.folder} · ${s.wordCount} words`
          : `${s.wordCount} words`,
        type: "Script",
        section: "videos",
      })
    );
    notes.forEach((n) =>
      results.push({
        id: n.id,
        title: n.title || n.content.slice(0, 40) || "Untitled note",
        subtitle: n.pinned ? "Pinned note" : "Note",
        type: "Note",
        section: "extras",
      })
    );
    files.forEach((f) =>
      results.push({
        id: f.id,
        title: f.name,
        subtitle: `${f.type} · ${f.folder || "General"}`,
        type: "File",
        section: "files",
      })
    );
    bookmarks.forEach((b) =>
      results.push({
        id: b.id,
        title: b.title,
        subtitle: b.url,
        type: "Bookmark",
        section: "extras",
      })
    );
    reading.forEach((r) =>
      results.push({
        id: r.id,
        title: r.title,
        subtitle: `${r.status} · ${r.category}`,
        type: "Reading",
        section: "extras",
      })
    );
  } catch (e) {
    console.error("search error", e);
  }

  return NextResponse.json({ results });
}
