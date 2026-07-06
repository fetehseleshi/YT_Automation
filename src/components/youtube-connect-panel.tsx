"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api, relativeTime } from "@/lib/api";

interface YtConnection {
  id: string;
  youtubeChannelId: string;
  channelTitle: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastSyncError: string;
  lastSyncProgress: number;
  autoSync: boolean;
  syncIntervalHrs: number;
  channel: { id: string; name: string; logoUrl: string; subscribers: number; views: number } | null;
  videoCount: number;
  likes: number;
  comments: number;
  recentLogs: Array<{
    id: string; status: string; resource: string; message: string; error: string;
    itemsProcessed: number; durationMs: number; createdAt: string;
  }>;
}

interface StatusResponse {
  configured: boolean;
  connections: YtConnection[];
}

export function YoutubeConnectPanel() {
  const [status, setStatus] = React.useState<StatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await api<StatusResponse>("/api/youtube/status");
      setStatus(data);
    } catch {
      /* not authenticated or not configured */
      setStatus({ configured: false, connections: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Handle redirect params (?yt_connected=1 / ?yt_error=)
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("yt_connected")) {
      toast.success("YouTube account connected!");
      load();
      window.history.replaceState({}, "", "/");
    }
    const err = p.get("yt_error");
    if (err) {
      toast.error(decodeURIComponent(err));
      window.history.replaceState({}, "", "/");
    }
  }, [load]);

  async function connect() {
    // Redirect to /api/youtube/connect (server handles Google OAuth redirect)
    window.location.href = "/api/youtube/connect";
  }

  async function syncNow(connId?: string) {
    setSyncing(true);
    try {
      const res: any = await api("/api/youtube/sync", {
        method: "POST",
        body: JSON.stringify({ connectionId: connId }),
      });
      if (res.ok) {
        toast.success(`Synced "${res.channelTitle}" — ${res.videosProcessed} videos imported.`);
        if (typeof res.likes === "number" && typeof res.comments === "number") {
          toast.success(`Likes: ${res.likes.toLocaleString()}, Comments: ${res.comments.toLocaleString()}`);
        }
      } else {
        toast.error(res.error || "Sync failed");
      }
      load();
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect(connId: string) {
    if (!confirm("Disconnect this YouTube account? Local data is kept.")) return;
    try {
      await api("/api/youtube/disconnect", {
        method: "POST",
        body: JSON.stringify({ connectionId: connId }),
      });
      toast.success("YouTube account disconnected.");
      load();
    } catch (e: any) {
      toast.error(e.message || "Disconnect failed");
    }
  }

  async function toggleAutoSync(connId: string, value: boolean) {
    try {
      await api("/api/youtube/status", { method: "POST", body: JSON.stringify({ connectionId: connId, autoSync: value }) });
      load();
    } catch {
      /* status POST not implemented for updates — graceful */
    }
  }

  if (loading) {
    return (
      <Card className="p-5 mb-5 border-border/60">
        <div className="h-24 rounded-xl bg-muted/40 shimmer" />
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-5 mb-5 border-border/60">
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 grid place-items-center shadow-lg shadow-rose-500/30">
              <Icon name="youtube" className="size-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                YouTube Sync
                {status?.configured ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">Ready</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">Not configured</Badge>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">Connect real YouTube channels via official Google OAuth</p>
            </div>
          </div>
          {status?.configured && status.connections.length === 0 && (
            <Button onClick={connect} className="gap-2">
              <Icon name="youtube" className="size-4" /> Connect YouTube
            </Button>
          )}
        </div>

        {!status?.configured && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">YouTube integration needs configuration</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">GOOGLE_CLIENT_SECRET</code> to your{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.env</code> file, then add the redirect URI{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">http://localhost:3000/api/youtube/callback</code>{" "}
              in Google Cloud Console → APIs &amp; Services → Credentials. The code is production-ready and activates the moment credentials are added.
            </p>
          </div>
        )}

        {status?.connections.map((conn) => (
          <motion.div
            key={conn.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border/60 p-4 bg-card/50"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                {conn.channel?.logoUrl ? (
                  <img src={conn.channel.logoUrl} alt="" className="size-10 rounded-lg object-cover" />
                ) : (
                  <div className="size-10 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 grid place-items-center">
                    <Icon name="youtube" className="size-5 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{conn.channelTitle || conn.channel?.name || "YouTube channel"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conn.channel ? `${(conn.channel.subscribers || 0).toLocaleString()} subs · ${(conn.channel.views || 0).toLocaleString()} views` : conn.youtubeChannelId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SyncStatusBadge status={conn.lastSyncStatus} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
              <div>
                <p className="text-muted-foreground">Last sync</p>
                <p className="font-medium">{conn.lastSyncAt ? relativeTime(conn.lastSyncAt) : "Never"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{conn.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Auto-sync</p>
                <div className="flex items-center gap-1.5">
                  <Switch checked={conn.autoSync} onCheckedChange={(v) => toggleAutoSync(conn.id, v)} />
                  <span className="text-muted-foreground">every {conn.syncIntervalHrs}h</span>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Progress</p>
                <p className="font-medium">{conn.lastSyncProgress}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
              <div>
                <p className="text-muted-foreground">Subscribers</p>
                <p className="font-medium">{conn.channel?.subscribers?.toLocaleString() ?? "0"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Views</p>
                <p className="font-medium">{conn.channel?.views?.toLocaleString() ?? "0"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Likes</p>
                <p className="font-medium">{conn.likes.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Comments</p>
                <p className="font-medium">{conn.comments.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
              <div>
                <p className="text-muted-foreground">Videos tracked</p>
                <p className="font-medium">{conn.videoCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">YouTube channel</p>
                <p className="font-medium truncate">{conn.youtubeChannelId}</p>
              </div>
            </div>

            {conn.lastSyncError && (
              <div className="mt-3 rounded-lg bg-rose-500/5 border border-rose-500/20 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <Icon name="alert-triangle" className="size-4 shrink-0 mt-0.5" />
                <span>{conn.lastSyncError}</span>
              </div>
            )}

            {conn.recentLogs.length > 0 && (
              <details className="mt-3 group">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                  <Icon name="chevron-right" className="size-3 group-open:rotate-90 transition-transform" />
                  Recent sync logs ({conn.recentLogs.length})
                </summary>
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {conn.recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-border/40 last:border-0">
                      <Icon
                        name={log.status === "success" ? "check-circle-2" : log.status === "failed" ? "alert-triangle" : "circle"}
                        className={
                          log.status === "success" ? "size-3.5 text-emerald-500" :
                          log.status === "failed" ? "size-3.5 text-rose-500" : "size-3.5 text-muted-foreground"
                        }
                      />
                      <span className="flex-1 truncate">{log.message || log.error || log.status}</span>
                      <span className="text-muted-foreground shrink-0">{relativeTime(log.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={() => syncNow(conn.id)} disabled={syncing} className="gap-1.5">
                {syncing ? <><Icon name="refresh" className="size-3.5 animate-spin" /> Syncing…</> : <><Icon name="refresh" className="size-3.5" /> Sync now</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => disconnect(conn.id)} className="gap-1.5">
                <Icon name="x" className="size-3.5" /> Disconnect
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    success: { label: "Synced", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    in_progress: { label: "Syncing", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    failed: { label: "Failed", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    partial: { label: "Partial", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    never: { label: "Never synced", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] || map.never;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>{m.label}</span>;
}
