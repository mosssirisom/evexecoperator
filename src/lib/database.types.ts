// Auto-typed to match the live evexec.co.uk Supabase schema

export type BookingStatus =
  | "Unassigned"
  | "Dispatched"
  | "En Route"
  | "Arrived"
  | "Passenger On Board"
  | "Completed"
  | "Cancelled"
  | "Unassigned / Missed Call Recovery"
  | "CRITICAL_UNALLOCATED";

export type PaymentStatus = "Unpaid" | "Paid" | "Invoiced";

export interface DbBooking {
  id: string;
  ref: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  flight_number: string | null;
  direction: string | null;
  airport: string | null;
  dropoff_address: string | null;
  travel_date: string | null;
  travel_time: string | null;
  pickup_time: string | null;
  driver_id: string | null;
  quoted_price: number | null;
  status: BookingStatus;
  payment_status: PaymentStatus | null;
  priority: boolean | null;
  notes: string | null;
  updated_at: string | null;
  created_at: string | null;
  drivers?: { full_name: string } | null;

  // Optional extended journey fields from the live public booking schema.
  // These are optional because some internal/operator-created bookings do not
  // populate them, and create/update payloads should not be forced to include
  // every public website field.
  journey_type?: string | null;
  pickup_location?: string | null;
  flight?: string | null;
  destination?: string | null;
  passengers?: number | null;
  luggage?: string | null;
  return_journey?: boolean | null;
  return_pickup?: string | null;
  return_airport?: string | null;
  return_flight?: string | null;
  return_date?: string | null;
  return_time?: string | null;
  return_destination?: string | null;
  contact_method?: string | null;
  assigned_driver_id?: string | null;
  price?: number | null;
  payment_method?: string | null;
  operator_note?: string | null;
  driver_notes?: string | null;
  vehicle_type?: string | null;
  source?: string | null;

  // Proof-of-job (P0 #4) — actual clock times the driver app records.
  pob_at?: string | null;
  completed_at?: string | null;

  // Job offer / acceptance loop (P0 #2) — orthogonal to `status`.
  offer_status?: JobOfferStatus | null;
  offered_at?: string | null;
  offer_responded_at?: string | null;
  offer_expires_at?: string | null;
}

export type JobOfferStatus = "pending" | "accepted" | "declined" | "expired";

export type JobProofKind =
  | "pob_photo"
  | "signature"
  | "completion_photo"
  | "no_show_photo";

// Job proofs live in `booking_photos` (what the driver app actually writes
// to) — there is no separate `job_proofs` table backing this in the live
// schema. `kind` is nullable since older/unclassified rows may not have it.
export interface DbJobProof {
  id: string;
  booking_id: string;
  driver_id: string | null;
  kind: JobProofKind | null;
  url: string;
  caption: string | null;
  created_at: string | null;
}

export interface DbDriver {
  id: string;
  full_name: string;
  phone: string | null;
  vehicle_registration: string | null;
  vehicle_model: string | null;
  is_online: boolean;
  avatar_url: string | null;
  rating: number | null;
  battery_percent: number | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  license_expiry: string | null;
  dbs_expiry: string | null;
  pcol_expiry: string | null;
}

export interface DbMissedCall {
  id: string;
  ref: string;
  caller: string | null;
  created_at: string | null;
  attempts: number | null;
  notes: string | null;
  resolved: boolean;
}

export interface DbQuoteRequest {
  id: string;
  customer_name: string;
  phone: string;
  email: string | null;
  pickup_location: string | null;
  destination: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  passengers: number | null;
  luggage: string | null;
  return_required: boolean | null;
  return_date: string | null;
  return_time: string | null;
  return_pickup: string | null;
  return_destination: string | null;
  return_airport: string | null;
  return_flight_number: string | null;
  journey_type: string | null;
  airport: string | null;
  flight_number: string | null;
  contact_method: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
}

export const QUOTE_REQUEST_STATUS = {
  NEW: "new",
  CONVERTED: "converted",
  DISMISSED: "dismissed",
} as const;

export interface DbContactMessage {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string;
  status: string | null;
  created_at: string | null;
}

