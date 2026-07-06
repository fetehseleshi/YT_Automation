import crypto from "crypto";

/**
 * AES-256-GCM encryption for sensitive OAuth tokens stored at rest.
 * Key derived from TOKEN_ENCRYPTION_KEY or NEXTAUTH_SECRET (32-byte sha256).
 */

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "fallback-dev-key-please-set-env";
  return crypto.createHash("sha256").update(secret).digest();
}

/** Encrypt a plaintext string. Returns a base64 string: iv(12)|tag(16)|ciphertext */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a value produced by encrypt(). Returns plaintext or "" on failure. */
export function decrypt(payload: string): string {
  if (!payload) return "";
  try {
    const key = getKey();
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

/** Generate a cryptographically random token (url-safe base64). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
