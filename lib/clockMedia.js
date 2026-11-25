// Tarjeta del reloj en la pantalla de bloqueo y el centro de control.
//
// Qué es y qué NO es: la píldora del reloj es HTML, así que solo se ve dentro de la app.
// Para que el alumno vea en qué va con el celular bloqueado, se usa la Media Session, la
// misma tarjeta que muestran las apps de música. En iPhone esa reproducción aparece además
// en la isla dinámica como actividad de audio. La isla "de verdad" (Live Activities) solo
// se puede con una app nativa en Swift: no hay forma de hacerlo desde la web.
//
// Se apoyaba en el audio callado de lib/alarm.js. Desde el 2026-11-24 ese audio ya no existe
// (pausaba la música del alumno en el iPhone), así que el celular normalmente no muestra la
// tarjeta: esto queda listo por si algún día se vuelve a ofrecer como opción.
import { silentAudio } from "@/lib/alarm";
import { clearCard } from "@/lib/clockArtwork";


let handlersReady = false;
let lastKey = "";
let rondasPuestas = false; // ¿están los botones de ronda en la tarjeta?
// Lo que hace cada botón. Se guarda aparte porque los controles se registran una sola vez,
// pero lo que deben hacer cambia con el reloj.
const acciones = {};

const ms = () => (typeof navigator !== "undefined" && navigator.mediaSession ? navigator.mediaSession : null);

const setAction = (s, accion, fn) => {
  try { s.setActionHandler(accion, fn); } catch { }
};

// iPhone ignora los controles registrados antes de que algo esté sonando, así que se
// registran la primera vez que de verdad hay tarjeta, no al cargar la página.
function installHandlers() {
  const s = ms();
  if (!s || handlersReady) return;
  handlersReady = true;
  setAction(s, "play", () => acciones.onPlay?.());
  setAction(s, "pause", () => acciones.onPause?.());
  setAction(s, "stop", () => acciones.onPause?.());
  // Mover por la pista no aplica a un reloj: se apagan para que no salgan botones que engañan
  ["seekbackward", "seekforward", "seekto"].forEach((a) => setAction(s, a, null));
}

// En AMRAP, los botones de pista anterior / siguiente de la tarjeta pasan a contar rondas:
// son los únicos botones extra que el celular deja poner en la pantalla de bloqueo.
// En los demás modos se apagan, para no mostrar botones que no hacen nada.
function syncRondas(quiere) {
  const s = ms();
  if (!s || quiere === rondasPuestas) return;
  rondasPuestas = quiere;
  setAction(s, "nexttrack", quiere ? () => acciones.onAddRound?.() : null);
  setAction(s, "previoustrack", quiere ? () => acciones.onRemoveRound?.() : null);
}

// Los TEXTOS y la carátula. Solo se tocan cuando cambian de verdad (al cambiar de ciclo o de
// fase), nunca por el paso del tiempo: cada cambio hace que el celular borre la carátula y la
// vuelva a cargar, y hacerlo cada segundo deja la pantalla de bloqueo parpadeando.
export function updateNowPlaying({ title, artist, album, artwork, onPlay, onPause, onAddRound, onRemoveRound }) {
  const s = ms();
  if (!s) return;
  acciones.onPlay = onPlay;
  acciones.onPause = onPause;
  acciones.onAddRound = onAddRound;
  acciones.onRemoveRound = onRemoveRound;
  const el = silentAudio();
  try { if (el?.paused) el.play().catch(() => { }); } catch { }
  // Los controles solo se registran cuando ya hay algo sonando: el iPhone descarta los que
  // se registran antes, y entonces la tarjeta sale sin botones o no sale.
  if (el && !el.paused) {
    installHandlers();
    syncRondas(!!onAddRound);
  }
  const key = `${title}|${artist}|${album}|${artwork || ""}`;
  if (key === lastKey) return;
  lastKey = key;
  const imagenes = artwork
    ? [{ src: artwork, sizes: "512x512", type: "image/png" }]
    : [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ];
  try {
    s.metadata = new window.MediaMetadata({
      title: title || "Kineaco",
      artist: artist || "",
      album: album || "",
      artwork: imagenes,
    });
  } catch { }
}

// El CRONÓMETRO. Esto sí va cada segundo, y no toca los textos ni la carátula: el celular
// anima la barra y baja el tiempo él solo.
export function updateClockPosition({ duration = 0, position = 0, paused = false }) {
  const s = ms();
  if (!s) return;
  try { s.playbackState = paused ? "paused" : "playing"; } catch { }
  try {
    // El celular exige una duración positiva y una posición que no se pase de ella
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
  clearCard();
  syncRondas(false);
  if (!s) return;
  try { s.metadata = null; } catch { }
  try { s.playbackState = "none"; } catch { }
}
