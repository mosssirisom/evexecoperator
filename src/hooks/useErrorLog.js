import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { useRealtimeErrorLog } from "./useRealtimeBookings";

const PAGE_SIZE = 50;

function shapedEntry(row) {
  return {
    id: row.id,
    message: row.message,
    stack: row.stack ?? null,
    componentStack: row.component_stack ?? null,
    url: row.url ?? null,
    userEmail: row.user_email || "Unknown operator",
    context: row.context ?? null,
    createdAt: row.created_at,
  };
}

export function useErrorLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntries = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("error_log")
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

  useRealtimeErrorLog(fetchEntries);

  return { entries, loading, error, refetch: fetchEntries };
}
