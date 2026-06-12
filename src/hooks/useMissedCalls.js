import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { logActivity } from "../lib/auditLog";

function shapedCall(row) {
  return {
    id: row.ref,
    caller: row.caller,
    time: new Date(row.created_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    attempts: row.attempts,
    notes: row.notes ?? "",
    resolved: row.resolved,
  };
}

export function useMissedCalls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCalls = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("missed_calls")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (err) { setError(err.message); return; }
      setCalls(data.map(shapedCall));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const resolve = useCallback(async (id) => {
    if (!isConfigured) {
      setCalls((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    const { error: err } = await supabase
      .from("missed_calls")
      .update({ resolved: true })
      .eq("ref", id);
    if (err) {
      setError(err.message);
      throw new Error(err.message);
    }
    logActivity({ action: "missed_call.resolved", entityType: "missed_call", entityId: id });
    await fetchCalls();
  }, [fetchCalls]);

  const resolveAll = useCallback(async () => {
    if (!isConfigured) {
      setCalls([]);
      return;
    }
    const { error: err } = await supabase
      .from("missed_calls")
      .update({ resolved: true })
      .eq("resolved", false);
    if (err) {
      setError(err.message);
      throw new Error(err.message);
    }
    logActivity({ action: "missed_call.resolved_all", entityType: "missed_call", entityId: "all" });
    await fetchCalls();
  }, [fetchCalls]);

  return { calls, loading, error, resolve, resolveAll, refetch: fetchCalls };
}
