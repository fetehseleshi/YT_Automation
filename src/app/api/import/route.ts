import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

/**
 * POST /api/import
 *
 * Body: { format: "json" | "csv", data: string | object, replace?: boolean }
 *
 *  - JSON: parse the export payload (either our `{ meta, data, exportedAt }`
 *    shape or a bare `{ <table>: [...] }` object). For each table present,
 *    strip `id` (and let Prisma reissue one), then:
 *       replace=true  → deleteMany({}) then createMany({data})
 *       replace=false → createMany({data})  (append, default)
 *  - CSV : parse the multi-section CSV produced by /api/export?format=csv.
 *    Each `# TableName` marker starts a new block; the next non-blank line
 *    is the column header, and subsequent rows are data. Map column names
 *    to model fields case-insensitively. Skip rows that fail to coerce.
 *
 * Returns: { ok, counts: { <table>: n, ... } }
 *
 * Write endpoint — requires an authenticated session.
 */

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

const TABLES: Array<{ key: string; delegate: Delegate }> = [
  { key: "channels", delegate: "channel" },
  { key: "videos", delegate: "video" },
  { key: "cards", delegate: "card" },
  { key: "tasks", delegate: "task" },
  { key: "teamMembers", delegate: "teamMember" },
  { key: "trends", delegate: "trendItem" },
  { key: "files", delegate: "fileAsset" },
  { key: "transactions", delegate: "transaction" },
  { key: "goals", delegate: "goal" },
  { key: "habits", delegate: "habit" },
  { key: "notes", delegate: "note" },
  { key: "bookmarks", delegate: "bookmark" },
  { key: "readingItems", delegate: "readingItem" },
  { key: "workflows", delegate: "workflow" },
  { key: "activities", delegate: "activity" },
  { key: "scripts", delegate: "script" },
  { key: "calendarEvents", delegate: "calendarEvent" },
  { key: "notifications", delegate: "notification" },
  { key: "aiHistory", delegate: "aIHistory" },
  { key: "chatMessages", delegate: "chatMessage" },
];

const TABLE_KEYS = new Set(TABLES.map((t) => t.key));
const DELEGATE_FOR: Record<string, Delegate> = Object.fromEntries(
  TABLES.map((t) => [t.key, t.delegate])
);

// ─── CSV parsing (RFC 4180, quoted fields with embedded "" escapes) ──────────

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  let current = "";
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      out.push(current);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  out.push(current);
  return out;
}

/** Parse a multi-section CSV string into { tableName: rows[] }.
 *  Each section begins with a `# TableName` marker line. The next non-blank
 *  line is the header; subsequent non-blank lines are data rows. */
function parseMultiSectionCsv(csv: string): Record<string, Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};
  // Normalise line endings, then split.
  const lines = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let currentTable: string | null = null;
  let header: string[] | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      // blank line — section separator; reset header
      header = null;
      continue;
    }
    if (line.startsWith("# ")) {
      currentTable = line.slice(2).trim();
      // Normalise to a known table key if possible (case-insensitive).
      const matched = TABLE_KEYS.has(currentTable)
        ? currentTable
        : TABLES.find(
            (t) => t.key.toLowerCase() === currentTable!.toLowerCase()
          )?.key ?? null;
      currentTable = matched;
      header = null;
      if (currentTable && !result[currentTable]) result[currentTable] = [];
      continue;
    }
    if (!currentTable) {
      // Skip orphan rows before any # marker.
      continue;
    }
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    const cells = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    header.forEach((h, idx) => {
      // Map header name to model field case-insensitively.
      const fieldName = h.trim();
      if (!fieldName) return;
      row[fieldName] = cells[idx] ?? "";
    });
    result[currentTable]!.push(row);
  }
  return result;
}

// ─── Coercion helpers ────────────────────────────────────────────────────────

/** Coerce a CSV string value into a value Prisma will accept for the field.
 *  Tries to parse Date / Boolean / Number; falls back to string. */
