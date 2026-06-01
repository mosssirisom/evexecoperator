const DRIVER_APP_URL = import.meta.env.VITE_DRIVER_APP_URL ?? "https://evexecdriverapp.vercel.app";

/**
 * Dispatches a job to the EV Exec Driver App.
 * The driver app is expected to expose POST /api/jobs.
 *
 * In demo mode (no env var set) this is a no-op that returns a mock response
 * so the operator UI still shows dispatch feedback without a live driver app.
 */
export async function dispatchJobToDriverApp(job) {
  const isDev = !import.meta.env.VITE_DRIVER_APP_URL;
  if (isDev) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, mock: true, jobId: job.bookingRef };
  }

  const res = await fetch(`${DRIVER_APP_URL}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Driver app returned ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Notifies the driver app of a status change on an existing job.
 * Uses PATCH /api/jobs/:ref.
 */
export async function updateJobStatus(bookingRef, status) {
  const isDev = !import.meta.env.VITE_DRIVER_APP_URL;
  if (isDev) {
    await new Promise((r) => setTimeout(r, 200));
    return { ok: true, mock: true };
  }

  const res = await fetch(`${DRIVER_APP_URL}/api/jobs/${encodeURIComponent(bookingRef)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Driver app returned ${res.status}: ${text}`);
  }

  return res.json();
}
