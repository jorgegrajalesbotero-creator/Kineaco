// Tarjeta del reloj en la pantalla de bloqueo y el centro de control.
//
// Qué es y qué NO es: la píldora del reloj es HTML, así que solo se ve dentro de la app.
// Para que el alumno vea en qué va con el celular bloqueado, se usa la Media Session, la
// misma tarjeta que muestran las apps de música. En iPhone esa reproducción aparece además
// en la isla dinámica como actividad de audio. La isla "de verdad" (Live Activities) solo
// se puede con una app nativa en Swift: no hay forma de hacerlo desde la web.
//
// Se apoya en el audio callado de lib/alarm.js: si no hay nada sonando, el celular no
// muestra ninguna tarjeta. Por eso solo funciona después de que el alumno toque "Iniciar".
import { silentAudio } from "@/lib/alarm";


let handlersReady = false;
let lastKey = "";

const ms = () => (typeof navigator !== "undefined" && navigator.mediaSession ? navigator.mediaSession : null);

// iPhone ignora los controles registrados antes de que algo esté sonando, así que se
// registran la primera vez que de verdad hay tarjeta, no al cargar la página.
function installHandlers({ onPlay, onPause }) {
  const s = ms();
  if (!s || handlersReady) return;
  handlersReady = true;
  const set = (accion, fn) => {
    try { s.setActionHandler(accion, fn); } catch { }
  };
  set("play", () => onPlay?.());
  set("pause", () => onPause?.());
  set("stop", () => onPause?.());
  // Adelantar / atrasar no aplican a un reloj: se apagan para que no salgan botones que engañan
  ["previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"].forEach((a) => set(a, null));
}

// Pone (o actualiza) la tarjeta. `title` es la línea grande y `subtitle` la de abajo.
export function showNowPlaying({ title, subtitle, paused = false, duration = 0, position = 0, onPlay, onPause }) {
  const s = ms();
  if (!s) return;
  const el = silentAudio();
  try { if (el?.paused) el.play().catch(() => { }); } catch { }
  // Los controles solo se registran cuando ya hay algo sonando: el iPhone descarta los que
  // se registran antes, y entonces la tarjeta sale sin botones o no sale.
  if (el && !el.paused) installHandlers({ onPlay, onPause });
  const key = `${title}|${subtitle}|${paused}`;
  if (key === lastKey) return; // el texto no cambió: no se toca nada
  lastKey = key;
  try {
    s.metadata = new window.MediaMetadata({
      title: title || "Kineaco",
      artist: subtitle || "",
      album: "Kineaco",
      artwork: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  } catch { }
  try { s.playbackState = paused ? "paused" : "playing"; } catch { }
  // Barra de progreso de la fase (trabajo, descanso…): sin esto se queda congelada.
  // El celular exige una duración positiva y una posición que no se pase de ella.
  try {
    if (duration > 0 && s.setPositionState) {
      s.setPositionState({
        duration,
        position: Math.max(0, Math.min(position, duration)),
        playbackRate: 1,
      });
    }
  } catch { }
}

// Quita la tarjeta. OJO: no se para el audio callado a propósito. Si se pausa, el iPhone
// devuelve la app al modo "ambiente" y el sonido deja de funcionar hasta recargarla:
// el reloj sonaba una sola vez y al segundo intento ya no pitaba ni al iniciar.
export function hideNowPlaying() {
  const s = ms();
  lastKey = "";
  if (!s) return;
  try { s.metadata = null; } catch { }
  try { s.playbackState = "none"; } catch { }
}