export const CONTACT_MESSAGE_STATUS = {
  NEW: "new",
  READ: "read",
} as const;

export interface DbDriverLocation {
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  booking_ref: string | null;
  updated_at: string | null;
}

export interface DbDriverUnavailableDate {
  id: string;
  driver_id: string;
  date: string;
  created_at: string | null;
}

export interface DbNotificationLog {
  id: number;
  booking_id: string;
  type: string;
  channel: string;
  sent_at: string | null;
}

export interface DbNotificationQueueItem {
  id: string;
  booking_id: string | null;
  type: string | null;
  channel: string;
  status: string | null;
  delivery_status: string | null;
  attempts: number | null;
  next_attempt_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  has_error: boolean;
}

export interface DbAuditLogEntry {
  id: number;
  booking_id: string;
  booking_ref: string;
  field: "status" | "driver" | "payment_status" | string;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  created_at: string | null;
}

export interface Database {
  public: {
    Tables: {
      bookings: {
        Row: DbBooking;
        Insert: Omit<DbBooking, "id" | "created_at" | "updated_at" | "drivers">;
        Update: Partial<Omit<DbBooking, "ref" | "created_at" | "drivers">>;
      };
      drivers: {
        Row: DbDriver;
        Insert: Omit<DbDriver, "id">;
        Update: Partial<DbDriver>;
      };
      missed_calls: {
        Row: DbMissedCall;
        Insert: Omit<DbMissedCall, "id" | "created_at">;
        Update: Partial<DbMissedCall>;
      };
      quote_requests: {
        Row: DbQuoteRequest;
        Insert: Omit<DbQuoteRequest, "id" | "created_at">;
        Update: Partial<DbQuoteRequest>;
      };
      driver_unavailable_dates: {
        Row: DbDriverUnavailableDate;
        Insert: Omit<DbDriverUnavailableDate, "id" | "created_at">;
        Update: Partial<DbDriverUnavailableDate>;
      };
      booking_photos: {
        Row: DbJobProof;
        Insert: Omit<DbJobProof, "id" | "created_at">;
        Update: Partial<DbJobProof>;
      };
      contact_messages: {
        Row: DbContactMessage;
        Insert: Omit<DbContactMessage, "id" | "created_at">;
        Update: Partial<DbContactMessage>;
      };
    };
    Views: {
      notification_log_dashboard: { Row: DbNotificationLog };
      notification_queue_dashboard: { Row: DbNotificationQueueItem };
      booking_audit_log: { Row: DbAuditLogEntry };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  "Unassigned": ["Dispatched", "Cancelled", "Unassigned / Missed Call Recovery"],
  "Unassigned / Missed Call Recovery": ["Dispatched", "Cancelled"],
  "Dispatched": ["En Route", "Arrived", "Cancelled"],
  "En Route": ["Arrived", "Passenger On Board", "Cancelled"],
  "Arrived": ["Passenger On Board", "Cancelled"],
  "Passenger On Board": ["Completed", "Cancelled"],
  "CRITICAL_UNALLOCATED": ["Dispatched", "Cancelled"],
  "Completed": [],
  "Cancelled": [],
};

export const STATUS_NEXT_PRIMARY: Record<BookingStatus, BookingStatus | null> = {
  "Unassigned": "Dispatched",
  "Unassigned / Missed Call Recovery": "Dispatched",
  "Dispatched": "En Route",
  "En Route": "Arrived",
  "Arrived": "Passenger On Board",
  "Passenger On Board": "Completed",
  "CRITICAL_UNALLOCATED": "Dispatched",
  "Completed": null,
  "Cancelled": null,
};

export const STATUS_NEXT_LABEL: Record<BookingStatus, string | null> = {
  "Unassigned": "Dispatch",
  "Unassigned / Missed Call Recovery": "Dispatch",
  "Dispatched": "Mark En Route",
  "En Route": "Mark Arrived",
  "Arrived": "Passenger On Board",
  "Passenger On Board": "Complete",
  "CRITICAL_UNALLOCATED": "Re-dispatch",
  "Completed": null,
  "Cancelled": null,
};
