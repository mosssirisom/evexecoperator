import { supabase, isConfigured } from "./supabase";

export async function logError({ message, stack, componentStack, context }) {
  if (!isConfigured) return;

  try {
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user ?? null;

    const { error } = await supabase.from("error_log").insert({
      message,
      stack: stack ?? null,
      component_stack: componentStack ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_email: user?.email ?? null,
      context: context ?? null,
    });

    if (error) console.warn("[ErrorLog] Failed to record error:", error.message);
  } catch (err) {
    console.warn("[ErrorLog] Failed to record error:", err.message);
  }
}
