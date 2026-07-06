import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createVerifyToken, deliverToken } from "@/lib/auth-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/resend-verification — re-issue a verification token for the logged-in user. */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "Session invalid" }, { status: 401 });

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true, message: "Email already verified." });
    }

    const token = await createVerifyToken(user.id);
    const link = `${process.env.NEXTAUTH_URL || ""}/?verify=${token}`;
    const delivery = await deliverToken({
      to: user.email,
      subject: "Verify your email — YT Automation Studio",
      body: `Verify link: ${link}`,
      link,
    });

    return NextResponse.json({
      ok: true,
      message: "Verification email sent.",
      verifyLink: delivery.devLink,
      emailSent: delivery.delivered,
    });
  } catch (e) {
    console.error("[resend-verification] error", e);
    return NextResponse.json({ error: "Failed to resend verification" }, { status: 500 });
  }
}
