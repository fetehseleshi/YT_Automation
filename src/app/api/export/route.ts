import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/export
 *
 * Backup endpoint. Supports `?format=csv|json|xlsx` and optional `?resource=<table>`.
 *
 *  - default / ?format=json → full JSON dump { meta, data, exportedAt, counts }
 *    (with attachment header only when format=json is explicit)
 *  - ?format=csv            → single CSV with sections separated by blank lines
 *  - ?format=xlsx           → CSV-as-XLS (Excel opens it natively) — no heavy deps
 *  - ?resource=channels     → just one table (channels / videos / cards / … )
 *
 * Tables covered (20):
 *   channels, videos, cards, tasks, teamMembers, trends, files,
 *   transactions, goals, habits, notes, bookmarks, readingItems,
 *   workflows, activities, scripts, calendarEvents, notifications,
 *   aiHistory, chatMessages
 */

// ─── Table registry ──────────────────────────────────────────────────────────
// Each entry maps a stable export key to its Prisma delegate.
type Delegate =
  | "channel"
  | "video"
  | "card"
  | "task"
  | "teamMember"
  | "trendItem"
  | "fileAsset"
  | "transaction"
  | "goal"
  | "habit"
  | "note"
  | "bookmark"
  | "readingItem"
  | "workflow"
  | "activity"
  | "script"
  | "calendarEvent"
  | "notification"
  | "aIHistory"
  | "chatMessage";

const TABLES: Array<{ key: string; delegate: Delegate; label: string }> = [
  { key: "channels", delegate: "channel", label: "Channels" },
  { key: "videos", delegate: "video", label: "Videos" },
  { key: "cards", delegate: "card", label: "Cards" },
  { key: "tasks", delegate: "task", label: "Tasks" },
  { key: "teamMembers", delegate: "teamMember", label: "Team Members" },
  { key: "trends", delegate: "trendItem", label: "Trends" },
  { key: "files", delegate: "fileAsset", label: "Files" },
  { key: "transactions", delegate: "transaction", label: "Transactions" },
  { key: "goals", delegate: "goal", label: "Goals" },
  { key: "habits", delegate: "habit", label: "Habits" },
  { key: "notes", delegate: "note", label: "Notes" },
  { key: "bookmarks", delegate: "bookmark", label: "Bookmarks" },
  { key: "readingItems", delegate: "readingItem", label: "Reading Items" },
  { key: "workflows", delegate: "workflow", label: "Workflows" },
  { key: "activities", delegate: "activity", label: "Activities" },
  { key: "scripts", delegate: "script", label: "Scripts" },
  { key: "calendarEvents", delegate: "calendarEvent", label: "Calendar Events" },
  { key: "notifications", delegate: "notification", label: "Notifications" },
  { key: "aiHistory", delegate: "aIHistory", label: "AI History" },
  { key: "chatMessages", delegate: "chatMessage", label: "Chat Messages" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Quote a CSV field per RFC 4180: wrap in double quotes if it contains a
 *  comma, double quote, newline, or carriage return. Escape inner quotes as "". */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === "object") s = JSON.stringify(value);
  else s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",");
}

/** Produce a CSV block for a single table: header row + data rows. */
function tableToCsv(tableName: string, rows: Record<string, unknown>[]): string {
  const lines: string[] = [];
  lines.push(`# ${tableName}`);
  if (rows.length === 0) {
    lines.push(""); // empty header line — still emits the section marker
    return lines.join("\n");
  }
  // Use the union of keys across rows (preserve insertion order from the first row,
  // then add any new keys from subsequent rows).
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  lines.push(csvRow(keys));
  for (const r of rows) {
    lines.push(csvRow(keys.map((k) => r[k])));
  }
  return lines.join("\n");
}

/** Load all rows for every registered table in one Promise.all. */
async function loadAll(): Promise<Record<string, Record<string, unknown>[]>> {
  const entries = await Promise.all(
    TABLES.map(async (t) => {
      // @ts-expect-error — dynamic delegate access on the db client
      const rows: Record<string, unknown>[] = await db[t.delegate].findMany();
      return [t.key, rows] as const;
    })
  );
  return Object.fromEntries(entries);
}

/** Load a single table by export key. Returns null if unknown. */
async function loadOne(
  key: string
): Promise<Record<string, unknown>[] | null> {
  const entry = TABLES.find((t) => t.key === key);
  if (!entry) return null;
  // @ts-expect-error — dynamic delegate access on the db client
  return (await db[entry.delegate].findMany()) as Record<string, unknown>[];
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const format = (req.nextUrl.searchParams.get("format") ?? "").toLowerCase();
    const resource = req.nextUrl.searchParams.get("resource")?.trim();

    // ── Single-table export ────────────────────────────────────────────────
    if (resource) {
      const rows = await loadOne(resource);
      if (rows === null) {
        return NextResponse.json(
          { error: `Unknown resource: ${resource}` },
          { status: 400 }
        );
      }
      const payload = {
        data: { [resource]: rows },
        counts: { [resource]: rows.length },
        exportedAt: new Date().toISOString(),
      };
      if (format === "csv") {
        const csv = tableToCsv(resource, rows);
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${resource}.csv"`,
          },
        });
      }
      return new NextResponse(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${resource}.json"`,
        },
      });
    }

    // ── Full export ────────────────────────────────────────────────────────
    const data = await loadAll();
    const counts: Record<string, number> = {};
    for (const t of TABLES) counts[t.key] = (data[t.key] ?? []).length;
    const exportedAt = new Date().toISOString();

    if (format === "csv" || format === "xlsx") {
      // Sections separated by a single blank line.
      const blocks = TABLES.map((t) =>
        tableToCsv(t.key, (data[t.key] ?? []) as Record<string, unknown>[])
      );
      const csv = blocks.join("\n\n");

      if (format === "xlsx") {
        // Simplest reliable approach: Excel opens CSV-as-XLS just fine.
        // We serve the CSV bytes with an .xls extension and the legacy
        // application/vnd.ms-excel MIME type. No heavy xlsx dep needed.
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.ms-excel; charset=utf-8",
            "Content-Disposition": `attachment; filename="yt-studio-export.xls"`,
          },
        });
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="yt-studio-export.csv"`,
        },
      });
    }

    // JSON (default). When format=json is explicit, we add the attachment
    // header so the browser downloads `yt-studio-export.json`. Without a
    // format param we leave it inline so the Settings stats tab can fetch
    // and parse it transparently.
    const payload = {
      meta: {
        app: "My YT Automation Studio",
        version: "1.0.0",
        exportedAt,
        counts,
      },
      data,
      exportedAt,
      counts,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
    };
    if (format === "json") {
      headers["Content-Disposition"] =
        'attachment; filename="yt-studio-export.json"';
    }
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error("[export] GET error", e);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
