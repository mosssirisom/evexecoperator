# Cost policy (hard constraint — read before doing anything)

**We do not pay for any additional cost, under any circumstance, without explicit prior approval from the user.**

This applies to all three repos in this project (`evexec`, `evexecoperator`, `evexecdriverapp`) and to the shared Supabase project (`yoltkmhtxwluqxxpewbl`) they all depend on.

- **No new billed resources, ever, without asking first.** This includes (not an exhaustive list): Supabase database branches, additional Supabase projects, upgraded Supabase/Vercel plan tiers or add-ons, new paid third-party APIs or SaaS tools, additional cloud compute, paid monitoring/observability tiers, domain purchases, etc.
- **Twilio SMS is dormant (user decision, 2026-10-03).** All Twilio sending (SMS, WhatsApp, voice) across the three repos is gated behind an `SMS_ENABLED=true` env var / Supabase secret, which is unset, so nothing is sent or billed. Customer updates are now sent manually from the driver's or operator's own phone via pre-filled `sms:` links. Do not set `SMS_ENABLED`, remove the gate, or add new Twilio-sending flows without explicit approval.
- **Before taking any action that would create a new billed resource or increase spend on an existing one, stop and ask.** This applies even to trivially small amounts (pennies, hourly micro-charges) — the rule is "always ask first," not "ask only above some threshold."
- **Prefer free tiers and already-provisioned infrastructure.** When a task could be done either by spinning up a paid resource (e.g. a Supabase branch to test a migration) or by a slower/more careful free alternative (e.g. read-only validation queries plus additive, reversible migrations applied directly, with review), default to the free alternative unless the user has explicitly approved the paid one.
- Abandon or redesign any plan that turns out to require a new cost, rather than proceeding and asking forgiveness after the fact.

<!-- BEGIN:nextjs-agent-rules -->

# Date and time format (hard rule, user decision)

**Every date anywhere in EV Exec is DD/MM/YYYY. Every time is 24-hour HH:MM, UK time.** This applies to all three repos (`evexec`, `evexecoperator`, `evexecdriverapp`) and the shared Supabase project: screens, emails, texts (including two-tap `sms:` messages), push notifications, PDFs/invoices, subjects, toasts and database templates. Never show `YYYY-MM-DD`, US order, or a written-out month.

- Plain `YYYY-MM-DD` values are rearranged directly (no `Date` parsing, so no timezone can shift the day). Use the shared helpers: `evexec/lib/format.js` `fmtDate`, `evexecoperator/src/lib/dates.ts` (`fmtDate`, `fmtDateTime`), `evexecdriverapp/lib/format.ts` (`formatDate`, `formatStamp*`). In SQL use `to_char(..., 'DD/MM/YYYY')`.
- Timestamps are shown in `Europe/London` time.
- Only exception: native `<input type="date">` / `<input type="time">` pickers, which follow the phone's own settings.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Update — 2026-10-14: payment links by email + two-tap text (live)

`/api/payment-link` no longer queues a Twilio SMS (it never sent: Twilio is dormant). It creates the Stripe checkout, emails it via Resend in the shared design (`paymentLink` from `src/lib/email/content.js`) when the booking has an email, and returns `smsHref` (an `sms:` link with the message pre-written, house date style) when it has a phone. The booking drawer's "Send payment link" button then shows "Text link to customer" (opens Messages, operator presses Send) and "Copy link". Payment is still recorded by the website's Stripe webhook (`metadata[booking_ref]`).

## Update — 2026-10-14: Settings saved to the database, dead controls removed (SaaS quick wins)

- **Settings → Business** saves to the operator's own `tenants` row (name, contact email/phone, and the invoice letterhead in `brand.invoice`) through the `update_tenant_profile` RPC (operator_admin or super_admin only; migration `20261014120000_tenant_profile_settings.sql` in `evexec`). Hook: `src/hooks/operator/useTenantProfile.js`. Nothing in Settings uses localStorage any more (the old `evexec_settings` key is ignored).
- **Invoices** read the letterhead from the same row (`companyFrom()` in `invoices/page.jsx`), with the old fixed values only as a fallback.
- **Prices** (superseded 15/10/2026, see below): `src/lib/prices.ts` was a copy of the website's price list. Settings → Prices showed it read-only; the New Booking form suggests the price per leg from it (`fixedLegPrice`: one-way fare, or half the return fare on each leg when "Return journey" is ticked, since each leg is invoiced and paid on its own; it used £160/£145 from browser storage before). The suggestion follows the route and the return tick until the operator types a price. Invoices use the business name (Settings saves it as `brand.invoice.business_name` too; there is no separate invoice-name field).
- **Security**: "Change password" now really changes it (checks the current password first). The two-factor and session-timeout switches were removed (they did nothing).
- **Removed** because they did nothing: notification "Alert preferences" toggles, "Auto-assign" and "Show prices" switches, waiting/child-seat rates, the WhatsApp channel, the SMS on/off and "SMS only when necessary" switches (Twilio is dormant), the Google Maps "coming soon" item. "Demo mode" status label renamed "Not connected".
- **Redirect-only pages** (`/`, `/operator`, `/operator/dashboard`, `/operator/bookings`) are now `redirects()` in `next.config.mjs`, same destinations.

