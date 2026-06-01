// Read at call time so vi.stubEnv() works correctly in tests.
function getDriverAppUrl() {
  return import.meta.env.VITE_DRIVER_APP_URL ?? "https://evexecdriverapp.vercel.app";
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

/**
 * Retries an async function on transient failures (network errors, 5xx responses).
 * 4xx client errors are NOT retried — they indicate a bad request that won't
 * succeed on retry.
 *
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number; backoffMs?: number }} [opts]
 * @returns {Promise<T>}
 */
async function withRetry(fn, { maxAttempts = 3, backoffMs = 500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Determine if this is a transient error worth retrying
      const isServerError = /returned 5\d\d/.test(err.message);
      const isNetworkError = err instanceof TypeError && /fetch|network/i.test(err.message);
      const isTransient = isServerError || isNetworkError;

      if (!isTransient || attempt === maxAttempts - 1) throw err;
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ─── Driver app bridge ────────────────────────────────────────────────────────

/**
 * Dispatches a new job to the EV Exec Driver App via POST /api/jobs.
 * Retries up to 3 times on 5xx / network errors before throwing.
 * In demo mode (VITE_DRIVER_APP_URL unset) returns a mock success immediately.
 */
export async function dispatchJobToDriverApp(job) {
  if (!import.meta.env.VITE_DRIVER_APP_URL) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, mock: true, jobId: job.bookingRef };
  }

  return withRetry(async () => {
    const res = await fetch(`${getDriverAppUrl()}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Driver app returned ${res.status}: ${text}`);
    }

    return res.json();
  });
}

/**
 * Notifies the driver app of a status change on an existing job via
 * PATCH /api/jobs/:ref.
 * Retries up to 3 times on transient errors.
 * In demo mode returns a mock success.
 */
export async function updateJobStatus(bookingRef, status) {
  if (!import.meta.env.VITE_DRIVER_APP_URL) {
    await new Promise((r) => setTimeout(r, 200));
    return { ok: true, mock: true };
  }

  return withRetry(async () => {
    const res = await fetch(
      `${getDriverAppUrl()}/api/jobs/${encodeURIComponent(bookingRef)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Driver app returned ${res.status}: ${text}`);
    }

    return res.json();
  });
}
