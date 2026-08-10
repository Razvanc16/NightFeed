import { supabase } from "../supabase";

// Cheia publică VAPID — e ok să fie în client, e literalmente "publică" prin
// design (partea privată stă doar în secretele Edge Function-ului send-push).
const VAPID_PUBLIC_KEY = "BNhaWylaZ9kepUPTafkI0jgejA_fl52Q_Z2FUIpDcD3wi_4yjZlUsXqo_3F9cJTCEbDZ_jU9vgXhJGC4WXL74QA";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
};

export const isPushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function getPushStatus() {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "subscribed" : "not-subscribed";
}

export async function subscribeToPush(userId) {
  if (!isPushSupported()) return { error: "Notificările push nu sunt suportate în acest browser." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { error: "Permisiune refuzată pentru notificări." };

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    [{ user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }],
    { onConflict: "endpoint" }
  );

  return { error: error?.message };
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }
}

// Best-effort — nu aruncă niciodată, ca o notificare eșuată să nu strice
// fluxul principal (accept cerere, like etc.). `type`: "like" | "comment" |
// "request" | "follower" — decide ce preferință a userului țintă se verifică.
export function notifyUser({ targetUserId, title, body, url, type }) {
  return supabase.functions
    .invoke("send-push", { body: { targetUserId, title, body, url, type } })
    .catch(() => {});
}
