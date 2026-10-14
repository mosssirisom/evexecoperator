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
- **Prices**: `src/lib/prices.ts` is a copy of the website's price list (keep in sync with `evexec/lib/format.js` PRICES). Settings → Prices shows it read-only; the New Booking form suggests the price per leg from it (`fixedLegPrice`: one-way fare, or half the return fare on each leg when "Return journey" is ticked, since each leg is invoiced and paid on its own; it used £160/£145 from browser storage before). The suggestion follows the route and the return tick until the operator types a price. Invoices use the business name (Settings saves it as `brand.invoice.business_name` too; there is no separate invoice-name field).
- **Security**: "Change password" now really changes it (checks the current password first). The two-factor and session-timeout switches were removed (they did nothing).
- **Removed** because they did nothing: notification "Alert preferences" toggles, "Auto-assign" and "Show prices" switches, waiting/child-seat rates, the WhatsApp channel, the SMS on/off and "SMS only when necessary" switches (Twilio is dormant), the Google Maps "coming soon" item. "Demo mode" status label renamed "Not connected".
- **Redirect-only pages** (`/`, `/operator`, `/operator/dashboard`, `/operator/bookings`) are now `redirects()` in `next.config.mjs`, same destinations.
