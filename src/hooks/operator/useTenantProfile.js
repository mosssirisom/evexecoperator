"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";

/**
 * The signed-in staff member's operator business (their public.tenants row):
 * name, contact details and the invoice letterhead in brand.invoice. Saved via
 * the update_tenant_profile RPC, which only lets an operator_admin (or
 * super_admin) change it, so every staff device sees the same details.
 *
 * A super_admin has no tenant of their own; they edit the first (today, the
 * only) tenant.
 */
export function useTenantProfile() {
  const [tenant, setTenant] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) { setLoading(false); return; }
      const { data: roles } = await supabase
        .from("tenant_users")
        .select("tenant_id, role")
        .eq("user_id", userId);
      const own = (roles || []).find((r) => r.tenant_id);
      const isSuper = (roles || []).some((r) => r.role === "super_admin");
      let q = supabase.from("tenants").select("id, name, contact_email, contact_phone, brand");
      q = own ? q.eq("id", own.tenant_id) : q.order("created_at", { ascending: true }).limit(1);
      const { data, error: tErr } = await q.maybeSingle();
      if (tErr) throw tErr;
      setTenant(data || null);
      setCanEdit(
        isSuper || (roles || []).some((r) => r.role === "operator_admin" && data && r.tenant_id === data.id),
      );
    } catch (e) {
      setError(e?.message || "Could not load business details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async ({ name, contactEmail, contactPhone, invoice }) => {
    if (!tenant) throw new Error("No business to update.");
    const { data, error: rpcErr } = await supabase.rpc("update_tenant_profile", {
      p_tenant_id: tenant.id,
      p_name: name,
      p_contact_email: contactEmail,
      p_contact_phone: contactPhone,
      p_invoice: invoice,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    setTenant(data);
    return data;
  }, [tenant]);

  return { tenant, canEdit, loading, error, save, reload: load };
}
