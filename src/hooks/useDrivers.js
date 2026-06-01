import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { drivers as mockDrivers } from "../data/mockData";

function shapedDriver(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    job: "No active job",
    vehicle: row.vehicle ?? "—",
    plate: row.plate ?? "—",
    phone: row.phone ?? "—",
    completedToday: 0,
    rating: row.rating ?? 5.0,
  };
}

export function useDrivers() {
  const [drivers, setDrivers] = useState(mockDrivers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDrivers = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("drivers")
      .select("*")
      .order("name");
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDrivers(data.map(shapedDriver));
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const updateStatus = useCallback(async (id, status) => {
    if (!isConfigured) {
      setDrivers((prev) => prev.map((d) => d.id === id ? { ...d, status } : d));
      return;
    }
    await supabase.from("drivers").update({ status }).eq("id", id);
    await fetchDrivers();
  }, [fetchDrivers]);

  return { drivers, loading, error, updateStatus, refetch: fetchDrivers };
}
