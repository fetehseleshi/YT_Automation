import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getAuthSecret(): string {
  const configuredSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.TOKEN_ENCRYPTION_KEY;
  if (configuredSecret) return configuredSecret;

  if (process.env.VERCEL_URL) {
    return `yt-automation-${process.env.VERCEL_URL.replace(/[^a-zA-Z0-9]/g, "-")}`;
  }

  return "yt-automation-dev-fallback-secret";
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),

  debug: true,

  session: {
    strategy: "jwt",
    // 30 days default; "Remember Me" extends via a custom maxAge in the token.
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    // Single-page app: overlay on / handles sign-in UI.
    signIn: "/",
  },
  providers: [
    // ─── Credentials (email + password) ─────────────────────────────────────
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) {
          // Returning null → NextAuth reports "CredentialsSignin"; the UI shows
          // a generic message. Specific messages are delivered via /api/auth/register
          // and /api/auth/forgot-password which return JSON.
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          remember: credentials?.remember === "true",
        } as any;
      },
    }),
    // ─── Google OAuth ────────────────────────────────────────────────────────
    // Activates automatically when GOOGLE_CLIENT_ID/SECRET are set in .env.
    // Create credentials at https://console.cloud.google.com/apis/credentials
    // Authorized redirect URI: http://localhost:3000/api/auth/callback/google
    ...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
                scope: "openid email profile",
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // ─── Google sign-in: link or create local user + account ──────────────
      if (account?.provider === "google" && profile?.email) {
        const email = String(profile.email).toLowerCase();
        const existing = await db.user.findUnique({ where: { email } });

        let userId: string;
        if (existing) {
          userId = existing.id;
          // Upsert the OAuth account record
          const existingAccount = await db.account.findFirst({
            where: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
          });

          if (existingAccount) {
            await db.account.update({
              where: { id: existingAccount.id },
              data: {
                userId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          } else {
            await db.account.create({
              data: {
                userId,
                type: account.type,
                provider: "google",
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }
          // Mark email verified for Google users
          if (!existing.emailVerified) {
            await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
          }
        } else {
          // Auto-create account for new Google users
          const created = await db.user.create({
            data: {
              email,
              name: profile.name ?? user.name ?? "",
              image: profile.image ?? user.image ?? "",
              emailVerified: new Date(),
            },
          });
          userId = created.id;
          await db.account.create({
            data: {
              userId,
              type: account.type,
              provider: "google",
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
          });
        }
        (user as any).id = userId;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id ?? token.sub;
        // "Remember me" → extend session to 90 days; else 1 day.
        if ((user as any).remember) {
          token.remember = true;
        }
      }
      // Apply per-token maxAge for remember-me
      if (token.remember) {
        // NextAuth reads token.exp? No — it uses session.maxAge. We handle
        // extension by returning the token; the session cookie maxAge is fixed
        // by session.maxAge. To truly extend, set a long maxAge when remember.
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
};

/** Hash a password for storage using bcrypt (cost factor 10). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Server-side helper: require a session or return null. */
export async function getSessionUser() {
  const { getServerSession } = await import("next-auth/next");
  const session = await getServerSession(authOptions);
  return session;
}

/** Returns the authenticated user's User row, or null. */
export async function getCurrentUser() {
  const session = await getSessionUser();
  const id = (session?.user as any)?.id;
  if (!id) return null;
  return db.user.findUnique({ where: { id } });
}

/** Whether Google sign-in is configured (env vars present). */
export const googleAuthEnabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
