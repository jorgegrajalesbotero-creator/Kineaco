// Sonidos del reloj (sin archivos de audio): pitidos fuertes y una alarma que repite
// hasta que el alumno la apague.

let shared = null;
let unlockInstalled = false;
let silentEl = null;
// El iPhone deja el sonido en un estado "interrupted" al salir de la app, y desde ahí muchas
// veces ya no revive por más que se le pida seguir: hay que botarlo y hacer uno nuevo, y eso
// solo funciona dentro de un toque del alumno. Esto marca que toca rehacerlo.
let rehacer = false;

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
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wake();
    else rehacer = true; // al salir de la app, el sonido queda tocado: se rehace en el próximo toque
  });
}

// Contexto nuevo, con la salida ya abierta. El iPhone no deja sonar nada hasta que se
// reproduce algo: un pedacito de audio vacío basta y no se oye.
function nuevoContexto() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const fuente = ctx.createBufferSource();
    fuente.buffer = ctx.createBuffer(1, 1, 22050);
    fuente.connect(ctx.destination);
    fuente.start(0);
  } catch { }
  return ctx;
}

// WAV mono de 30 s en silencio, armado aquí mismo (no hace falta ningún archivo).
// Dura 30 segundos a propósito: Android solo saca la notificación del reproductor cuando
// lo que suena dura 5 segundos o más, y con clips muy cortos el iPhone tampoco lo toma
// como una reproducción de verdad. Se arma como Blob para no cargar el texto en memoria.
function silentWavUrl() {
  const n = 8000 * 30;
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
  new Uint8Array(buf, 44).fill(128); // 128 = silencio en 8 bits
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
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
    // "interrupted" es de Safari y no está en la norma: desde ahí el sonido no vuelve solo.
    const inservible = shared && (shared.state === "closed" || shared.state === "interrupted" || (rehacer && shared.state !== "running"));
    if (inservible) {
      try { shared.close?.(); } catch { }
      shared = null;
    }
    if (!shared) shared = nuevoContexto();
    rehacer = false;
    installUnlock();
    if (shared.state !== "running") shared.resume?.().catch?.(() => { });
    return shared;
  } catch {
    return null;
  }
}

// Para poder ver qué está pasando con el sonido sin adivinar (se muestra abajo en el reloj).
export function audioState() {
  return {
    contexto: shared ? shared.state : "sin iniciar",
    sonando: !!silentEl && !silentEl.paused,
    tarjeta: typeof navigator !== "undefined" && !!navigator.mediaSession?.metadata,
    sesion: (() => {
      try { return navigator.audioSession?.type || "no disponible"; } catch { return "no disponible"; }
    })(),
  };
}

// Un pitido. Onda cuadrada + compresor: se oye bastante más fuerte que una onda suave.
// Si el sonido estaba dormido, primero se despierta y después suena (antes se perdía el pitido).
export function beep(opts = {}) {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === "running") return playBeep(ctx, opts);
  try {
    // Si no despierta, getAudio ya se encarga de botarlo y hacer uno nuevo en el próximo toque
    Promise.resolve(ctx.resume?.()).then(() => { if (ctx.state === "running") playBeep(ctx, opts); }, () => { });
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
