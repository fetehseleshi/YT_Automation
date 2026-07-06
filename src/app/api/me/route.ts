import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ user: null, authenticated: false });
  }
  return NextResponse.json({
    user: {
      id: (session.user as any)?.id ?? null,
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
      image: (session.user as any)?.image ?? null,
    },
    authenticated: true,
  });
}
