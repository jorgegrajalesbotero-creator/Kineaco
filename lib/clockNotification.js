// Ficha del reloj en el panel de notificaciones, con forma de cronómetro.
//
// POR QUÉ EXISTE, ADEMÁS DE LA TARJETA DE LA PANTALLA DE BLOQUEO
// La tarjeta de lib/clockMedia.js la dibuja el celular con su plantilla de reproductor de
// música (carátula, título, botones de reproducción): esa forma no se puede cambiar desde la
// web. Una notificación normal sí tiene otra forma: icono de la app, un título y un texto,
// como la del cronómetro del teléfono. Aquí se arma esa.
//
// Se reemplaza a sí misma usando siempre la misma etiqueta, y va en silencio (silent) para
// que no suene ni vibre en cada cambio: si no, avisaría a cada segundo y sería insoportable.

const TAG = "kineaco-reloj";

// Cada cuánto se refresca. Al segundo sería demasiado trabajo para el celular y, en algunos,
// se nota el parpadeo; cada dos segundos se lee igual de bien.
export const REFRESCO_MS = 2000;

let ultimo = "";

function puede() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && typeof Notification !== "undefined"
    && Notification.permission === "granted";
}

// Pone o actualiza la ficha. Devuelve false si no se pudo (sin permiso, sin service worker…).
export async function showClockNotification({ title, body }) {
  if (!puede()) return false;
  const clave = `${title}|${body}`;
  if (clave === ultimo) return true;
  ultimo = clave;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      tag: TAG, // misma etiqueta: reemplaza la anterior en vez de apilar fichas
      renotify: false, // no vuelve a avisar al reemplazarla
      silent: true, // sin sonido ni vibración: el reloj ya suena por su cuenta
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: "/" },
      lang: "es",
    });
    return true;
  } catch {
    return false;
  }
}

// Quita la ficha cuando el reloj deja de correr
export async function hideClockNotification() {
  ultimo = "";
  if (!puede()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const abiertas = await reg.getNotifications({ tag: TAG });
    abiertas.forEach((n) => n.close());
  } catch {
    // si no se puede cerrar, se cierra sola al tocarla
  }
}
