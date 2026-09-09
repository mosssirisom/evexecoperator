/**
 * Supabase Edge Function: integration-status
 *
 * Reports whether the third-party integrations used by the operator
 * dashboard have their required secrets configured. Performs no external
 * API calls and has no side effects — it only checks for the presence of
 * environment variables, so it's safe to call from the Settings page on
 * every load.
 *
 * Response:
 *   {
 *     ok: true,
 *     integrations: {
 *       twilio: boolean,       // TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *       stripe: boolean,       // STRIPE_SECRET_KEY
 *       aerodatabox: boolean,  // AERODATABOX_API_KEY
 *     },
 *   }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isSet(name: string): boolean {
  return !!Deno.env.get(name)?.trim();
}

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      integrations: {
        twilio: isSet("TWILIO_ACCOUNT_SID") && isSet("TWILIO_AUTH_TOKEN") && isSet("TWILIO_FROM_NUMBER"),
        stripe: isSet("STRIPE_SECRET_KEY"),
        aerodatabox: isSet("AERODATABOX_API_KEY"),
      },
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
