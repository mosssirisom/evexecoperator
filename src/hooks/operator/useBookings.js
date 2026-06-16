"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import { useRealtimeBookings } from "./useRealtimeBookings";
import { dispatchJobToDriverApp, updateJobStatus } from "@/lib/operator/driverApp";
import {
  validateBookingPayload,
  validateStatusTransition,
  BOOKING_STATUSES,
  ValidationError,
  generateBookingRef,
  sanitizeText,
} from "@/lib/operator/validation";

// ─── Row mapper ───────────────────────────────────────────────────────────────

// Resolves the real pickup and drop-off addresses for a booking. `direction`
// is not reliable for this — it reads "Airport to Destination" for bookings
// going either way — so `journey_type` (set by the website's booking flow)
// is used to decide which of `pickup_location` / `airport` / `dropoff_address`
// holds each end of the trip.
function tripEndpoints(row) {
  if (row.journey_type === "To Airport") {
    return {
      pickup: row.pickup_location || null,
      dropoff: row.airport || row.dropoff_address || row.destination || null,
    };
  }
  if (row.journey_type === "From Airport") {
    return {
      pickup: row.airport || null,
      dropoff: row.dropoff_address || row.destination || row.pickup_location || null,
    };
  }
  // No journey_type — booked manually via the operator's New Transfer form,
  // which always treats `airport` as the pickup and `dropoff_address` as
  // the destination.
  return {
    pickup: row.airport || row.pickup_location || null,
    dropoff: row.dropoff_address || row.destination || null,
  };
}

// Builds the return-leg details for bookings where the customer requested a
// return journey at the time of booking. Returns null when no return leg
// was requested.
function returnJourneyDetails(row) {
  if (!row.return_journey) return null;
  const pickup = row.return_pickup || row.return_airport || null;
  const dropoff = row.return_destination || row.return_pickup || null;
  return {
    pickup,
    dropoff,
    route: [pickup, dropoff].filter(Boolean).join(" → ") || null,
    airport: row.return_airport ?? null,
    flight: row.return_flight ?? null,
    date: row.return_date ?? null,
    time: row.return_time ? row.return_time.slice(0, 5) : null,
  };
}

