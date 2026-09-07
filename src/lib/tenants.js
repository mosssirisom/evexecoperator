/**
 * Client-side callers for the manage-tenants edge function (super-admin
 * tenant management). Every call requires the signed-in user to be a
 * super_admin -- the edge function itself enforces this, these helpers just
 * shape the request/response.
 */

import { supabase, isConfigured } from "./supabase";

async function invoke(action, params = {}) {
  if (!isConfigured || !supabase) {
    return { ok: false, reason: "Supabase not configured" };
  }
  try {
    const { data, error } = await supabase.functions.invoke("manage-tenants", {
      body: { action, ...params },
    });
    if (error) {
      // supabase-js surfaces non-2xx responses as an error without the
      // parsed body, so fall back to a generic message rather than crash.
      return { ok: false, reason: error.message || "Request failed" };
    }
    return data;
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export function listTenants() {
  return invoke("list_tenants");
}

export function createTenant({ slug, name, contactEmail, contactPhone }) {
  return invoke("create_tenant", { slug, name, contactEmail, contactPhone });
}

export function listTenantUsers(tenantId) {
  return invoke("list_tenant_users", { tenantId });
}

export function inviteOperatorAdmin({ tenantId, email, redirectTo }) {
  return invoke("invite_operator_admin", { tenantId, email, redirectTo });
}
