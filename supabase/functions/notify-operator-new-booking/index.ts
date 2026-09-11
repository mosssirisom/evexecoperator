// notify-operator-new-booking
//
// Invoked by the `notify_operator_new_booking` DB trigger whenever a new
// website booking is inserted. Sends a Web Push notification to every
// device an operator has enabled push notifications on (see
// src/lib/operatorPush.js and the "Push notifications" toggle in
// Settings).
//
// This replaces the previous design, which had the trigger call a
// Vercel route (`evexecoperator.vercel.app/api/push/dispatch`) that
// never actually existed in this codebase, via a secret-gated RPC
// (get_push_dispatch_bundle) that was reachable by anyone on the
// internet who found or guessed the secret -- confirmed dead code with
// no legitimate caller during a security audit, since revoked. This
// function fetches the VAPID keys and subscriber list directly with the
// service-role key instead, so nothing sensitive is ever exposed via
// PostgREST.
//
// Auth: the trigger sends the same shared webhook secret as before in
// the x-webhook-secret header; this function verifies it directly
// against push_config.webhook_secret with a constant-time comparison
// rather than accepting it as a bypassable query parameter.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
// @ts-ignore - no type declarations published for this package
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://evexecoperator.vercel.app'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface Booking {
  id: string
  ref?: string | null
  customer_name?: string | null
  pickup_location?: string | null
  airport?: string | null
  dropoff_address?: string | null
  travel_date?: string | null
  travel_time?: string | null
  quoted_price?: number | null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: config } = await supabase
    .from('push_config')
    .select('vapid_public, vapid_private, vapid_subject, webhook_secret')
    .eq('id', true)
    .maybeSingle()

  const suppliedSecret = req.headers.get('x-webhook-secret') ?? ''
  if (!config?.webhook_secret || !timingSafeEqual(config.webhook_secret, suppliedSecret)) {
    return new Response(JSON.stringify({ ok: false, reason: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!config.vapid_public || !config.vapid_private) {
    return new Response(JSON.stringify({ ok: false, reason: 'VAPID keys not configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails(
    config.vapid_subject || 'mailto:book@evexec.co.uk',
    config.vapid_public,
    config.vapid_private
  )

  let booking: Booking
  try {
    const body = await req.json()
    booking = (body.record ?? body) as Booking
  } catch {
    return new Response(JSON.stringify({ ok: false, reason: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: subs } = await supabase
    .from('operator_push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'No operator subscriptions registered' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const customer = booking.customer_name ?? 'New booking'
  const pickup = booking.pickup_location ?? booking.airport ?? 'See dispatch board'
  const price = booking.quoted_price != null ? ` · £${Number(booking.quoted_price).toFixed(0)}` : ''
  const ref = booking.ref ?? booking.id.slice(0, 8).toUpperCase()

  const payload = JSON.stringify({
    title: `New booking — ${ref}`,
    body: `${customer} · ${pickup}${price}`,
    url: '/dispatch',
    tag: `new-booking-${booking.id}`,
  })

  const results = await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )

  // Remove subscriptions the push service says are gone for good.
  const expired = subs.filter((_sub: unknown, i: number) => {
    const r = results[i]
    return r.status === 'rejected' && (r as PromiseRejectedResult).reason?.statusCode === 410
  })
  if (expired.length > 0) {
    await supabase.from('operator_push_subscriptions').delete().in('id', expired.map((s: { id: string }) => s.id))
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return new Response(JSON.stringify({ ok: true, sent, total: subs.length, expiredRemoved: expired.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
