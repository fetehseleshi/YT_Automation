import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createVerifyToken, deliverToken } from "@/lib/auth-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100)
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[0-9]/, "Include at least one number"),
});

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

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: { name, email: normalizedEmail, passwordHash },
    });

    // Issue email verification token
    const token = await createVerifyToken(user.id);
    const link = `${process.env.NEXTAUTH_URL || ""}/?verify=${token}`;
    const delivery = await deliverToken({
      to: user.email,
      subject: "Verify your email — YT Automation Studio",
      body: `Welcome ${name}! Click the link to verify your email: ${link}`,
      link,
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
      verifyLink: delivery.devLink, // surfaced in dev mode (no email server)
      emailSent: delivery.delivered,
    });
  } catch (e) {
    console.error("[register] error", e);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
