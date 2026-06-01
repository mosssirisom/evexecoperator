import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { missedCalls as mockCalls } from "../data/mockData";

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
  const [calls, setCalls] = useState(mockCalls);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCalls = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("missed_calls")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setCalls(data.map(shapedCall));
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const resolve = useCallback(async (id) => {
    if (!isConfigured) {
      setCalls((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    await supabase.from("missed_calls").update({ resolved: true }).eq("ref", id);
    await fetchCalls();
  }, [fetchCalls]);

  return { calls, loading, error, resolve, refetch: fetchCalls };
}
