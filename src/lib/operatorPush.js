/**
 * Web Push subscription management for the operator dashboard. Mirrors
 * the working pattern already used by the driver app (components/
 * job-notifier.tsx there) -- a plain upsert into operator_push_
 * subscriptions, protected by RLS scoped to the caller's own row, rather
 * than a SECURITY DEFINER bypass function.
 */

import { supabase, isConfigured } from "./supabase";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

/** Returns the current subscription status without prompting for permission. */
export async function getPushSubscriptionStatus() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "default";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "default";
  } catch {
    return "default";
  }
}

/** Requests permission (if needed) and subscribes this browser to push notifications. */
export async function subscribeToPush(userId) {
  if (!isConfigured || !pushSupported()) throw new Error("Push notifications aren't supported in this browser.");

  if (Notification.permission === "default") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notification permission was not granted.");
  }
  if (Notification.permission === "denied") {
    throw new Error("Notifications are blocked for this site. Enable them in your browser settings.");
  }

  const { data: vapidPublicKey, error: keyError } = await supabase.rpc("get_push_public_key");
  if (keyError || !vapidPublicKey) throw new Error("Push isn't configured on the server yet.");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Could not read the push subscription details.");
  }

  const { error } = await supabase.from("operator_push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      label: navigator.userAgent.slice(0, 120),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(error.message);
}

/** Unsubscribes this browser and removes its row from operator_push_subscriptions. */
export async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  if (isConfigured) {
    await supabase.from("operator_push_subscriptions").delete().eq("endpoint", endpoint);
  }
}
