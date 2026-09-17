"use client";

import { supabase } from "@/lib/supabase";

export type Direction = "arrival" | "departure";
export type Severity = "green" | "amber" | "red";

export interface FlightVerification {
  id: string;
  booking_id: string;
  direction: Direction;
  flight_number: string;
  flight_date: string;
  departure_airport_input: string | null;
  arrival_airport_input: string | null;
  customer_time_input: string | null;
  result: "verified" | "mismatch" | "unavailable" | "error";
  severity: Severity;
  issues: string[];
  flight_status: string | null;
  departure_iata: string | null;
  arrival_iata: string | null;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  estimated_departure: string | null;
  estimated_arrival: string | null;
  actual_departure: string | null;
  actual_arrival: string | null;
  recommended_pickup: string | null;
  buffer_minutes_used: number | null;
  source: "manual" | "auto_initial" | "auto_day_before";
  verified_by: string | null;
  verified_by_name: string | null;
  verified_at: string;
  override: boolean;
  override_reason: string | null;
}

export interface VerifyOptions {
  leg?: "outbound" | "return";
  direction?: Direction;
  source?: "manual" | "auto_initial" | "auto_day_before";
  override?: boolean;
  overrideReason?: string;
}

/** "Sat 27 Aug, 01:05" -- the exact style requested for verified flight times. */
export function formatFlightDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
  const timePart = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });
  return `${datePart}, ${timePart}`;
}

export async function fetchLatestVerification(bookingId: string): Promise<FlightVerification | null> {
  const { data, error } = await supabase
    .from("flight_verifications")
    .select("*")
    .eq("booking_id", bookingId)
    .order("verified_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as FlightVerification) ?? null;
}

export async function runFlightVerification(bookingId: string, opts: VerifyOptions = {}): Promise<FlightVerification> {
  const { data, error } = await supabase.functions.invoke("verify-flight", {
    body: { bookingId, ...opts },
  });
  if (error) throw new Error(error.message || "Verification request failed");
  if (!data?.ok) throw new Error(data?.error || "Verification failed");
  return data.verification as FlightVerification;
}

export async function fetchPickupBufferMinutes(tenantId?: string): Promise<number> {
  let query = supabase.from("flight_verification_settings").select("pickup_buffer_minutes").limit(1);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error || !data?.length) return 45;
  return data[0].pickup_buffer_minutes ?? 45;
}

export async function setPickupBufferMinutes(minutes: number): Promise<void> {
  const { data: settings } = await supabase.from("flight_verification_settings").select("tenant_id").limit(1);
  const tenantId = settings?.[0]?.tenant_id;
  if (!tenantId) throw new Error("No tenant settings row found");
  const { error } = await supabase
    .from("flight_verification_settings")
    .update({ pickup_buffer_minutes: minutes, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}
