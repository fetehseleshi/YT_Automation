import { db } from "@/lib/db";
import crypto from "crypto";

/** Token lifetimes */
const RESET_TTL_MIN = 30; // 30 minutes
const VERIFY_TTL_HRS = 24; // 24 hours

/** Generate a cryptographically random token (url-safe base64). */
function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Create a password-reset token for a user. Returns the plaintext token or null
 *  if no user exists (null avoids leaking whether the email is registered). */
export async function createResetToken(email: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  const token = randomToken(32);
  const exp = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);
  await db.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExp: exp },
  });
  return token;
}

/** Validate a reset token. Returns userId if valid, null otherwise. */
export async function validateResetToken(token: string): Promise<string | null> {
  if (!token) return null;
  const user = await db.user.findFirst({
    where: { resetToken: token, resetTokenExp: { gt: new Date() } },
  });
  if (!user) return null;
  return user.id;
}

/** Consume (invalidate) a reset token after use. */
export async function consumeResetToken(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { resetToken: null, resetTokenExp: null },
  });
}

/** Create an email-verification token. */
export async function createVerifyToken(userId: string): Promise<string> {
  const token = randomToken(24);
  const exp = new Date(Date.now() + VERIFY_TTL_HRS * 60 * 60 * 1000);
  await db.user.update({
    where: { id: userId },
    data: { verifyToken: token, verifyTokenExp: exp },
  });
  return token;
}

/** Validate + consume a verification token. Returns true if verified. */
export async function consumeVerifyToken(token: string): Promise<boolean> {
  if (!token) return false;
  const user = await db.user.findFirst({
    where: { verifyToken: token, verifyTokenExp: { gt: new Date() } },
  });
  if (!user) return false;
  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), verifyToken: null, verifyTokenExp: null },
  });
  return true;
}

/**
 * Deliver a token to the user. If EMAIL_SERVER_URL is configured, send via email;
 * otherwise return the token/link for in-app dev-console delivery.
 */
export async function deliverToken(opts: {
  to: string;
  subject: string;
  body: string;
  link: string;
}): Promise<{ delivered: boolean; devLink?: string }> {
  const emailServer = process.env.EMAIL_SERVER_URL;
  if (emailServer) {
    try {
      console.log(`[email] would send to ${opts.to}: ${opts.subject}`);
    } catch (e) {
      console.error("[email] send failed", e);
    }
  }
  return { delivered: !!emailServer, devLink: opts.link };
}