export function shapedBooking(row) {
  const { pickup, dropoff } = tripEndpoints(row);
  return {
    id: row.ref,
    customer: row.customer_name,
    phone: row.customer_phone ?? null,
    email: row.customer_email ?? null,
    flight: row.flight_number ?? "—",
    pickup,
    dropoff,
    route: [pickup, dropoff].filter(Boolean).join(" → ") || pickup || dropoff || "—",
    airport: row.airport ?? null,
    destination: row.dropoff_address ?? null,
    direction: row.direction ?? null,
    journeyType: row.journey_type ?? null,
    vehicleType: row.vehicle_type ?? null,
    contactMethod: row.contact_method ?? null,
    passengers: row.passengers ?? null,
    bags: row.luggage ?? null,
    returnJourney: row.return_journey ?? false,
    returnDetails: returnJourneyDetails(row),
    travelDate: row.travel_date ?? null,
    time: row.travel_time ? row.travel_time.slice(0, 5) : "—",
    pickupTime: row.travel_time ?? null,
    driver: row.drivers?.name ?? "Unassigned",
    driverId: row.driver_id ?? null,
    price: row.quoted_price ? `£${Number(row.quoted_price).toFixed(0)}` : "TBC",
    status: row.status,
    paymentStatus: row.payment_status ?? "Unpaid",
    priority: row.priority ?? false,
    notes: row.notes ?? "",
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export function useBookings() {
  const [bookings, setBookings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Stable ref to current bookings — avoids stale closures in callbacks
  // without adding `bookings` to useCallback dependency arrays.
  const bookingsRef = useRef(bookings);
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  // Counter guard: only the last in-flight fetch applies its result to state,
  // preventing a slow earlier response from overwriting a faster later one.
  const fetchIdRef = useRef(0);

  const fetchBookings = useCallback(async () => {
    if (!isConfigured) return;
    const myId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const { data, count, error: err } = await supabase
        .from("bookings")
        .select("*, drivers!driver_id(name)", { count: "exact" })
        .order("travel_date", { ascending: true })
        .order("travel_time", { ascending: true })
        .range(0, PAGE_SIZE - 1);
      if (fetchIdRef.current !== myId) return; // stale — a newer fetch is in flight
      if (err) { setError(err.message); return; }
      setBookings(data.map(shapedBooking));
      setTotalCount(count ?? 0);
      setError(null);
    } finally {
      if (fetchIdRef.current === myId) setLoading(false);
    }
  }, []);

  // Append next page without resetting the list; deduplicates by id in case
  // a realtime event inserted a record between the initial fetch and load-more.
  const loadMore = useCallback(async () => {
    if (!isConfigured || loadingMore) return;
    const from = bookingsRef.current.length;
    setLoadingMore(true);
    try {
      const { data, error: err } = await supabase
        .from("bookings")
        .select("*, drivers!driver_id(name)")
        .order("travel_date", { ascending: true })
        .order("travel_time", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (err) throw new Error(err.message);
      setBookings((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        return [...prev, ...data.map(shapedBooking).filter((b) => !existingIds.has(b.id))];
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  // Initial load
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Realtime subscription (with reconnect logic in useRealtimeBookings)
  useRealtimeBookings(fetchBookings);

  // Auto-refresh when tab regains focus — catches changes missed while away
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBookings();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchBookings]);

  // 60-second polling fallback: keeps data fresh if realtime silently dies
  useEffect(() => {
    if (!isConfigured) return;
    const id = setInterval(fetchBookings, 60_000);
    return () => clearInterval(id);
  }, [fetchBookings]);

  // ─── updateStatus ──────────────────────────────────────────────────────────

  const updateStatus = useCallback(async (id, status) => {
    if (!BOOKING_STATUSES.includes(status)) {
      throw new ValidationError(`"${status}" is not a valid booking status`);
    }

    const current = bookingsRef.current.find((b) => b.id === id);
    if (current) {
      validateStatusTransition(current.status, status);
    }

    // Drivers may only mark a job Completed within 4 hours of the scheduled pickup.
    if (status === "Completed" && current?.travelDate && current?.pickupTime) {
      const pickupMs = new Date(`${current.travelDate}T${current.pickupTime}`).getTime();
      if (!isNaN(pickupMs) && Date.now() < pickupMs - 4 * 60 * 60 * 1000) {
        throw new ValidationError(
          "Cannot mark as Completed more than 4 hours before the scheduled pickup time. Use the operator override if needed."
        );
      }
    }

    // Optimistic update — snapshot for rollback
    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

    if (!isConfigured) {
      updateJobStatus(id, status).catch((err) => {
        console.warn("[DriverApp] Status sync failed (mock):", err.message);
      });
      return;
    }

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ status })
        .eq("ref", id);
      if (err) throw new Error(err.message);

      updateJobStatus(id, status).catch((err) => {
        console.warn("[DriverApp] Status sync failed:", err.message);
      });
    } catch (err) {
      setBookings(snapshot); // roll back on failure
      throw err;
    }
  }, []);

  // ─── updateStatusOverride ──────────────────────────────────────────────────
  // Operator-only path: bypasses the state-machine and 4-hour guards so an
  // operator can correct any status (e.g. revert an accidentally completed job).

  const updateStatusOverride = useCallback(async (id, status) => {
    if (!BOOKING_STATUSES.includes(status)) {
      throw new ValidationError(`"${status}" is not a valid booking status`);
    }

    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

    if (!isConfigured) {
      updateJobStatus(id, status).catch((err) => {
        console.warn("[DriverApp] Status sync failed (mock):", err.message);
      });
      return;
    }

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ status })
        .eq("ref", id);
      if (err) throw new Error(err.message);

      updateJobStatus(id, status).catch((err) => {
        console.warn("[DriverApp] Status sync failed:", err.message);
      });
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  // ─── createBooking ─────────────────────────────────────────────────────────

  const createBooking = useCallback(
    async (form) => {
      validateBookingPayload(form);

      const dest =
        form.destination === "Custom address…"
          ? form.customAddress.trim()
          : form.destination;

      if (!isConfigured) throw new Error("Database not configured. Please add Supabase credentials.");

      const { data: driverRow } = form.driver
        ? await supabase
            .from("drivers")
            .select("id, name")
            .eq("id", form.driver)
            .single()
        : { data: null };

      // Retry up to 3 times on unique-key collision
      let ref;
      let succeeded = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        ref = generateBookingRef();
        const { error: insertErr } = await supabase.from("bookings").insert({
          ref,
          customer_name:      sanitizeText(form.customer, 120),
          customer_phone:     sanitizeText(form.phone, 30),
          customer_email:     form.email?.trim() || null,
          flight_number:      form.flight?.trim() || null,
          direction:          form.direction,
          airport:            form.airport,
          dropoff_address:    dest,
          travel_date:        form.date || null,
          travel_time:        form.time || null,
          driver_id:          driverRow?.id ?? null,
          assigned_driver_id: driverRow?.id ?? null,
          quoted_price:       form.price ? Number(form.price) : null,
          status:             driverRow ? "Dispatched" : "Unassigned",
          payment_status:     "Unpaid",
          notes:              form.notes?.trim() || null,
        });

        if (!insertErr) { succeeded = true; break; }
        if (insertErr.code !== "23505") throw new Error(insertErr.message);
      }
      if (!succeeded) {
        throw new Error(
          "Failed to generate a unique booking reference after 3 attempts. Please try again."
        );
      }

      const createdStatus = driverRow ? "Dispatched" : "Unassigned";
      dispatchJobToDriverApp({
        bookingRef: ref,
        customer: form.customer,
        route: `${form.airport} → ${dest}`,
        flight: form.flight,
        pickupTime: form.date && form.time ? `${form.date}T${form.time}` : null,
        price: form.price ? `£${form.price}` : "TBC",
        driver: driverRow?.name ?? null,
        status: createdStatus,
      }).catch(() => {});

      // Fetch after create so the new booking appears with its server-assigned fields
      await fetchBookings();
      return { ref };
    },
    [fetchBookings]
  );

  // ─── assignDriver ──────────────────────────────────────────────────────────

  const assignDriver = useCallback(async (id, driverId, driverName) => {
    const current = bookingsRef.current.find((b) => b.id === id);
    const currentStatus = current?.status ?? "";

    // Auto-transition status when driver assignment changes
    let newStatus = null;
    if (driverId) {
      if (currentStatus === "Unassigned" || currentStatus === "Unassigned / Missed Call Recovery") {
        newStatus = "Dispatched";
      }
    } else {
      if (currentStatus === "Dispatched" || currentStatus === "Unassigned / Missed Call Recovery") {
        newStatus = "Unassigned";
      }
    }

    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              driverId: driverId || null,
              driver: driverName ?? (driverId ? b.driver : "Unassigned"),
              ...(newStatus ? { status: newStatus } : {}),
            }
          : b
      )
    );

    if (!isConfigured) return;

    try {
      const update = { driver_id: driverId || null, assigned_driver_id: driverId || null };
      if (newStatus) update.status = newStatus;

      const { error: err } = await supabase
        .from("bookings")
        .update(update)
        .eq("ref", id);
      if (err) throw new Error(err.message);
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  // ─── updateNotes ───────────────────────────────────────────────────────────

  const updateNotes = useCallback(async (id, notes) => {
    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, notes: notes ?? "" } : b))
    );

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ notes: notes?.trim() || null })
        .eq("ref", id);
      if (err) throw new Error(err.message);
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  // ─── togglePriority ────────────────────────────────────────────────────────

  const togglePriority = useCallback(async (id) => {
    const current = bookingsRef.current.find((b) => b.id === id);
    const newPriority = !current?.priority;

    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, priority: newPriority } : b))
    );

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ priority: newPriority })
        .eq("ref", id);
      if (err) throw new Error(err.message);
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  // ─── updatePaymentStatus ───────────────────────────────────────────────────

  const updatePaymentStatus = useCallback(async (id, paymentStatus) => {
    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, paymentStatus } : b))
    );

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ payment_status: paymentStatus })
        .eq("ref", id);
      if (err) throw new Error(err.message);
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  return { bookings, totalCount, loading, loadingMore, loadMore, error, createBooking, updateStatus, updateStatusOverride, assignDriver, updateNotes, togglePriority, updatePaymentStatus, refetch: fetchBookings };
}
