// Sonidos del reloj: pitidos fuertes y una alarma que repite hasta que el alumno la apague.
//
// POR QUÉ NO SE USA WEB AUDIO
// Antes los pitidos se armaban con osciladores (AudioContext). Eso suena bien con la app
// a la vista, pero el iPhone duerme el AudioContext a los pocos segundos de apagarse la
// pantalla y lo deja en un estado del que casi nunca vuelve: el reloj sonaba una sola vez
// y después quedaba mudo hasta recargar la app.
//
// CÓMO FUNCIONA AHORA
// Hay UN solo reproductor de audio, metido en la página, que nunca se pausa:
// - cuando no hay nada que decir, repite un silencio de 30 segundos;
// - para pitar, se le cambia la pista por el pitido y al terminar vuelve al silencio;
// - la alarma final es una pista que ya trae los pitidos y se repite sola.
// Mantenerlo siempre sonando es lo que conserva viva la sesión de audio del celular: de ahí
// salen también el sonido con el teléfono en silencio y la tarjeta de la pantalla de bloqueo.
// No se usa "muted" a propósito: al silenciarlo, el celular le quita la tarjeta.

const RATE = 22050; // muestras por segundo (suficiente para pitidos y archivos chicos)

let el = null;
let silencio = null;
let alarma = null;
const pistas = new Map(); // pitidos ya armados, para no rehacerlos cada vez
let unlockInstalled = false;

// Arma un WAV (mono, 8 bits) en memoria. `partes` son los tonos que suenan:
// { freq, dur, at (cuándo empieza), vol }. Sin partes, queda en silencio.
export function wavBuffer(segundos, partes = []) {
  const n = Math.ceil(segundos * RATE);
  const buf = new ArrayBuffer(44 + n);
  const dv = new DataView(buf);
  const txt = (pos, s) => [...s].forEach((c, i) => dv.setUint8(pos + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  dv.setUint32(4, 36 + n, true);
  txt(8, "WAVEfmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, RATE, true);
  dv.setUint32(28, RATE, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  txt(36, "data");
  dv.setUint32(40, n, true);

  const datos = new Uint8Array(buf, 44);
  datos.fill(128); // 128 = silencio en 8 bits
  for (const p of partes) {
    const ini = Math.floor((p.at || 0) * RATE);
    const fin = Math.min(n, Math.floor(((p.at || 0) + p.dur) * RATE));
    const amp = 112 * (p.vol ?? 1);
    const largo = fin - ini;
    for (let i = ini; i < fin; i++) {
      const t = (i - ini) / RATE;
      const onda = Math.sin(2 * Math.PI * p.freq * t) >= 0 ? 1 : -1; // cuadrada: se oye más
      const avance = (i - ini) / largo;
      const borde = Math.min(1, avance * 25, (1 - avance) * 25); // sin chasquidos al entrar y salir
      datos[i] = Math.max(0, Math.min(255, Math.round(128 + onda * amp * borde)));
    }
  }
  return buf;
}

// Lo mismo, listo para dárselo al reproductor
function wav(segundos, partes = []) {
  return URL.createObjectURL(new Blob([wavBuffer(segundos, partes)], { type: "audio/wav" }));
}

function silencioUrl() {
  if (!silencio) silencio = wav(30);
  return silencio;
}

// El reproductor: uno solo, dentro de la página y sin pausarse nunca.
function player() {
  if (el || typeof document === "undefined") return el;
  try {
    el = document.createElement("audio");
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("aria-hidden", "true");
    el.style.display = "none";
    el.loop = true;
    el.src = silencioUrl();
    document.body.appendChild(el);
    el.addEventListener("ended", () => { if (!el.loop) quedarEnSilencio(); });
    el.play().catch(() => { });
    installUnlock();
  } catch {
    el = null;
  }
  return el;
}

function quedarEnSilencio() {
  const a = player();
  if (!a) return;
  try {
    a.loop = true;
    if (a.src !== silencioUrl()) a.src = silencioUrl();
    if (a.paused) a.play().catch(() => { });
  } catch { }
}

// Cualquier toque, o volver a la app, vuelve a poner en marcha el reproductor si se durmió.
function installUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const despertar = () => {
    try { if (el?.paused) el.play().catch(() => { }); } catch { }
  };
  ["pointerdown", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, despertar, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") despertar(); });
}

// Prepara el sonido. Conviene llamarlo al tocar un botón (el iPhone lo exige).
export function getAudio() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback";
  } catch { }
  return player();
}

// El reproductor que sostiene la sesión (lo usa la tarjeta de la pantalla de bloqueo)
export function silentAudio() {
  return player();
}

// Un pitido, o varios seguidos: beep({ freq, dur }) o beep([{...}, { at: 0.3, ... }]).
export function beep(opts = {}) {
  const partes = Array.isArray(opts) ? opts : [opts];
  if (!partes.length) return;
  const a = getAudio();
  if (!a) return;
  const clave = JSON.stringify(partes);
  if (!pistas.has(clave)) {
    const largo = Math.max(...partes.map((p) => (p.at || 0) + p.dur)) + 0.05;
    pistas.set(clave, wav(largo, partes));
  }
  try {
    a.loop = false;
    a.src = pistas.get(clave);
    a.currentTime = 0;
    a.play().catch(() => { });
  } catch { }
}

// Pitidos del reloj, con los tonos de siempre
export const beepStart = () => beep({ freq: 1175, dur: 0.25 });
export const beepPause = () => beep([{ freq: 523, dur: 0.12 }, { freq: 392, at: 0.14, dur: 0.16 }]);

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { }
}

// Alarma final: una pista con tres pitidos y su pausa, repitiéndose sola. Al ser una sola
// pista en bucle sigue sonando con la pantalla apagada, cosa que los pitidos sueltos no hacían.
export function startAlarm() {
  if (!alarma) {
    alarma = wav(1.2, [
      { freq: 1175, at: 0, dur: 0.16 },
      { freq: 1175, at: 0.2, dur: 0.16 },
      { freq: 1175, at: 0.4, dur: 0.16 },
    ]);
  }
  const a = getAudio();
  const vibrar = setInterval(() => vibrate([400, 150, 400]), 1200);
  vibrate([400, 150, 400]);
  try {
    if (a) {
      a.loop = true;
      a.src = alarma;
      a.currentTime = 0;
      a.play().catch(() => { });
    }
  } catch { }
  return () => {
    clearInterval(vibrar);
    vibrate(0);
    quedarEnSilencio();
  };
}

