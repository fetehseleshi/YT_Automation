import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { googleAuthEnabled } from "@/lib/auth";

/** GET /api/auth/check — returns auth status + google availability + email-verified flag. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      googleEnabled: googleAuthEnabled,
    });
  }
  const userId = (session.user as any)?.id;
  let emailVerified = false;
  if (userId) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
    emailVerified = !!u?.emailVerified;
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: userId,
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
      image: (session.user as any)?.image ?? null,
      emailVerified,
    },
    googleEnabled: googleAuthEnabled,
  });
}
