"use client";

import { supabase } from "@/lib/supabase";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data?.session?.access_token ?? ""}` };
}

// Is this device already subscribed and permitted?
export async function getPushEnabled() {
  if (!isPushSupported()) return false;
  try {
    if (Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

// Register the SW, ask permission, subscribe, and store the subscription.
export async function enableOperatorPush() {
  if (!isPushSupported()) throw new Error("Push isn't supported on this device or browser.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications were not allowed. Enable them in your browser/app settings.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const res = await fetch("/api/push/public-key");
  const { publicKey } = await res.json().catch(() => ({}));
  if (!publicKey) throw new Error("Push isn't set up on the server yet.");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const j = sub.toJSON();
  const post = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({
      subscription: { endpoint: j.endpoint, keys: j.keys },
      label: navigator.userAgent.slice(0, 120),
    }),
  });
  if (!post.ok) {
    const e = await post.json().catch(() => ({}));
    throw new Error(e.error || "Couldn't register this device for push.");
  }
  return true;
}

// Unsubscribe this device and forget it server-side.
export async function disableOperatorPush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ endpoint }),
      });
    }
  } catch {
    /* ignore */
  }
  return false;
}
