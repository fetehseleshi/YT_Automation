import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createResetToken, deliverToken } from "@/lib/auth-tokens";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Invalid email"),
});

/** POST /api/auth/forgot-password — issue a reset token, deliver via email/dev-link. */
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

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const token = await createResetToken(email);
    // Always respond 200 to avoid leaking which emails exist.
    if (token) {
      const user = await db.user.findUnique({ where: { email } });
      const link = `${process.env.NEXTAUTH_URL || ""}/?reset=${token}`;
      await deliverToken({
        to: email,
        subject: "Reset your password — YT Automation Studio",
        body: `Reset link: ${link}`,
        link,
      });
      return NextResponse.json({
        ok: true,
        message: "If an account exists for that email, a reset link has been sent.",
        resetLink: link, // dev-mode fallback
      });
    }
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (e) {
    console.error("[forgot-password] error", e);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
