"use client";

import * as React from "react";
import { useSession, signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useSearchParams } from "next/navigation";

type View = "login" | "register" | "forgot" | "reset" | "verify";

/** Gate that shows the auth overlay when unauthenticated. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  return (
    <>
      {children}
      <AnimatePresence>
        {!loading && !session && (
          <React.Suspense fallback={null}>
            <AuthOverlay />
          </React.Suspense>
        )}
      </AnimatePresence>
    </>
  );
}

function AuthOverlay() {
  const search = useSearchParams();
  const [view, setView] = React.useState<View>(() => {
    if (search.get("reset")) return "reset";
    if (search.get("verify")) return "verify";
    return "login";
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] grid place-items-center p-4 bg-background/80 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="w-full max-w-md"
      >
        <div className="glass-strong rounded-3xl border border-border/60 shadow-2xl overflow-hidden">
          <BrandHeader />
          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
              >
                {view === "login" && <LoginForm onForgot={() => setView("forgot")} onRegister={() => setView("register")} />}
                {view === "register" && <RegisterForm onLogin={() => setView("login")} />}
                {view === "forgot" && <ForgotForm onBack={() => setView("login")} />}
                {view === "reset" && <ResetForm token={search.get("reset") || ""} onDone={() => setView("login")} />}
                {view === "verify" && <VerifyForm token={search.get("verify") || ""} onDone={() => setView("login")} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BrandHeader() {
  return (
    <div className="relative px-6 pt-7 pb-5 text-center overflow-hidden">
      <div className="absolute -top-16 -left-10 size-40 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -top-10 -right-10 size-40 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="relative size-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 grid place-items-center shadow-lg shadow-emerald-500/40 mb-3">
        <Icon name="youtube" className="size-7 text-white" />
      </div>
      <h1 className="text-xl font-bold tracking-tight">YT Automation Studio</h1>
      <p className="text-sm text-muted-foreground mt-1">Your complete YouTube operating system</p>
    </div>
  );
}

// ─── Login ─────────────────────────────────────────────────────────────────
function LoginForm({ onForgot, onRegister }: { onForgot: () => void; onRegister: () => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [googleEnabled, setGoogleEnabled] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.googleEnabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setBusy(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        remember: remember ? "true" : "false",
        redirect: false,
      });
      if (!res || res.error) {
        // NextAuth wraps authorize() errors into res.error generic string
        const msg = res?.error || "Invalid email or password";
        toast.error(msg);
      } else {
        toast.success("Welcome back!");
      }
    } catch (e: any) {
      toast.error(e.message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (e: any) {
      toast.error(e.message || "Google sign in failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Email" id="email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button type="button" onClick={onForgot} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={show ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            aria-label={show ? "Hide password" : "Show password"}
          >
            <Icon name={show ? "eye" : "circle"} className="size-4" />
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
        <span className="text-muted-foreground">Remember me for 30 days</span>
      </label>

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <><Icon name="refresh" className="size-4 mr-1 animate-spin" /> Signing in…</> : "Sign in"}
      </Button>

      {googleEnabled && (
        <>
          <Divider />
          <Button type="button" variant="outline" className="w-full" onClick={googleSignIn} disabled={busy}>
            <GoogleIcon className="size-4 mr-2" /> Continue with Google
          </Button>
        </>
      )}

      <p className="text-center text-sm text-muted-foreground pt-1">
        No account?{" "}
        <button type="button" onClick={onRegister} className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
          Create one
        </button>
      </p>

      <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3 text-center">
        <p className="text-xs text-muted-foreground">Demo credentials</p>
        <p className="text-xs font-mono mt-1 text-emerald-600 dark:text-emerald-400">creator@studio.io · studio123</p>
      </div>
    </form>
  );
}

// ─── Register ──────────────────────────────────────────────────────────────
function RegisterForm({ onLogin }: { onLogin: () => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [verifyLink, setVerifyLink] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    if (!email) return toast.error("Email is required");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const res: any = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      toast.success("Account created! Check your email to verify.");
      if (res.verifyLink) setVerifyLink(res.verifyLink);
    } catch (e: any) {
      toast.error(e.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (verifyLink) {
    return (
      <div className="text-center space-y-3 py-2">
        <div className="size-12 mx-auto rounded-2xl bg-emerald-500/10 grid place-items-center">
          <Icon name="check-circle-2" className="size-6 text-emerald-500" />
        </div>
        <p className="font-semibold">Verify your email</p>
        <p className="text-sm text-muted-foreground">We sent a verification link. In this demo environment, use this secure link:</p>
        <Button className="w-full" onClick={() => { window.location.href = verifyLink; }}>
          Open verification link
        </Button>
        <Button variant="ghost" className="w-full" onClick={onLogin}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Name" id="name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
      <Field label="Email" id="remail" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
      <Field label="Password" id="rpassword" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" hint="Min 8 chars, 1 uppercase + 1 number" />
      <Field label="Confirm password" id="confirm" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" autoComplete="new-password" />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <><Icon name="refresh" className="size-4 mr-1 animate-spin" /> Creating…</> : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground pt-1">
        Already have an account?{" "}
        <button type="button" onClick={onLogin} className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
          Sign in
        </button>
      </p>
    </form>
  );
}

// ─── Forgot password ───────────────────────────────────────────────────────
function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [resetLink, setResetLink] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return toast.error("Email is required");
    setBusy(true);
    try {
      const res: any = await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success("If that email exists, a reset link has been sent.");
      if (res.resetLink) setResetLink(res.resetLink);
    } catch (e: any) {
      toast.error(e.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (resetLink) {
    return (
      <div className="text-center space-y-3 py-2">
        <div className="size-12 mx-auto rounded-2xl bg-amber-500/10 grid place-items-center">
          <Icon name="mail" className="size-6 text-amber-500" />
        </div>
        <p className="font-semibold">Reset link ready</p>
        <p className="text-sm text-muted-foreground">In this demo environment, use this secure link:</p>
        <Button className="w-full" onClick={() => { window.location.href = resetLink; }}>Open reset link</Button>
        <Button variant="ghost" className="w-full" onClick={onBack}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="text-center mb-2">
        <p className="font-semibold">Reset your password</p>
        <p className="text-sm text-muted-foreground">Enter your email and we'll send a reset link.</p>
      </div>
      <Field label="Email" id="femail" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <><Icon name="refresh" className="size-4 mr-1 animate-spin" /> Sending…</> : "Send reset link"}
      </Button>
      <button type="button" onClick={onBack} className="w-full text-sm text-muted-foreground hover:text-foreground">
        ← Back to sign in
      </button>
    </form>
  );
}

// ─── Reset password ────────────────────────────────────────────────────────
function ResetForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      toast.success("Password reset! You can now sign in.");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="text-center mb-2">
        <p className="font-semibold">Set a new password</p>
        <p className="text-sm text-muted-foreground">Choose a strong password for your account.</p>
      </div>
      <Field label="New password" id="npass" type="password" value={password} onChange={setPassword} placeholder="••••••••" hint="Min 8 chars, 1 uppercase + 1 number" />
      <Field label="Confirm password" id="cpass" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <><Icon name="refresh" className="size-4 mr-1 animate-spin" /> Resetting…</> : "Reset password"}
      </Button>
    </form>
  );
}

// ─── Verify email ──────────────────────────────────────────────────────────
function VerifyForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        await api("/api/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        toast.success("Email verified! You can now sign in.");
        onDone();
      } catch (e: any) {
        toast.error(e.message || "Verification failed");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <div className="text-center space-y-3 py-6">
      <div className="size-12 mx-auto rounded-2xl bg-emerald-500/10 grid place-items-center">
        <Icon name="refresh" className="size-6 text-emerald-500 animate-spin" />
      </div>
      <p className="font-semibold">Verifying your email…</p>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function Field({
  label, id, type = "text", value, onChange, placeholder, autoComplete, hint,
}: {
  label: string; id: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px bg-border flex-1" />
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">or</span>
      <div className="h-px bg-border flex-1" />
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