function coerce(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (s === "") return "";
  // ISO date — restore as Date so Prisma persists a DateTime.
  const isoMatch = s.match(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
  );
  if (isoMatch) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  if (s === "true") return true;
  if (s === "false") return false;
  // Number? (avoid stripping leading zeros from strings like "007" — only
  // convert if it looks like a plain number with optional sign/decimal.)
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return s;
}

/** Strip fields Prisma shouldn't accept on createMany (id + relations). */
function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const lk = k.toLowerCase();
    if (lk === "id") continue;
    out[k] = coerce(v);
  }
  return out;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Write endpoint — protect with a session check.
  const session = await getSessionUser();
  if (!session) return errorResponse("Unauthorized", 401);

  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const format = String(body.format ?? "json").toLowerCase();
    const replace = body.replace === true;
    const dataField = body.data;

    if (dataField === undefined || dataField === null) {
      return errorResponse("Missing `data` field in payload", 400);
    }

    let tables: Record<string, Record<string, unknown>[]>;
    if (format === "csv") {
      if (typeof dataField !== "string") {
        return errorResponse(
          "CSV import expects `data` to be a string",
          400
        );
      }
      try {
        tables = parseMultiSectionCsv(dataField);
      } catch (e) {
        return errorResponse(
          `CSV parse error: ${e instanceof Error ? e.message : "unknown"}`,
          400
        );
      }
    } else if (format === "json") {
      // Accept either a string (parse it) or an already-parsed object.
      let parsed: unknown = dataField;
      if (typeof dataField === "string") {
        try {
          parsed = JSON.parse(dataField);
        } catch (e) {
          return errorResponse(
            `JSON parse error: ${e instanceof Error ? e.message : "unknown"}`,
            400
          );
        }
      }
      // Accept either our export shape { meta, data, exportedAt } or a bare
      // { <table>: [...] } object.
      const maybeData = (parsed as { data?: unknown })?.data;
      if (maybeData && typeof maybeData === "object") {
        parsed = maybeData;
      }
      if (!parsed || typeof parsed !== "object") {
        return errorResponse("Invalid backup payload", 400);
      }
      tables = parsed as Record<string, Record<string, unknown>[]>;
    } else {
      return errorResponse(
        `Unsupported format: ${format}. Use "json" or "csv".`,
        400
      );
    }

    // Filter to known tables + array-shaped values only.
    const toRestore = Object.entries(tables).filter(
      ([k, v]) => TABLE_KEYS.has(k) && Array.isArray(v)
    );

    if (toRestore.length === 0) {
      return errorResponse(
        "No known tables found in payload. Expected keys like `channels`, `videos`, etc.",
        400
      );
    }

    const counts: Record<string, number> = {};

    // Wrap in a transaction so a failure rolls everything back.
    await db.$transaction(async (tx) => {
      if (replace) {
        // Delete in reverse order to respect FK relations.
        for (const [key] of [...toRestore].reverse()) {
          const delegate = DELEGATE_FOR[key]!;
          // @ts-expect-error — dynamic delegate access on the tx client
          await tx[delegate].deleteMany({});
        }
      }
      for (const [key, rows] of toRestore) {
        const delegate = DELEGATE_FOR[key]!;
        const sanitized = rows.map(sanitizeRow);
        if (sanitized.length === 0) {
          counts[key] = 0;
          continue;
        }
        try {
          // @ts-expect-error — dynamic delegate access on the tx client
          await tx[delegate].createMany({ data: sanitized });
          counts[key] = sanitized.length;
        } catch (e) {
          console.error(`[import] createMany failed for ${key}`, e);
          counts[key] = 0;
        }
      }
    });

    return NextResponse.json({
      ok: true,
      counts,
      mode: replace ? "replace" : "append",
      importedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[import] POST error", e);
    const msg = e instanceof Error ? e.message : "Failed to import data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
