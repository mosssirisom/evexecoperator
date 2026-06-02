import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import { transfers as mockTransfers } from "../data/mockData";
import { useRealtimeBookings } from "./useRealtimeBookings";
import { dispatchJobToDriverApp, updateJobStatus } from "../lib/driverApp";
import {
  validateBookingPayload,
  validateStatusTransition,
  BOOKING_STATUSES,
  ValidationError,
  generateBookingRef,
  sanitizeText,
} from "../lib/validation";

// ─── Row mapper ───────────────────────────────────────────────────────────────

export function shapedBooking(row) {
  return {
    id: row.ref,
    customer: row.customer_name,
    phone: row.customer_phone ?? null,
    email: row.customer_email ?? null,
    flight: row.flight ?? "—",
    route:
      [row.airport, row.destination].filter(Boolean).join(" → ") ||
      row.destination ||
      "—",
    airport: row.airport ?? null,
    destination: row.destination ?? null,
    direction: row.direction ?? null,
    time: row.pickup_time
      ? new Date(row.pickup_time).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    pickupTime: row.pickup_time ?? null,
    driver: row.drivers?.name ?? "Unassigned",
    driverId: row.driver_id ?? null,
    price: row.price ? `£${Number(row.price).toFixed(0)}` : "TBC",
    status: row.status,
    priority: row.priority ?? false,
    notes: row.notes ?? "",
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBookings() {
  const [bookings, setBookings] = useState(mockTransfers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stable ref to current bookings — avoids stale closures in updateStatus
  // without adding `bookings` to the useCallback dependency array.
  const bookingsRef = useRef(bookings);
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  const fetchBookings = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("bookings")
        .select("*, drivers(name)")
        .order("pickup_time", { ascending: true });
      if (err) { setError(err.message); return; }
      setBookings(data.map(shapedBooking));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useRealtimeBookings(fetchBookings);

  // ─── updateStatus ──────────────────────────────────────────────────────────

  const updateStatus = useCallback(async (id, status) => {
    // 1. Reject unknown status values immediately
    if (!BOOKING_STATUSES.includes(status)) {
      throw new ValidationError(`"${status}" is not a valid booking status`);
    }

    // 2. Enforce state machine transition rules
    const current = bookingsRef.current.find((b) => b.id === id);
    if (current) {
      validateStatusTransition(current.status, status);
    }

    // 3. Mock path (no Supabase configured)
    if (!isConfigured) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b))
      );
      updateJobStatus(id, status).catch((err) => {
        console.warn("[DriverApp] Status sync failed (mock):", err.message);
      });
      return;
    }

    // 4. Persist to Supabase — surface any DB-level errors (including trigger
    //    violations from the status-transition constraint)
    const { error: err } = await supabase
      .from("bookings")
      .update({ status })
      .eq("ref", id);
    if (err) throw new Error(err.message);

    // 5. Notify driver app non-blocking — failure does not roll back the
    //    booking update; the operator UI already reflects the new status.
    updateJobStatus(id, status).catch((err) => {
      console.warn("[DriverApp] Status sync failed:", err.message);
    });
  }, []);

  // ─── createBooking ─────────────────────────────────────────────────────────

  const createBooking = useCallback(
    async (form) => {
      // Validate before any DB round-trip (defence-in-depth)
      validateBookingPayload(form);

      const dest =
        form.destination === "Custom address…"
          ? form.customAddress.trim()
          : form.destination;

      const pickup =
        form.date && form.time
          ? new Date(`${form.date}T${form.time}`).toISOString()
          : null;

      // ── Mock path ───────────────────────────────────────────────────────────
      if (!isConfigured) {
        const ref = generateBookingRef();
        setBookings((prev) => [
          ...prev,
          {
            id: ref,
            customer: form.customer,
            flight: form.flight || "—",
            route: `${form.airport} → ${dest}`,
            time: form.time,
            driver: "Unassigned",
            price: form.price ? `£${form.price}` : "TBC",
            status: "Dispatched",
            priority: false,
            updatedAt: null,
          },
        ]);
        dispatchJobToDriverApp({
          bookingRef: ref,
          customer: form.customer,
          route: `${form.airport} → ${dest}`,
          flight: form.flight,
          pickupTime: form.time,
          price: form.price ? `£${form.price}` : "TBC",
        }).catch(() => {});
        return { ref };
      }

      // ── Real Supabase path ──────────────────────────────────────────────────
      const { data: driverRow } = form.driver
        ? await supabase
            .from("drivers")
            .select("id, name")
            .eq("id", form.driver)
            .single()
        : { data: null };

      // Retry up to 3 times on unique-key collision (astronomically rare but
      // possible under concurrent high-volume inserts).
      let ref;
      let succeeded = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        ref = generateBookingRef();
        const { error: insertErr } = await supabase.from("bookings").insert({
          ref,
          customer_name:  sanitizeText(form.customer, 120),
          customer_phone: sanitizeText(form.phone, 30),
          customer_email: form.email?.trim() || null,
          flight:         form.flight?.trim() || null,
          direction:      form.direction,
          airport:        form.airport,
          destination:    dest,
          pickup_time:    pickup,
          driver_id:      driverRow?.id ?? null,
          price:          form.price ?? null,
          status:         "Dispatched",
          notes:          form.notes?.trim() || null,
        });

        if (!insertErr) { succeeded = true; break; }
        if (insertErr.code !== "23505") throw new Error(insertErr.message);
      }
      if (!succeeded) {
        throw new Error(
          "Failed to generate a unique booking reference after 3 attempts. Please try again."
        );
      }

      dispatchJobToDriverApp({
        bookingRef: ref,
        customer: form.customer,
        route: `${form.airport} → ${dest}`,
        flight: form.flight,
        pickupTime: pickup,
        price: form.price ? `£${form.price}` : "TBC",
        driver: driverRow?.name ?? null,
      }).catch(() => {});

      await fetchBookings();
      return { ref };
    },
    [fetchBookings]
  );

  // ─── assignDriver ──────────────────────────────────────────────────────────

  const assignDriver = useCallback(async (id, driverId) => {
    if (!isConfigured) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, driverId: driverId || null } : b))
      );
      return;
    }
    const { error: err } = await supabase
      .from("bookings")
      .update({ driver_id: driverId || null })
      .eq("ref", id);
    if (err) throw new Error(err.message);
    await fetchBookings();
  }, [fetchBookings]);

  // ─── updateNotes ───────────────────────────────────────────────────────────

  const updateNotes = useCallback(async (id, notes) => {
    if (!isConfigured) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, notes: notes ?? "" } : b))
      );
      return;
    }
    const { error: err } = await supabase
      .from("bookings")
      .update({ notes: notes?.trim() || null })
      .eq("ref", id);
    if (err) throw new Error(err.message);
    await fetchBookings();
  }, [fetchBookings]);

  // ─── togglePriority ────────────────────────────────────────────────────────

  const togglePriority = useCallback(async (id) => {
    const current = bookingsRef.current.find((b) => b.id === id);
    const newPriority = !current?.priority;
    if (!isConfigured) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, priority: newPriority } : b))
      );
      return;
    }
    const { error: err } = await supabase
      .from("bookings")
      .update({ priority: newPriority })
      .eq("ref", id);
    if (err) throw new Error(err.message);
    await fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, createBooking, updateStatus, assignDriver, updateNotes, togglePriority, refetch: fetchBookings };
}
