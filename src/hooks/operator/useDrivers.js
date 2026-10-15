"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import { authHeaders } from "@/lib/operator/authHeaders";
import { useRealtimeDrivers } from "./useRealtimeBookings";

const PHONE_RE = /^[+\d][\d\s\-().]{4,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function shapedDriver(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    job: "No active job",
    vehicle: row.vehicle ?? "—",
    plate: row.plate ?? "—",
    phone: row.phone ?? "—",
    email: row.email ?? null,
    // "driver" uses the Driver App; "partner" is a trusted outside operator
    // (no app login, customer texts for their jobs go to the office).
    kind: row.kind === "partner" ? "partner" : "driver",
    completedToday: 0,
    rating: row.rating ?? 5.0,
  };
}

/** Checked, trimmed columns for a driver or partner from the Add/Edit form. */
export function validDriverForm(form) {
  const kind = form.kind === "partner" ? "partner" : "driver";
  const name = form.name?.trim();
  const phone = form.phone?.trim() || null;
  const email = form.email?.trim() || null;
  const vehicle = form.vehicle?.trim() || null;
  const plate = form.plate?.trim() || null;

  if (!name) throw new Error(kind === "partner" ? "Partner name is required." : "Driver name is required.");
  if (name.length > 120) throw new Error("Name must be 120 characters or fewer.");
  if (!email || !EMAIL_RE.test(email)) throw new Error("A valid email address is required — job details are emailed to it.");
  if (phone && !PHONE_RE.test(phone)) throw new Error("Please enter a valid phone number.");
  if (plate && plate.length > 20) throw new Error("Plate number must be 20 characters or fewer.");
  return { kind, name, phone, email, vehicle, plate };
}

export function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDrivers = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      // Today in UK time, by the booking's own date (not every row has pickup_time).
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

      const [{ data, error: err }, { data: completedData }] = await Promise.all([
        supabase.from("drivers").select("*").order("name"),
        supabase
          .from("bookings")
          .select("driver_id")
          .eq("status", "Completed")
          .eq("travel_date", today),
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

  const updateStatus = useCallback(async (id, status) => {
    if (!isConfigured) throw new Error("Database not configured.");
    const { error: err } = await supabase
      .from("drivers")
      .update({ status })
      .eq("id", id);
    if (err) throw new Error(err.message);
    await fetchDrivers();
  }, [fetchDrivers]);

  // App access per driver: { [id]: { status: "partner"|"none"|"invited"|"active", lastSignIn } }.
  const [access, setAccess] = useState({});
  const fetchAccess = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const res = await fetch("/api/drivers", { headers: await authHeaders() });
      if (!res.ok) return;
      const body = await res.json();
      setAccess(body.access ?? {});
    } catch { /* status badges just stay hidden */ }
  }, []);
  useEffect(() => { fetchAccess(); }, [fetchAccess, drivers.length]);

  /** Email the driver a link to set their Driver App password (creates the login if needed). */
  const inviteDriver = useCallback(async (id) => {
    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ driverId: id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Couldn't send the invite.");
    await fetchAccess();
    if (!body.emailed) throw new Error(`Login created, but the email didn't send: ${body.emailError || "unknown error"}`);
    return body;
  }, [fetchAccess]);

  const createDriver = useCallback(async (form) => {
    const fields = validDriverForm(form);
    if (!isConfigured) throw new Error("Database not configured.");

    const { data, error: err } = await supabase.from("drivers").insert({
      ...fields,
      status: "Available",
      rating: 5.0,
    }).select("id").single();
    if (err) throw new Error(err.message);
    await fetchDrivers();
    return data?.id ?? null;
  }, [fetchDrivers]);

  const updateDriver = useCallback(async (id, form) => {
    const fields = validDriverForm(form);
    if (!isConfigured) throw new Error("Database not configured.");

    const { error: err } = await supabase
      .from("drivers")
      .update(fields)
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

  return { drivers, loading, error, access, updateStatus, createDriver, updateDriver, deleteDriver, inviteDriver, refetch: fetchDrivers };
}