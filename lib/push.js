// Notificaciones en el celular (Web Push), lado del navegador.
// - registerServiceWorker: instala public/sw.js (el que recibe los avisos con la app cerrada).
// - pushStatus: en qué estado está este celular/navegador.
// - enablePush / disablePush: el interruptor de Perfil y la tarjeta de Inicio.
// - syncPush: al abrir la app, deja guardada la suscripción si el permiso ya estaba dado.
// - removePushOnLogout: al cerrar sesión, este celular deja de recibir los avisos de esa cuenta.
// - useOpenNotification: abre la sección del aviso que se tocó en la barra del celular.
import { useEffect, useRef } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const OFF_KEY = (uid) => `push_off_${uid}`;

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isInstalled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function keyToBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function registerServiceWorker() {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

// "unsupported" | "ios-install" | "denied" | "on" | "off"
export async function pushStatus(userId) {
  if (isIOS() && !isInstalled()) return "ios-install"; // en iPhone solo funciona con la app en la pantalla de inicio
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  if (userId && readOff(userId)) return "off";
  const sub = await currentSubscription().catch(() => null);
  return sub ? "on" : "off";
}

function readOff(uid) {
  try { return localStorage.getItem(OFF_KEY(uid)) === "1"; } catch { return false; }
}
function writeOff(uid, off) {
  try { off ? localStorage.setItem(OFF_KEY(uid), "1") : localStorage.removeItem(OFF_KEY(uid)); } catch { }
}

async function saveSubscription(supabase, sub) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

async function subscribe() {
  const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) });
}

// Pide permiso (si hace falta) y guarda este celular. Devuelve el estado final.
export async function enablePush(supabase, userId) {
  const status = await pushStatus();
  if (status === "unsupported" || status === "ios-install" || status === "denied") return status;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const sub = await subscribe();
  await saveSubscription(supabase, sub);
  writeOff(userId, false);
  return "on";
}

export async function disablePush(supabase, userId) {
  writeOff(userId, true);
  await removeSubscription(supabase);
  return "off";
}

async function removeSubscription(supabase) {
  if (!pushSupported()) return;
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => { });
}

// Al abrir la app: si este celular ya dio permiso (y no lo apagó en Perfil), se vuelve a guardar.
// Así, si otra persona inició sesión antes en el mismo celular, los avisos pasan a la cuenta actual.
export async function syncPush(supabase, userId) {
  if (!userId || !pushSupported() || !VAPID_PUBLIC_KEY) return;
  await registerServiceWorker();
  if (Notification.permission !== "granted" || readOff(userId)) return;
  if (isIOS() && !isInstalled()) return;
  try {
    const sub = await subscribe();
    await saveSubscription(supabase, sub);
  } catch {
    // sin conexión o el navegador no dejó: se intenta la próxima vez
  }
}

export async function removePushOnLogout(supabase) {
  try { await removeSubscription(supabase); } catch { }
}

// Abre el aviso que se tocó en la barra del celular:
// - con la app cerrada, llega en la dirección (?aviso=<id>);
// - con la app abierta, llega como mensaje del service worker.
// ready = la app ya cargó al usuario (para no abrir una sección antes de tiempo).
export function useOpenNotification(supabase, userId, ready, onOpen) {
  const handler = useRef(onOpen);
  useEffect(() => {
    handler.current = onOpen;
  });

  useEffect(() => {
    if (!ready || !userId) return undefined;

    const open = async (id) => {
      if (!id) return;
      const { data: n } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, student_id, dedupe_key, created_at, read_at")
        .eq("id", id)
        .eq("recipient_id", userId)
        .maybeSingle();
      if (!n) return;
      if (!n.read_at) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      handler.current?.(n);
    };

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("aviso");
    if (fromUrl) {
      params.delete("aviso");
      const rest = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
      open(fromUrl);
    }

    if (!("serviceWorker" in navigator)) return undefined;
    const onMessage = (event) => {
      if (event.data?.type === "open-notification") open(event.data.id);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [supabase, userId, ready]);
}
