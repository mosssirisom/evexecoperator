import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { useRealtimeAuditLog } from "./useRealtimeBookings";

const PAGE_SIZE = 50;

function shapedEntry(row) {
  return {
    id: row.id,
    actorEmail: row.actor_email || "Unknown operator",
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details ?? null,
    createdAt: row.created_at,
  };
}

export function useAuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntries = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (err) { setError(err.message); return; }
      setEntries((data || []).map(shapedEntry));
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useRealtimeAuditLog(fetchEntries);

  return { entries, loading, error, refetch: fetchEntries };
}
