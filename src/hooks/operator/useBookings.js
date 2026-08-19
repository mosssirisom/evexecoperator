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
import { markBookingCreated } from "@/lib/operator/recentBookingRefs";

function compact(value) {
  return value ? String(value).split(",")[0] : null;
}

export function shapedBooking(row) {
  const pickupLocation = row.pickup_location ?? null;
  const dropoffAddress = row.dropoff_address ?? row.destination ?? null;
  const airport = row.airport ?? null;
  const displayPickup = pickupLocation || airport || row.direction || null;
  const displayDropoff = dropoffAddress || airport || null;
  const route = [compact(displayPickup), compact(displayDropoff)].filter(Boolean).join(" → ") || dropoffAddress || airport || "—";
  const returnRoute = row.return_journey
    ? [row.return_pickup || row.return_airport, row.return_destination || row.return_airport].filter(Boolean).join(" → ")
    : null;

  return {
    id: row.ref,
    customer: row.customer_name,
    phone: row.customer_phone ?? null,
    email: row.customer_email ?? null,
    flight: row.flight_number ?? row.flight ?? "—",
    route,
    pickupLocation,
    dropoffAddress,
    airport,
    destination: dropoffAddress,
    direction: row.direction ?? null,
    journeyType: row.journey_type ?? null,
    time: row.travel_time ? row.travel_time.slice(0, 5) : "—",
    pickupTime: row.pickup_time ?? (row.travel_date && row.travel_time ? `${row.travel_date}T${row.travel_time}` : null),
    travelDate: row.travel_date ?? null,
    passengers: row.passengers ?? null,
    luggage: row.luggage ?? null,
    returnJourney: row.return_journey ?? false,
    returnPickup: row.return_pickup ?? null,
    returnAirport: row.return_airport ?? null,
    returnFlight: row.return_flight ?? null,
    returnDate: row.return_date ?? null,
    returnTime: row.return_time ?? null,
    returnDestination: row.return_destination ?? null,
    returnRoute,
    vehicleType: row.vehicle_type ?? null,
    contactMethod: row.contact_method ?? null,
    driver: row.drivers?.name ?? "Unassigned",
    driverId: row.driver_id ?? row.assigned_driver_id ?? null,
    price: row.quoted_price ? `£${Number(row.quoted_price).toFixed(0)}` : "TBC",
    status: row.status,
    paymentStatus: row.payment_status ?? "Unpaid",
    paymentMethod: row.payment_method ?? null,
    priority: row.priority ?? false,
    notes: row.notes ?? row.operator_note ?? "",
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

const PAGE_SIZE = 100;

export function useBookings() {
  const [bookings, setBookings] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const bookingsRef = useRef(bookings);
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

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
      if (fetchIdRef.current !== myId) return;
      if (err) { setError(err.message); return; }
      setBookings(data.map(shapedBooking));
      setTotalCount(count ?? 0);
      setError(null);
    } finally {
      if (fetchIdRef.current === myId) setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useRealtimeBookings(fetchBookings);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBookings();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchBookings]);

  useEffect(() => {
    if (!isConfigured) return;
    const id = setInterval(fetchBookings, 60_000);
    return () => clearInterval(id);
  }, [fetchBookings]);

  const updateStatus = useCallback(async (id, status) => {
    if (!BOOKING_STATUSES.includes(status)) {
      throw new ValidationError(`"${status}" is not a valid booking status`);
    }

    const current = bookingsRef.current.find((b) => b.id === id);
    if (current) {
      validateStatusTransition(current.status, status);
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

      // Insert one booking row, retrying on a ref collision (23505). Returns the ref.
      const insertLeg = async (fields) => {
        let ref;
        let succeeded = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          ref = generateBookingRef();
          const { error: insertErr } = await supabase.from("bookings").insert({ ref, ...fields });
          if (!insertErr) { succeeded = true; break; }
          if (insertErr.code !== "23505") throw new Error(insertErr.message);
        }
        if (!succeeded) throw new Error("Failed to generate a unique booking reference after 3 attempts. Please try again.");
        return ref;
      };

      // Shared customer/meta for both legs. `source: "operator"` tags the booking
      // so the DB trigger sends the customer the confirmation, 24h reminder and
      // status-update SMS (website bookings get theirs from the public site).
      const shared = {
        customer_name:  sanitizeText(form.customer, 120),
        customer_phone: sanitizeText(form.phone, 30),
        customer_email: form.email?.trim() || null,
        quoted_price:   form.price ? Number(form.price) : null,
        payment_status: "Unpaid",
        source:         "operator",
      };

      // Outbound leg.
      const ref = await insertLeg({
        ...shared,
        flight_number:      form.flight?.trim() || null,
        direction:          form.direction,
        airport:            form.airport,
        dropoff_address:    dest,
        travel_date:        form.date || null,
        travel_time:        form.time || null,
        driver_id:          driverRow?.id ?? null,
        assigned_driver_id: driverRow?.id ?? null,
        status:             driverRow ? "Dispatched" : "Unassigned",
        notes:              form.notes?.trim() || null,
      });

      // Suppress the new-booking alert for a booking this operator just made.
      markBookingCreated(ref);
      dispatchJobToDriverApp({
        bookingRef: ref,
        customer: form.customer,
        route: `${form.airport} → ${dest}`,
        flight: form.flight,
        pickupTime: form.date && form.time ? `${form.date}T${form.time}` : null,
        price: form.price ? `£${form.price}` : "TBC",
        driver: driverRow?.name ?? null,
        status: driverRow ? "Dispatched" : "Unassigned",
      }).catch(() => {});

      // Optional return leg — the reverse trip on the return date/time, created as
      // its own dispatchable job (left unassigned for the operator to allocate).
      let returnRef = null;
      if (form.returnJourney && form.returnDate && form.returnTime) {
        const flip = (d) =>
          d === "Airport → Destination" ? "Destination → Airport" : "Airport → Destination";
        returnRef = await insertLeg({
          ...shared,
          flight_number:      form.returnFlight?.trim() || null,
          direction:          flip(form.direction),
          airport:            form.airport,
          dropoff_address:    dest,
          travel_date:        form.returnDate,
          travel_time:        form.returnTime,
          driver_id:          null,
          assigned_driver_id: null,
          status:             "Unassigned",
          notes:              `Return leg of ${ref}`,
        });
        markBookingCreated(returnRef);
        dispatchJobToDriverApp({
          bookingRef: returnRef,
          customer: form.customer,
          route: `${dest} → ${form.airport}`,
          flight: form.returnFlight,
          pickupTime: `${form.returnDate}T${form.returnTime}`,
          price: form.price ? `£${form.price}` : "TBC",
          driver: null,
          status: "Unassigned",
        }).catch(() => {});
      }

      await fetchBookings();
      return { ref, returnRef };
    },
    [fetchBookings]
  );

  const assignDriver = useCallback(async (id, driverId, driverName) => {
    const current = bookingsRef.current.find((b) => b.id === id);
    const currentStatus = current?.status ?? "";

    let newStatus = null;
    if (driverId) {
      if (currentStatus === "Unassigned" || currentStatus === "Unassigned / Missed Call Recovery") newStatus = "Dispatched";
    } else {
      if (currentStatus === "Dispatched" || currentStatus === "Unassigned / Missed Call Recovery") newStatus = "Unassigned";
    }

    const snapshot = bookingsRef.current;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, driverId: driverId || null, driver: driverName ?? (driverId ? b.driver : "Unassigned"), ...(newStatus ? { status: newStatus } : {}) } : b
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

  const updateNotes = useCallback(async (id, notes) => {
    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, notes: notes ?? "" } : b)));

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

  const togglePriority = useCallback(async (id) => {
    const current = bookingsRef.current.find((b) => b.id === id);
    const newPriority = !current?.priority;

    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, priority: newPriority } : b)));

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

  const updatePaymentStatus = useCallback(async (id, paymentStatus) => {
    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, paymentStatus } : b)));

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

  const updatePaymentMethod = useCallback(async (id, paymentMethod) => {
    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, paymentMethod } : b)));

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase
        .from("bookings")
        .update({ payment_method: paymentMethod })
        .eq("ref", id);
      if (err) throw new Error(err.message);
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  // Edit an existing booking's details (passengers, bags, time, addresses, etc.).
  // `fields` is a partial of shaped-booking keys; only the keys present are
  // written. Optimistically merges locally, then re-fetches authoritative data
  // (so derived values like route/pickupTime stay correct) and rolls back on error.
  const updateBooking = useCallback(async (id, fields) => {
    const FIELD_TO_COLUMN = {
      customer:       (v) => ({ customer_name: sanitizeText(v, 120) }),
      phone:          (v) => ({ customer_phone: sanitizeText(v, 30) }),
      email:          (v) => ({ customer_email: v?.trim() || null }),
      flight:         (v) => ({ flight_number: v?.trim() || null }),
      passengers:     (v) => ({ passengers: v === "" || v == null ? null : Number(v) }),
      luggage:        (v) => ({ luggage: (v ?? "").toString().trim() || null }),
      pickupLocation: (v) => ({ pickup_location: v?.trim() || null }),
      dropoffAddress: (v) => ({ dropoff_address: v?.trim() || null }),
      airport:        (v) => ({ airport: v?.trim() || null }),
      travelDate:     (v) => ({ travel_date: v || null }),
      time:           (v) => ({ travel_time: v || null }),
      price:          (v) => ({ quoted_price: v === "" || v == null ? null : Number(v) }),
      vehicleType:    (v) => ({ vehicle_type: v?.trim() || null }),
    };

    const dbPatch = {};
    for (const [k, v] of Object.entries(fields)) {
      if (FIELD_TO_COLUMN[k]) Object.assign(dbPatch, FIELD_TO_COLUMN[k](v));
    }
    // When the pickup date/time changes, clear the stored pickup_time so the
    // display falls back to the edited travel_date + travel_time consistently.
    if ("travelDate" in fields || "time" in fields) dbPatch.pickup_time = null;
    if (Object.keys(dbPatch).length === 0) return;

    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...fields } : b)));

    if (!isConfigured) return;

    try {
      const { error: err } = await supabase.from("bookings").update(dbPatch).eq("ref", id);
      if (err) throw new Error(err.message);
      await fetchBookings();
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, [fetchBookings]);

  const deleteBooking = useCallback(async (id, password) => {
    if (!password?.trim()) throw new Error("Enter your password to confirm deletion.");

    // Second-factor style confirmation: re-verify the operator's password
    // immediately before this destructive action.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user?.email) {
      throw new Error("You must be signed in to delete a booking.");
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password,
    });
    if (authError) throw new Error("Password verification failed.");

    const snapshot = bookingsRef.current;
    setBookings((prev) => prev.filter((b) => b.id !== id));

    if (!isConfigured) return true;

    try {
      const { error: err } = await supabase.from("bookings").delete().eq("ref", id);
      if (err) throw new Error(err.message);
      return true;
    } catch (err) {
      setBookings(snapshot);
      throw err;
    }
  }, []);

  return { bookings, totalCount, loading, loadingMore, loadMore, error, createBooking, updateStatus, assignDriver, updateNotes, togglePriority, updatePaymentStatus, updatePaymentMethod, updateBooking, deleteBooking, refetch: fetchBookings };
}
