// Sonidos del reloj (sin archivos de audio): pitidos fuertes y una alarma que repite
// hasta que el alumno la apague.

let shared = null;

// Contexto de audio compartido. Conviene llamarlo al tocar un botón (iPhone lo exige).
export function getAudio() {
  try {
    if (!shared) shared = new (window.AudioContext || window.webkitAudioContext)();
    shared.resume?.();
    return shared;
  } catch {
    return null;
  }
}

// Un pitido. Onda cuadrada + compresor: se oye bastante más fuerte que una onda suave.
export function beep({ freq = 880, at = 0, dur = 0.15, vol = 0.9, wave = "square" } = {}) {
  const ctx = getAudio();
  if (!ctx) return;
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
