// Descargar la app desde la web (es una app web instalable: queda en la pantalla de inicio con su ícono,
// a pantalla completa y con notificaciones). Lógica pura para saber qué instrucciones mostrar.

// "ios" (iPhone o iPad) · "android" · "desktop"
export function platformOf(ua = "", maxTouchPoints = 0) {
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

// ¿Ya está abierta como app instalada?
export function isInstalled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Chrome (Android y computador) avisa que se puede instalar con un evento: se guarda para usarlo
// cuando la persona toque "Descargar la app" (así se instala con un toque).
let deferred = null;
const subs = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    subs.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    subs.forEach((f) => f());
  });
}
export const canPromptInstall = () => !!deferred;
export function onInstallChange(f) {
  subs.add(f);
  return () => subs.delete(f);
}
// Abre la ventana de instalación del navegador. Devuelve true si la persona aceptó.
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  subs.forEach((f) => f());
  return choice?.outcome === "accepted";
}
