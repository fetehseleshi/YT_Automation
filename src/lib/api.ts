/** Shared client-side fetch helpers with retry + error handling. */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Fetch wrapper with automatic retry on network errors and structured error.
 * Throws ApiError on non-2xx (after retries exhausted on 5xx/network).
 */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { retries?: number }
): Promise<T> {
  const retries = init?.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Don't retry 4xx (client errors) — they won't succeed
        if (res.status >= 400 && res.status < 500) {
          throw new ApiError(text || `Request failed (${res.status})`, res.status);
        }
        // 5xx — retry
        throw new ApiError(text || `Server error (${res.status})`, res.status);
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        return (await res.json()) as Promise<T>;
      }
      return (await res.text()) as unknown as Promise<T>;
    } catch (e) {
      lastErr = e;
      // Don't retry 4xx client errors
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        throw e;
      }
      // Network / 5xx — wait then retry
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request failed");
}

/** Upload a file via multipart (does not set Content-Type; browser sets boundary). */
export async function uploadFile<T = unknown>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: formData });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(text || `Upload failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export const formatNumber = (n: number): string => {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
};

export const formatMoney = (n: number): string =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });

export const formatCompactMoney = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return formatMoney(n);
};

export const formatDate = (d: Date | string | null): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const relativeTime = (d: Date | string): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
};

/** Map a semantic color name to Tailwind classes for accents. */
export const colorClasses: Record<
  string,
  { bg: string; text: string; ring: string; soft: string; dot: string }
> = {
  emerald: {
    bg: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
    soft: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
    soft: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  rose: {
    bg: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
    soft: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  teal: {
    bg: "bg-teal-500",
    text: "text-teal-600 dark:text-teal-400",
    ring: "ring-teal-500/30",
    soft: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    dot: "bg-teal-500",
  },
  orange: {
    bg: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/30",
    soft: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
};

export const colorFor = (name: string) => colorClasses[name] ?? colorClasses.emerald;
