import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";

/** Standard JSON error response. */
export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Standard JSON success response. */
export function successResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Parse + validate a JSON body against a zod schema. Returns {data|error}. */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ data: T } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: errorResponse("Invalid JSON body", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: errorResponse(msg, 400) };
  }
  return { data: parsed.data };
}

/**
 * Require an authenticated session. Returns the session user or an error response.
 * Usage:
 *   const auth = await requireAuth();
 *   if ("error" in auth) return auth.error;
 *   // use auth.session
 */
export async function requireAuth(): Promise<
  | { session: NonNullable<Awaited<ReturnType<typeof getSessionUser>>> }
  | { error: NextResponse }
> {
  const session = await getSessionUser();
  if (!session) {
    return { error: errorResponse("Authentication required", 401) };
  }
  return { session };
}

/** Whitelist a string against an allowed set (case-insensitive), fallback to default. */
export function clampString(value: unknown, allowed: string[], fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

/** Clamp a number to a range. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
