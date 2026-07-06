import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { validateResetToken, consumeResetToken } from "@/lib/auth-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10, "Invalid token"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[0-9]/, "Include at least one number"),
});

/** POST /api/auth/reset-password — validate token + set new password. */
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

  const { token, password } = parsed.data;

  try {
    const userId = await validateResetToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "Reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await consumeResetToken(userId);

    return NextResponse.json({ ok: true, message: "Password reset successfully. You can now sign in." });
  } catch (e) {
    console.error("[reset-password] error", e);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
