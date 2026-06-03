import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
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
  const [drivers, setDrivers] = useState([]);
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
    if (!isConfigured) throw new Error("Database not configured.");
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

    if (!isConfigured) throw new Error("Database not configured.");

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

  const updateDriver = useCallback(async (id, form) => {
    const name = form.name?.trim();
    const phone = form.phone?.trim() || null;
    const vehicle = form.vehicle?.trim() || null;
    const plate = form.plate?.trim() || null;

    if (!name) throw new Error("Driver name is required.");
    if (name.length > 120) throw new Error("Name must be 120 characters or fewer.");
    if (phone && !PHONE_RE.test(phone)) throw new Error("Please enter a valid phone number.");
    if (plate && plate.length > 20) throw new Error("Plate number must be 20 characters or fewer.");

    if (!isConfigured) throw new Error("Database not configured.");

    const { error: err } = await supabase
      .from("drivers")
      .update({ name, phone, vehicle, plate })
      .eq("id", id);
    if (err) throw new Error(err.message);
    await fetchDrivers();
  }, [fetchDrivers]);

  const deleteDriver = useCallback(async (id) => {
    if (!isConfigured) throw new Error("Database not configured.");
    const { error: err } = await supabase
      .from("drivers")
      .delete()
      .eq("id", id);
    if (err) throw new Error(err.message);
    await fetchDrivers();
  }, [fetchDrivers]);

  return { drivers, loading, error, updateStatus, createDriver, updateDriver, deleteDriver, refetch: fetchDrivers };
}
