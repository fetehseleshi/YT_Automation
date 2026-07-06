"use client";

import * as React from "react";
import { api } from "@/lib/api";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string; // info | success | warning | error
  section: string; // SectionId
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unread: number;
}

interface UseNotificationsResult {
  notifications: NotificationItem[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

/**
 * Fetches notifications from /api/notifications and exposes mutation helpers.
 * Used by the topbar bell dropdown.
 */
export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<NotificationsResponse>("/api/notifications");
      setNotifications(res.notifications ?? []);
      setUnread(res.unread ?? 0);
    } catch {
      // Silent fail — non-fatal. Bell just shows empty state.
      setNotifications([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = React.useCallback(async () => {
    // Optimistic update
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "markAllRead" }),
      });
    } catch {
      // Revert on failure
      await refresh();
    }
  }, [refresh]);

  const markRead = React.useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnread((u) => Math.max(0, u - 1));
      try {
        await api("/api/notifications", {
          method: "POST",
          body: JSON.stringify({ action: "markRead", id }),
        });
      } catch {
        // Revert on failure
        await refresh();
      }
    },
    [refresh],
  );

  const clearAll = React.useCallback(async () => {
    // Optimistic update
    setNotifications([]);
    setUnread(0);
    try {
      await api("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "clearAll" }),
      });
    } catch {
      // Revert on failure
      await refresh();
    }
  }, [refresh]);

  return {
    notifications,
    unread,
    loading,
    refresh,
    markAllRead,
    markRead,
    clearAll,
  };
}
