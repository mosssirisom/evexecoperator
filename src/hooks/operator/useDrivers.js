"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import { useRealtimeDrivers } from "./useRealtimeBookings";

const PHONE_RE = /^[+\d][\d\s\-().]{4,}$/;

function shapedDriver(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    is_online: row.is_online,
    job: "No active job",
    vehicle_registration: row.vehicle_registration ?? "—",
    vehicle_model: row.vehicle_model ?? "—",
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [{ data, error: err }, { data: completedData }] = await Promise.all([
        supabase.from("drivers").select("*").order("full_name"),
        supabase
          .from("bookings")
          .select("driver_id")
          .eq("status", "Completed")
          .gte("pickup_time", today.toISOString())
          .lt("pickup_time", tomorrow.toISOString()),
      ]);

      if (err) { setError(err.message); return; }

      const completedByDriver = {};
      completedData?.forEach((b) => {
        if (b.driver_id) completedByDriver[b.driver_id] = (completedByDriver[b.driver_id] || 0) + 1;
      });

      setDrivers(data.map((row) => ({ ...shapedDriver(row), completedToday: completedByDriver[row.id] || 0 })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  useRealtimeDrivers(fetchDrivers);

  const updateOnlineStatus = useCallback(async (id, isOnline) => {
    if (!isConfigured) throw new Error("Database not configured.");
    const { error: err } = await supabase
      .from("drivers")
      .update({ is_online: isOnline })
      .eq("id", id);
    if (err) throw new Error(err.message);
    await fetchDrivers();
  }, [fetchDrivers]);

  const createDriver = useCallback(async (form) => {
    const full_name = form.full_name?.trim();
    const phone = form.phone?.trim() || null;
    const vehicle_registration = form.vehicle_registration?.trim() || null;
    const vehicle_model = form.vehicle_model?.trim() || null;

    if (!full_name) throw new Error("Driver name is required.");
    if (full_name.length > 120) throw new Error("Name must be 120 characters or fewer.");
    if (phone && !PHONE_RE.test(phone)) throw new Error("Please enter a valid phone number.");
    if (vehicle_registration && vehicle_registration.length > 20) throw new Error("Registration must be 20 characters or fewer.");

    if (!isConfigured) throw new Error("Database not configured.");

    const { error: err } = await supabase.from("drivers").insert({
      full_name,
      phone,
      vehicle_registration,
      vehicle_model,
      is_online: true,
      rating: 5.0,
    });
    if (err) throw new Error(err.message);
    await fetchDrivers();
  }, [fetchDrivers]);

  const updateDriver = useCallback(async (id, form) => {
    const full_name = form.full_name?.trim();
    const phone = form.phone?.trim() || null;
    const vehicle_registration = form.vehicle_registration?.trim() || null;
    const vehicle_model = form.vehicle_model?.trim() || null;

    if (!full_name) throw new Error("Driver name is required.");
    if (full_name.length > 120) throw new Error("Name must be 120 characters or fewer.");
    if (phone && !PHONE_RE.test(phone)) throw new Error("Please enter a valid phone number.");
    if (vehicle_registration && vehicle_registration.length > 20) throw new Error("Registration must be 20 characters or fewer.");

    if (!isConfigured) throw new Error("Database not configured.");

    const { error: err } = await supabase
      .from("drivers")
      .update({ full_name, phone, vehicle_registration, vehicle_model })
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

  return { drivers, loading, error, updateOnlineStatus, createDriver, updateDriver, deleteDriver, refetch: fetchDrivers };
}
