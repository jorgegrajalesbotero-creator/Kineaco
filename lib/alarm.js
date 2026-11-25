// Sonidos del reloj: pitidos fuertes y una alarma que repite hasta que el alumno la apague.
//
// LA MÚSICA DEL ALUMNO SIEMPRE SIGUE (decisión de Valentina, 2026-11-24)
// Antes había un reproductor de audio en silencio sonando todo el tiempo (para que el reloj
// pitara con la pantalla apagada y saliera la tarjeta en la pantalla de bloqueo). El iPhone lo
// tomaba como música y pausaba Spotify / Apple Music apenas se usaba la app.
// Ahora los pitidos se hacen con Web Audio en modo "ambiente": suenan ENCIMA de la música sin
// pausarla. Lo que se pierde a cambio: no hay tarjeta en la pantalla de bloqueo, con el celular
// en silencio no suenan, y con la pantalla bloqueada puede que no pite (sigue la vibración).

const RATE = 22050; // muestras por segundo de los WAV (se conservan para las pruebas y por si se vuelven a usar)

let ctx = null;
const buffers = new Map(); // pitidos ya armados, para no rehacerlos cada vez
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

// Modo "ambiente": el sonido de la app se mezcla con la música en vez de pausarla
function ambient() {
  try {
    if (typeof navigator !== "undefined" && navigator.audioSession && navigator.audioSession.type !== "ambient") navigator.audioSession.type = "ambient";
  } catch { }
}

function context() {
  if (typeof window === "undefined") return null;
  ambient();
  try {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      installUnlock();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => { });
  } catch {
    return null;
  }
  return ctx;
}

// Si el celular durmió el sonido, un toque o volver a la app lo despierta (sin pausar la música)
function installUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const despertar = () => {
    try { if (ctx && ctx.state === "suspended") ctx.resume().catch(() => { }); } catch { }
  };
  ["pointerdown", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, despertar, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") despertar(); });
}

// El sonido de unos tonos (onda cuadrada, que se oye más), listo para reproducir
function bufferFor(c, partes) {
  const clave = JSON.stringify(partes);
  if (buffers.has(clave)) return buffers.get(clave);
  const largo = Math.max(...partes.map((p) => (p.at || 0) + p.dur)) + 0.05;
  const rate = c.sampleRate;
  const n = Math.ceil(largo * rate);
  const buf = c.createBuffer(1, n, rate);
  const datos = buf.getChannelData(0);
  for (const p of partes) {
    const ini = Math.floor((p.at || 0) * rate);
    const fin = Math.min(n, Math.floor(((p.at || 0) + p.dur) * rate));
    const amp = 0.5 * (p.vol ?? 1);
    const tramo = fin - ini;
    for (let i = ini; i < fin; i++) {
      const tt = (i - ini) / rate;
      const onda = Math.sin(2 * Math.PI * p.freq * tt) >= 0 ? 1 : -1;
      const avance = (i - ini) / tramo;
      const borde = Math.min(1, avance * 25, (1 - avance) * 25); // sin chasquidos al entrar y salir
      datos[i] += onda * amp * borde;
    }
  }
  buffers.set(clave, buf);
  return buf;
}

function play(partes) {
  const c = context();
  if (!c || !partes.length) return;
  try {
    const src = c.createBufferSource();
    src.buffer = bufferFor(c, partes);
    src.connect(c.destination);
    src.start();
  } catch { }
}

// Prepara el sonido. Conviene llamarlo al tocar un botón (el iPhone lo exige).
export function getAudio() {
  return context();
}

// Ya no hay reproductor en silencio (era lo que pausaba la música): no hay tarjeta de bloqueo
export function silentAudio() {
  return null;
}

// Un pitido, o varios seguidos: beep({ freq, dur }) o beep([{...}, { at: 0.3, ... }]).
export function beep(opts = {}) {
  play(Array.isArray(opts) ? opts : [opts]);
}

// Pitidos del reloj, con los tonos de siempre
export const beepStart = () => beep({ freq: 1175, dur: 0.25 });
export const beepPause = () => beep([{ freq: 523, dur: 0.12 }, { freq: 392, at: 0.14, dur: 0.16 }]);

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { }
}

// Alarma final: tres pitidos con su pausa, repitiéndose hasta que el alumno la apague
const ALARMA = [
  { freq: 1175, at: 0, dur: 0.16 },
  { freq: 1175, at: 0.2, dur: 0.16 },
  { freq: 1175, at: 0.4, dur: 0.16 },
];
export function startAlarm() {
  const sonar = () => { play(ALARMA); vibrate([400, 150, 400]); };
  sonar();
  const cada = setInterval(sonar, 1200);
  return () => {
    clearInterval(cada);
    vibrate(0);
  };
}