## Update — 2026-10-14: navigation & screen consolidation (SaaS phase 1)

- **One shell context** (`src/components/operator/OperatorContext.jsx`, provided by `Layout.jsx`): `openNewBooking(initialValues, { eyebrow, heading, onCreated })` opens the one New Booking form (`BookingModal`); `inbox` holds quote requests, missed calls and website messages (single subscription each) and the unread count; `profile` is the signed-in user (name, email, role) and the business (`tenants` row). Use these instead of loading the same data again in a screen.
- **Navigation** (`Sidebar.jsx`): labelled sidebar with the business name from lg, icon rail with small labels on tablets, phone bar = Calendar, Dispatch, Inbox, Drivers + "More" sheet (Invoices, Analytics, Settings, Driver app, Booking page, Sign out). Inbox shows a red count badge everywhere.
- **New screens/sections**: `/operator/inbox` (quotes → "Create Booking" opens the main form pre-filled via `quoteToBookingForm()`, quote marked converted on create; missed calls; messages). Settings → Activity log (`booking_audit_log`). Settings sections deep-link with `?section=` (e.g. `security`).
- **Header**: account menu (name, role, business, Settings, Change password, Sign out) replaces the fixed "Operator / Control Room" chip and separate sign-out button. The bell is new bookings only, with a link to the Inbox for everything else.
- **Calendar** (`CalendarApp.tsx`) is now only the month view + selected day (side by side on desktop). Its old Transfers / Inbox / Fleet / Activity tabs, its second booking form (`AddBookingModal`), its own header and its duplicate new-booking chime were removed.
- **Removed fake data**: driver "Rating" (always 5.0, nothing collects ratings). Analytics month labels are MM/YYYY (house date style). Invoice "Thank you for choosing …" uses the business name.
- **Airport detection** is one helper, `looksLikeAirport()` in `src/lib/bookingUtils.ts`, case-insensitive. The five old copies only matched lower-case "airport", so typed names like "Manchester Airport" were saved as Point to Point with no airport and got no price suggestion.

## Update — 2026-10-14: Today + one Bookings screen (SaaS phase 2)

- **Navigation is now** Today, Bookings, Inbox, Drivers, Invoices, Analytics, Settings (phone: Today, Bookings, Inbox, Drivers + More). `/`, `/operator` and `/operator/dashboard` go to Today; `/operator/dispatch` → `/operator/bookings` and `/operator/calendar` → `/operator/bookings?view=calendar` (redirects in `next.config.mjs`; `?q=` passes through, so website/push links still find the job).
- **Today** (`/operator/today`): summary tiles, "Needs you" (website requests to accept, jobs in the next 48 h with no driver, completed jobs unpaid), today's jobs in time order, drivers' day. Definitions live in `src/lib/operator/bookingBuckets.js` (shared with the Board, tested).
- **Bookings** (`/operator/bookings?view=list|calendar|board`): List = the old Dispatch board (`components/operator/BookingsList.jsx`, its "Today's Schedule" sub-view removed; Today covers it; desktop rows now show the date), Calendar = `CalendarApp`, Board = `components/operator/BookingsBoard.jsx` (next 7 days by Needs reply / Needs driver / Driver assigned / On the road / Done today).
- **One booking drawer**: `useBookingDrawer(api, drivers)` (`components/operator/useBookingDrawer.jsx`) holds the drawer and all its actions; every list uses it. Return journeys open the shell's New Booking form.
- **Bookings loading window (bug fix)**: `useBookings()` used to load the 100 OLDEST bookings, so upcoming jobs would have dropped off once there were more than 100 (71 on 14/10/2026). Now `scope: "operational"` (default) loads from 14 days ago (UK date) onwards plus undated, with "Show earlier bookings" (`loadEarlier`); `scope: "all"` for Analytics and the customer look-up. The 60-second refresh keeps pages already loaded.
- **Status pills** (`lib/operator/statusColor.js`) use dark text on pale fills; the old dark-theme colours were near-unreadable on white.

## Update — 2026-10-14: Customers, Team & roles, password emails, setup checklist (SaaS phase 3)

