"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { DbNotificationLog, DbNotificationQueueItem } from "@/lib/database.types";

export interface BookingNotificationStatus {
  lastSent: { type: string; sent_at: string } | null;
  pendingCount: number;
  failedCount: number;
}

type NotificationsByBooking = Record<string, BookingNotificationStatus>;

function emptyStatus(): BookingNotificationStatus {
  return { lastSent: null, pendingCount: 0, failedCount: 0 };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationsByBooking>({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [{ data: logRows }, { data: queueRows }] = await Promise.all([
      supabase
        .from("notification_log_dashboard")
        .select("*")
        .order("sent_at", { ascending: false }),
      supabase.from("notification_queue_dashboard").select("*"),
    ]);

    const map: NotificationsByBooking = {};

    // Ordered newest-first, so the first row seen per booking is the latest.
    for (const row of (logRows as DbNotificationLog[]) ?? []) {
      if (!row.booking_id || !row.sent_at) continue;
      const entry = (map[row.booking_id] ??= emptyStatus());
      if (!entry.lastSent) entry.lastSent = { type: row.type, sent_at: row.sent_at };
    }

    for (const row of (queueRows as DbNotificationQueueItem[]) ?? []) {
      if (!row.booking_id) continue;
      const entry = (map[row.booking_id] ??= emptyStatus());
      if (row.has_error) entry.failedCount += 1;
      else if (row.status === "pending") entry.pendingCount += 1;
    }

    setNotifications(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { notifications, loading, refetch: fetch };
}