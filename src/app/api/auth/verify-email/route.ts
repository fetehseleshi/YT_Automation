import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeVerifyToken } from "@/lib/auth-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10, "Invalid token"),
});

/** POST /api/auth/verify-email — consume a verification token. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const ok = await consumeVerifyToken(parsed.data.token);
    if (!ok) {
      return NextResponse.json(
        { error: "Verification link is invalid or has expired." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, message: "Email verified successfully." });
  } catch (e) {
    console.error("[verify-email] error", e);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
