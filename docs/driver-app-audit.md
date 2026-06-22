# EV Exec Driver App — Market Audit & Gap Analysis

> Scope note: `evexecdriverapp` source is in a separate repository. This audit is
> reconstructed from the **shared Supabase data model** and the **operator↔driver
> integration contract** visible in this repo (`/api/jobs` dispatch bridge,
> `drivers`/`bookings` tables, notification + availability tables), then
> benchmarked against best-in-market driver apps. Capability gaps are inferred
> from the absence of supporting data structures, not from reading driver-app code.

## Benchmark set
Premium airport-transfer / chauffeur context → **Blacklane, Wheely, Addison Lee**
(executive), plus **Uber / Bolt / Lyft Driver** (UX standards) and **Onfleet**
(dispatch / proof-of-delivery).

## What the driver app does today (reconstructed)
- Receives jobs from the operator via `POST /api/jobs`; status pushed via `PATCH /api/jobs/:ref`.
- Shares one Supabase backend: `bookings`, `drivers`, `driver_unavailable_dates`, notifications.
- Driver model: `name, phone, email, vehicle, plate, status, rating`.
- Job lifecycle the driver drives: `Dispatched → En Route → Passenger On Board → Completed` (or `Cancelled`).
- Day-off scheduling exists; operator-side licence/insurance/MOT expiry tracking exists.

## Gaps by severity

### P0 — table stakes (no supporting data exists today)
| Gap | Evidence | Impact |
|---|---|---|
| Live GPS location / tracking | No lat/lng/heading columns anywhere | No live ETA, no map, no "driver 6 min away" |
| Turn-by-turn navigation hand-off | No nav deeplink/route data | Drivers expect one-tap Navigate |
| Proof of pickup / completion | No photo/signature/POB-timestamp fields | No dispute/billing evidence |
| Push notifications to drivers | No device-token table | Missed jobs when app backgrounded |

### P1 — premium differentiators
- Live flight status on the driver side (operator has `check-flight`; driver side blind to delays).
- Job **Offered → Accepted/Declined** loop with timeout + auto-reassign (today jumps straight to Dispatched).
- In-app masked driver↔passenger contact (only free-text `driver_notes` + `contact_method`).
- Driver earnings / payout visibility.
- Two-way ratings capture (`drivers.rating` exists but nothing populates it).
- Airport meet-&-greet / arrivals / name-board workflow.

### P2 — operational maturity
- Driver self-service compliance uploads + expiry reminders.
- Safety: SOS / incident report / share-trip.
- Waiting-time, tolls, extra-stop capture (revenue leakage).
- Offline write-queue for status updates (airport dead zones).
- Clock-in/out / online-offline utilisation.

## Meta-finding
The platform is **operator-push dispatch with a thin driver client**: the driver
app receives jobs and reports status but is not the system of record for
location, acceptance, proof, or economics. Best-in-market inverts this — the
driver client is the sensor (GPS, acceptance, proof, earnings) and the back
office subscribes to it. Closing P0 flips the architecture onto that model.

## Recommended changes (mapped to this stack)

**P0**
1. **Live location** — `driver_locations` table + Supabase Realtime; driver app upserts every ~10s on active jobs; operator dashboard + customer page subscribe → real ETAs + live map. *(Backend + operator side started in `003_driver_live_tracking.sql` + `useDriverLocations`.)*
2. **Acceptance state machine** — `Offered → Accepted/Declined` before `Dispatched`; `POST /api/jobs/:ref/accept|decline` with timeout auto-reassign.
3. **Driver push** — `device_tokens` + web-push/FCM on offer/assignment/cancellation.
4. **Proof of job** — `pob_at`, `completed_at`, `job_proofs` storage bucket (photo/signature).

**P1**
5. Live flight status in-app reusing the `check-flight` function with delay-shifted suggested pickup.
6. Masked contact / quick messages via the existing SMS function.
7. Earnings view — `job_fees` (base, waiting, extras, total) + weekly summary.
8. Two-way ratings table + post-completion prompt feeding `drivers.rating`.

**P2**
9. Compliance self-service uploads + expiry reminders (close the loop on operator tracking).
10. Safety — SOS + share-trip link.
11. Waiting-time / extras capture at job level.
12. Offline status write-queue.

## Status of this work
- [x] Audit written (this doc)
- [x] P0 #1 schema: `driver_locations` (`supabase/migrations/003_driver_live_tracking.sql`)
- [x] P0 #1 operator side: `useDriverLocations` hook + live presence badge in Fleet view
- [ ] P0 #1 live map + GPS-derived ETA (next increment)
- [ ] P0 #2 acceptance state machine
- [ ] P0 #3 driver push tokens
- [ ] P0 #4 proof-of-job capture
