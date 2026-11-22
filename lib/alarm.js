// Sonidos del reloj (sin archivos de audio): pitidos fuertes y una alarma que repite
// hasta que el alumno la apague.

let shared = null;
let unlockInstalled = false;
let silentEl = null;

// El celular "duerme" el sonido de la página (al bloquear la pantalla, cambiar de app, una llamada…).
// Para que los pitidos de cada cambio (Tabata, AMRAP…) sigan sonando:
// - en iPhone (iOS 17+) se usa la categoría "playback": suena aunque el interruptor de silencio esté puesto;
// - cualquier toque en la app o volver a ella reactiva el sonido.
function installUnlock() {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const wake = () => {
    try { shared?.state !== "running" && shared?.resume?.(); } catch { }
    try { if (silentEl?.paused) silentEl.play().catch(() => { }); } catch { }
  };
  ["pointerdown", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, wake, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") wake(); });
}

// WAV mono de 1 s en silencio, armado aquí mismo (no hace falta ningún archivo).
// Dura un segundo entero a propósito: con clips muy cortos el iPhone no lo toma como
// una reproducción de verdad y no muestra la tarjeta de la pantalla de bloqueo.
function silentWavUrl() {
  const n = 8000;
  const buf = new ArrayBuffer(44 + n);
  const dv = new DataView(buf);
  const txt = (pos, s) => [...s].forEach((c, i) => dv.setUint8(pos + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  dv.setUint32(4, 36 + n, true);
  txt(8, "WAVEfmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  txt(36, "data");
  dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128); // 128 = silencio en 8 bits
  let bin = "";
  new Uint8Array(buf).forEach((b) => { bin += String.fromCharCode(b); });
  return `data:audio/wav;base64,${btoa(bin)}`;
}

// iPhone viejo (sin navigator.audioSession): un audio en bucle, callado, hace que el sistema
// trate el sonido de la app como "reproducción" y deje de taparlo el interruptor de silencio.
// Solo funciona si se arranca dentro de un toque del alumno, por eso se llama desde getAudio().
function keepPlaybackSession() {
  if (typeof document === "undefined") return;
  if (silentEl) {
    // Ya existe: si quedó en pausa (se cerró el reloj, una llamada…), se vuelve a poner en marcha
    try { if (silentEl.paused) silentEl.play().catch(() => { }); } catch { }
    return;
  }
  try {
    silentEl = document.createElement("audio");
    silentEl.loop = true;
    silentEl.playsInline = true;
    silentEl.setAttribute("playsinline", "");
    silentEl.setAttribute("aria-hidden", "true");
    silentEl.volume = 0.02;
    silentEl.src = silentWavUrl();
    // Dentro de la página (y no suelto en memoria): así el celular lo reconoce como
    // reproducción y muestra la tarjeta de la pantalla de bloqueo.
    silentEl.style.display = "none";
    document.body.appendChild(silentEl);
    silentEl.play().catch(() => { });
  } catch {
    silentEl = null;
  }
}

// El audio callado que mantiene viva la sesión. La tarjeta de la pantalla de bloqueo
// (lib/clockMedia.js) se cuelga de él: sin algo sonando, el celular no la muestra.
export function silentAudio() {
  keepPlaybackSession();
  return silentEl;
}

// Contexto de audio compartido. Conviene llamarlo al tocar un botón (iPhone lo exige).
export function getAudio() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback";
  } catch { }
  keepPlaybackSession();
  try {
    if (!shared || shared.state === "closed") shared = new (window.AudioContext || window.webkitAudioContext)();
    installUnlock();
    if (shared.state !== "running") shared.resume?.().catch?.(() => { });
    return shared;
  } catch {
    return null;
  }
}

// Un pitido. Onda cuadrada + compresor: se oye bastante más fuerte que una onda suave.
// Si el sonido estaba dormido, primero se despierta y después suena (antes se perdía el pitido).
export function beep(opts = {}) {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === "running") return playBeep(ctx, opts);
  try {
    Promise.resolve(ctx.resume?.()).then(() => {
      if (ctx.state === "running") return playBeep(ctx, opts);
      // No despertó: el iPhone a veces deja el contexto inservible después de una
      // interrupción (una llamada, bloquear la pantalla…). Se tira y se hace uno nuevo.
      try { ctx.close?.(); } catch { }
      if (shared === ctx) shared = null;
      const nuevo = getAudio();
      if (nuevo && nuevo !== ctx) playBeep(nuevo, opts);
    }, () => { });
  } catch { }
}

function playBeep(ctx, { freq = 880, at = 0, dur = 0.15, vol = 0.9, wave = "square" } = {}) {
  try {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.setValueAtTime(vol, t0 + Math.max(0.02, dur - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(comp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // sin sonido no pasa nada
  }
}

// Pitidos del reloj. Se llaman DENTRO del toque del alumno (iniciar, pausar, seguir): iPhone
// solo desbloquea el sonido si algo suena en ese mismo momento, y si no, el reloj se queda mudo.
export const beepStart = () => beep({ freq: 1175, dur: 0.25 });
export function beepPause() {
  beep({ freq: 523, dur: 0.12 });
  beep({ freq: 392, at: 0.14, dur: 0.16 });
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { }
}

// Alarma final: tres pitidos fuertes + vibración cada 1,2 s hasta llamar a la función que devuelve.
export function startAlarm() {
  const ring = () => {
    [0, 0.2, 0.4].forEach((at) => beep({ freq: 1175, at, dur: 0.16 }));
    vibrate([400, 150, 400]);
  };
  ring();
  const id = setInterval(ring, 1200);
  return () => {
    clearInterval(id);
    vibrate(0);
  };
}
