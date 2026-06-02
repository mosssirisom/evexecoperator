import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { drivers as mockDrivers } from "../data/mockData";
import { useRealtimeDrivers } from "./useRealtimeBookings";

const PHONE_RE = /^[+\d][\d\s\-().]{4,}$/;

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
    try {
      const { data, error: err } = await supabase
        .from("drivers")
        .select("*")
        .order("name");
      if (err) { setError(err.message); return; }
      setDrivers(data.map(shapedDriver));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  useRealtimeDrivers(fetchDrivers);

  const updateStatus = useCallback(async (id, status) => {
    if (!isConfigured) {
      setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
      return;
    }
    const { error: err } = await supabase
      .from("drivers")
      .update({ status })
      .eq("id", id);
    if (err) throw new Error(err.message);
    await fetchDrivers();
  }, [fetchDrivers]);

  const createDriver = useCallback(async (form) => {
    const name = form.name?.trim();
    const phone = form.phone?.trim() || null;
    const vehicle = form.vehicle?.trim() || null;
    const plate = form.plate?.trim() || null;

    if (!name) throw new Error("Driver name is required.");
    if (name.length > 120) throw new Error("Name must be 120 characters or fewer.");
    if (phone && !PHONE_RE.test(phone)) throw new Error("Please enter a valid phone number.");
    if (plate && plate.length > 20) throw new Error("Plate number must be 20 characters or fewer.");

    if (!isConfigured) {
      // Mock path: add locally
      setDrivers((prev) => [
        ...prev,
        { id: `mock-${Date.now()}`, name, phone: phone ?? "—", vehicle: vehicle ?? "—", plate: plate ?? "—", status: "Available", job: "No active job", completedToday: 0, rating: 5.0 },
      ]);
      return;
    }

    const { error: err } = await supabase.from("drivers").insert({
      name,
      phone,
      vehicle,
      plate,
      status: "Available",
      rating: 5.0,
    });
    if (err) throw new Error(err.message);
    await fetchDrivers();
  }, [fetchDrivers]);

  return { drivers, loading, error, updateStatus, createDriver, refetch: fetchDrivers };
}
