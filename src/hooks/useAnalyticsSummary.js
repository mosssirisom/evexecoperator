import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { useRealtimeBookings } from "./useRealtimeBookings";

function shapedTotals(row) {
  if (!row) return null;
  return {
    totalBookings: Number(row.total_bookings) || 0,
    completedBookings: Number(row.completed_bookings) || 0,
    cancelledBookings: Number(row.cancelled_bookings) || 0,
    totalRevenue: Number(row.total_revenue) || 0,
    uniqueCustomers: Number(row.unique_customers) || 0,
  };
}

function shapedBreakdown(rows) {
  return (rows || []).map((row) => ({
    status: row.status,
    count: Number(row.count) || 0,
  }));
}

// Aggregates across the full bookings table via server-side RPCs, so "All
// Time" totals and the status breakdown stay accurate regardless of how many
// bookings the client has paged in.
export function useAnalyticsSummary() {
  const [totals, setTotals] = useState(null);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const [totalsRes, breakdownRes] = await Promise.all([
        supabase.rpc("get_booking_totals", { since: null }),
        supabase.rpc("get_booking_status_breakdown", { since: null }),
      ]);

      if (totalsRes.error) { setError(totalsRes.error.message); return; }
      if (breakdownRes.error) { setError(breakdownRes.error.message); return; }

      setTotals(shapedTotals(totalsRes.data?.[0]));
      setStatusBreakdown(shapedBreakdown(breakdownRes.data));
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useRealtimeBookings(fetchSummary);

  return { totals, statusBreakdown, loading, error, refetch: fetchSummary };
}
