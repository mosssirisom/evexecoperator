import { supabase, isConfigured } from "./supabase";

// Records an operator action for the activity log. Best-effort: never throws,
// so a logging failure can't block the booking/driver/missed-call action it
// describes.
export async function logActivity({ action, entityType, entityId, details }) {
  if (!isConfigured) return;

  try {
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user ?? null;

    const { error } = await supabase.from("audit_log").insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      details: details ?? null,
    });

    if (error) console.warn("[AuditLog] Failed to record activity:", error.message);
  } catch (err) {
    console.warn("[AuditLog] Failed to record activity:", err.message);
  }
}