- **Customers** (`/operator/customers`): built from all bookings (no customer table); bookings are one customer when they share a phone (UK formats normalised, `+44…` = `0…`) or email, transitively (`src/lib/operator/customers.js`, tested). Shows trips, last/next trip, paid and unpaid (completed, not paid, not cash). Opening a customer lists their bookings (shared booking drawer) and "New booking for …" pre-fills the main form.
- **Team & roles** (Settings → Team, `src/components/operator/TeamSettings.jsx` → `/api/team`): list staff (`tenant_users` roles `operator_admin` = Admin, `dispatcher` = Dispatcher), invite, change role, resend invite, remove. All checked server-side with the service role (`src/lib/server/staff.ts`): only an admin (or super_admin) changes anything; you can't change/remove yourself; the business always keeps an admin; one staff role per person (changing replaces); removing takes office access only (a driver role stays). Drivers are still added on the Drivers screen. Tests: `src/app/api/team/team.test.ts`.
- **Password emails without Supabase's redirect allow-list**: invites and resets use `auth.admin.generateLink` and email our own link `<app>/set-password?token_hash=…&type=invite|recovery` via Resend (`src/lib/email/staff.js`, house template; kept out of content.js/template.js so those stay identical to the website). `/set-password` verifies with `verifyOtp`, then sets the password (and name for new people). Optional env `NEXT_PUBLIC_OPERATOR_URL` fixes the link host (otherwise the request's own origin).
- **Forgot password?** on the sign-in screen now works (it was a button with no action): `/api/auth/forgot` emails a reset link only to staff; every reply is the same, so it can't reveal who has an account.
- **Setup checklist** on Today (`SetupChecklist.jsx`), admins only: contact details, invoice letterhead, first driver, invite team (optional), new-booking alerts on this device (only where the browser supports push), first booking. Disappears when done or hidden (per browser).

## Update — 2026-10-14: Bookings → List redesign

- **Tapping a job opens it** (phone/tablet cards had a full-card button hidden under the card content, so taps did nothing). Cards and desktop rows are now the click target themselves; driver, call, status and Accept/Decline controls stop the click so they don't also open the drawer.
- **Views instead of 8 status chips**: Upcoming (default) / Needs action ("To do" on phones) / Past / All, with counts. Rules in `src/lib/operator/bookingBuckets.js` (`isPast`, `needsAction`, `LIST_VIEWS`, tested). A `?q=` link opens on All so search links still find old jobs.
- **Grouped by day** with sticky headings ("Today · Wed 14/10/2026"); Past is newest first. Desktop uses the same groups as rows (time, customer + ref, two-line route, driver, price, status) instead of the old table.
- **Removed**: the desktop "Dispatch" button (`DispatchButton.jsx`) and the no-op module behind it (`src/lib/operator/driverApp.js`: `dispatchJobToDriverApp`/`updateJobStatus` did nothing, so the button showed "Sent" while nothing happened). Drivers get jobs through the database when assigned. Also removed the ETA column, "Assign driver" on finished jobs, and "NOT CONFIRMED" on completed jobs.
- **Pickup times are UK time everywhere, whatever the device's timezone.** `src/lib/dates.ts` has `ukToIso(date, time)` (UK wall clock → real moment, handles BST/GMT and clock-change days), `ukDateOf()` and `ukHourOf()` (tested, also under `TZ=America/New_York`). `useBookings` builds `pickupTime` with it when `pickup_time` is empty (was parsed in the device's own zone), new bookings and date/time edits now store `pickup_time` (edits used to clear it), `BookingCard.tsx` saves with it, and the Drivers "today" list, Analytics "today" and hour bars, the drivers' completed-today count (now by `travel_date`) and the list's day groups use UK dates. The drawer shows the booking's own date and time. Live data checked: no stored `pickup_time` disagreed with `travel_time`.

## Update — 2026-10-15: per-operator prices (live database, Operator app + website)

- Each business's fixed prices are in `tenants.pricing` (`{ airports: [{ name, code?, one_way, return_fare }], extra_stop }`), saved only through the `update_tenant_pricing` RPC (operator_admin of that tenant or super_admin; shape and amounts checked; migration `20261015090000_tenant_pricing.sql` in `evexec`, applied; EV Exec seeded with the previous list).
- **Settings → Prices** is editable for admins (add/remove destinations, optional 3–4 letter code, one-way and return, extra-stop charge); others see it read-only. Saves via `useTenantProfile().savePricing`, then reloads the shell profile.
- `src/lib/prices.ts`: `pricingFromTenant()` (stored → `{ airports, extraStop }`, falls back to `DEFAULT_PRICING` when missing), `pricingForSave()`, `pricingProblem()` (same rules as the database), and `fixedLegPrice(location, isReturn, airports)`. The shell context exposes `profile.pricing`; the New Booking form suggests a price when either end of the trip names a listed destination (not only airports).
- The website reads the same row (`evexec/lib/pricing.js`) for its booking form and booking API. Its generated marketing pages still have the prices built in (`evexec/scripts/site/data.js`) and need a rebuild after a change.
