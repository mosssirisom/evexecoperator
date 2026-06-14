// Driver app receives job updates via Supabase Realtime subscriptions on the
// bookings table (filtered by assigned_driver_id). No REST push needed.

export async function dispatchJobToDriverApp(_job) {
  return { ok: true }
}

export async function updateJobStatus(_bookingRef, _status) {
  return { ok: true }
}
