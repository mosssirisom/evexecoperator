import { createClient } from "@supabase/supabase-js";

// Stores (or removes) a signed-in operator's browser push subscription.
// POST   { subscription, label } → upsert by endpoint
// DELETE { endpoint }            → remove

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function requireOperator(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { admin, userId: data.user.id };
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Push isn't configured." }, 503);
  const ctx = await requireOperator(req);
  if (!ctx) return json({ error: "Not authorised." }, 401);

  let body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; label?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid body." }, 400); }

  const sub = body.subscription;
  const endpoint = sub?.endpoint?.trim();
  const p256dh = sub?.keys?.p256dh?.trim();
  const auth = sub?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) return json({ error: "Invalid subscription." }, 422);

  const { error } = await ctx.admin
    .from("operator_push_subscriptions")
    .upsert(
      { endpoint, p256dh, auth, label: body.label ?? null, user_id: ctx.userId },
      { onConflict: "endpoint" }
    );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Push isn't configured." }, 503);
  const ctx = await requireOperator(req);
  if (!ctx) return json({ error: "Not authorised." }, 401);
  let body: { endpoint?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid body." }, 400); }
  const endpoint = body.endpoint?.trim();
  if (!endpoint) return json({ error: "Missing endpoint." }, 400);
  await ctx.admin.from("operator_push_subscriptions").delete().eq("endpoint", endpoint);
  return json({ ok: true });
}
