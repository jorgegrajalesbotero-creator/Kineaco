"use client";

import { useEffect, useRef, useState } from "react";
import { BellOff, Flag, Minus, Pause, Play, Plus, RotateCcw, SkipForward, X } from "lucide-react";
import { tr } from "@/lib/i18n";
import { beep, getAudio, startAlarm, vibrate } from "@/lib/alarm";
import { CLOCK_FIELDS, CLOCK_MODES, buildPhases, formatClock, formatStopwatch, normalizeConfig, stateAt } from "@/lib/clock";

const MODE_LABELS = { rest: "Descanso", tabata: "Tabata", intervals: "Intervalos", amrap: "AMRAP", stopwatch: "Cronómetro" };
const MODE_HINTS = {
  rest: "Cuenta regresiva entre series.",
  tabata: "Trabajo y descanso por rondas (clásico: 20 s / 10 s × 8).",
  intervals: "Intermitentes con los tiempos que usted quiera.",
  amrap: "Tantas rondas como pueda en el tiempo. Cuente cada ronda con «+1 ronda».",
  stopwatch: "Cuenta hacia arriba. Marque vueltas cuando quiera.",
};
const STORE_KEY = "workout_clock_v1";

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

// Reloj de entrenamiento a pantalla completa
export function WorkoutClock({ onClose, initialMode }) {
  const [saved] = useState(loadSaved);
  const [mode, setMode] = useState(() => (CLOCK_MODES.includes(initialMode) ? initialMode : CLOCK_MODES.includes(saved.mode) ? saved.mode : "tabata"));
  const [configs, setConfigs] = useState(() => Object.fromEntries(CLOCK_MODES.map((m) => [m, normalizeConfig(m, saved.configs?.[m])])));
  // run = { startedAt, pausedAt (o null), pausedTotal, extra (s, solo descanso) }
  const [run, setRun] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [rounds, setRounds] = useState(0); // AMRAP
  const [laps, setLaps] = useState([]); // Cronómetro (ms acumulados)
  const alarmStop = useRef(null); // apaga la alarma final
  const [ringing, setRinging] = useState(false);
  const lastIndex = useRef(-1);
  const lastTick = useRef(null);
  const wakeLock = useRef(null);

  const cfg = configs[mode];
  const phases = buildPhases(mode, cfg, run?.extra || 0);
  const running = !!run && !run.pausedAt;
  const elapsedMs = run ? (run.pausedAt ?? now) - run.startedAt - run.pausedTotal : 0;
  const st = mode === "stopwatch" ? null : stateAt(phases, elapsedMs);
  const finished = !!st?.done && !!run;

  // Guardar el modo y la configuración en este dispositivo
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ mode, configs })); } catch { }
  }, [mode, configs]);

  // Reloj interno: refresca la pantalla mientras corre
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), mode === "stopwatch" ? 100 : 200);
    return () => clearInterval(id);
  }, [running, mode]);

  // Mantener la pantalla encendida mientras corre (si el navegador lo permite)
  useEffect(() => {
    let cancelled = false;
    if (running && "wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((l) => {
        if (cancelled) l.release().catch(() => { });
        else wakeLock.current = l;
      }).catch(() => { });
    }
    return () => {
      cancelled = true;
      wakeLock.current?.release().catch(() => { });
      wakeLock.current = null;
    };
  }, [running]);

  // Pitidos y vibración: cambio de fase, últimos 3 segundos y final
  useEffect(() => {
    if (!run || !st) return;
    if (st.done) {
      if (lastIndex.current !== phases.length) {
        lastIndex.current = phases.length;
        // Alarma que sigue sonando hasta que la apaguen
        alarmStop.current?.();
        alarmStop.current = startAlarm();
        setRinging(true);
        setRun((r) => (r && !r.pausedAt ? { ...r, pausedAt: Date.now() } : r));
      }
      return;
    }
    if (st.index !== lastIndex.current) {
      if (lastIndex.current !== -1 || st.phase.type !== "prep") {
        if (st.phase.type === "work") {
          beep({ freq: 1175, dur: 0.6 });
          vibrate([350]);
        } else {
          beep({ freq: 740, dur: 0.22 });
          beep({ freq: 740, at: 0.3, dur: 0.22 });
          vibrate([150, 100, 150]);
        }
      }
      lastIndex.current = st.index;
      lastTick.current = null;
    }
    if (running && st.remaining <= 3 && st.remaining >= 1 && lastTick.current !== `${st.index}:${st.remaining}`) {
      lastTick.current = `${st.index}:${st.remaining}`;
      beep({ freq: 988, dur: 0.12, vol: 0.7 });
    }
  });

  const ensureAudio = () => getAudio();
  const stopAlarm = () => {
    alarmStop.current?.();
    alarmStop.current = null;
    setRinging(false);
  };
  // Al cerrar el reloj se apaga la alarma
  useEffect(() => () => alarmStop.current?.(), []);

  const start = () => {
    stopAlarm();
    ensureAudio();
    const t = Date.now();
    setNow(t);
    lastIndex.current = -1;
    lastTick.current = null;
    setRounds(0);
    setLaps([]);
    setRun({ startedAt: t, pausedAt: null, pausedTotal: 0, extra: 0 });
    // El cronómetro no tiene fases: sonido de arranque
    if (mode === "stopwatch") beep({ freq: 1175, dur: 0.25 });
  };
  const pause = () => setRun((r) => (r ? { ...r, pausedAt: Date.now() } : r));
  const resume = () => {
    ensureAudio();
    const t = Date.now();
    setNow(t);
    setRun((r) => (r ? { ...r, pausedTotal: r.pausedTotal + (t - r.pausedAt), pausedAt: null } : r));
  };
  const reset = () => {
    stopAlarm();
    setRun(null);
    setRounds(0);
    setLaps([]);
    lastIndex.current = -1;
  };
  // Pasar a la siguiente fase (corre el inicio hacia atrás lo que falta de la fase actual)
  const skip = () => {
    if (!run || !st || st.done) return;
    const ref = run.pausedAt ?? Date.now();
    const endMs = phases.slice(0, st.index + 1).reduce((t, p) => t + p.dur, 0) * 1000;
    setNow(Date.now());
    setRun((r) => ({ ...r, startedAt: ref - r.pausedTotal - endMs }));
  };
  const addRest = (sec) => setRun((r) => (r ? { ...r, extra: r.extra + sec } : r));

  const changeMode = (m) => {
    if (m === mode) return;
    reset();
    setMode(m);
  };
  const setField = (field, value) => {
    setConfigs((c) => ({ ...c, [mode]: normalizeConfig(mode, { ...c[mode], [field.key]: value }) }));
  };

  // Colores según la fase: trabajo en lima, descanso en azul, preparación en ámbar
  const phaseType = mode === "stopwatch" ? (run ? "work" : null) : finished ? "done" : run ? st.phase.type : null;
  const face = {
    work: "bg-accent text-app",
    rest: "bg-calm text-app",
    prep: "bg-warning text-app",
    done: "bg-card text-ink",
  }[phaseType] || "bg-card text-ink";
  const phaseLabel = {
    work: mode === "amrap" ? tr("¡A trabajar!") : mode === "stopwatch" ? tr("Cronómetro") : tr("Trabajo"),
    rest: tr("Descanso"),
    prep: tr("Prepárese"),
    done: tr("¡Terminado!"),
  }[phaseType] || tr(MODE_LABELS[mode]);

  let big;
  if (mode === "stopwatch") big = formatStopwatch(elapsedMs);
  else if (!run) big = formatClock(phases[mode === "rest" ? 0 : 1]?.dur ?? 0);
  else big = formatClock(st.remaining);

  let sub = "";
  if (mode === "tabata" || mode === "intervals") {
    const total = cfg.rounds;
    const round = run ? (finished ? total : st.phase.type === "prep" ? 1 : st.phase.round) : 1;
    sub = tr("Ronda {p0} de {p1}", { p0: round, p1: total });
    if (run && !finished) sub += ` · ${tr("Total")} ${formatClock(st.totalRemaining)}`;
  } else if (mode === "amrap") {
    sub = tr("Rondas: {p0}", { p0: rounds });
  } else if (mode === "rest" && run && !finished) {
    sub = tr("Toque +15 s si necesita más tiempo");
  }

  const lapRows = laps.map((t, i) => ({ n: i + 1, split: t - (laps[i - 1] || 0), total: t })).reverse();
  const secondaryBtn = "h-12 rounded-2xl bg-field text-ink text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-[70] bg-app flex flex-col animate-fade-in" role="dialog" aria-modal="true" aria-label={tr("Reloj")}>
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2">
        <h2 className="text-ink text-lg font-semibold">{tr("Reloj")}</h2>
        <button onClick={() => { stopAlarm(); onClose(); }} aria-label={tr("Cerrar")} className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-soft">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          {/* Modos */}
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-3" role="tablist">
            {CLOCK_MODES.map((m) => (
              <button key={m} role="tab" aria-selected={m === mode} onClick={() => changeMode(m)}
                className={`shrink-0 text-sm rounded-full px-3.5 py-2 transition-colors ${m === mode ? "bg-accent text-app font-semibold" : "bg-card text-soft hover:text-ink"}`}>
                {tr(MODE_LABELS[m])}
              </button>
            ))}
          </div>
          <p className="text-muted text-xs mb-4">{tr(MODE_HINTS[mode])}</p>

          {/* Configuración (solo antes de iniciar) */}
          {!run && CLOCK_FIELDS[mode].length > 0 && (
            <div className="grid grid-cols-1 gap-2 mb-4">
              {CLOCK_FIELDS[mode].map((f) => (
                <div key={f.key} className="bg-card rounded-xl px-3 py-2 flex items-center gap-3">
                  <span className="text-soft text-sm flex-1">{tr(f.label)}</span>
                  <button onClick={() => setField(f, cfg[f.key] - f.step)} disabled={cfg[f.key] <= f.min} aria-label={tr("Menos")} className="w-9 h-9 rounded-lg bg-field text-ink flex items-center justify-center disabled:opacity-40"><Minus size={16} /></button>
                  <span className="text-ink text-base font-semibold tabular-nums w-16 text-center">
                    {f.unit === "time" ? formatClock(cfg[f.key]) : f.unit === "minutes" ? `${cfg[f.key]} min` : cfg[f.key]}
                  </span>
                  <button onClick={() => setField(f, cfg[f.key] + f.step)} disabled={cfg[f.key] >= f.max} aria-label={tr("Más")} className="w-9 h-9 rounded-lg bg-field text-ink flex items-center justify-center disabled:opacity-40"><Plus size={16} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Carátula */}
          <div className={`rounded-3xl px-4 py-8 text-center transition-colors duration-300 ${face} ${ringing ? "animate-pulse ring-4 ring-danger" : ""}`} aria-live="polite">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] opacity-80">{phaseLabel}</p>
            <p className="text-[4.5rem] sm:text-[5.5rem] leading-none font-semibold tabular-nums my-3">{big}</p>
            <p className="text-sm opacity-80 min-h-5">{sub}</p>
          </div>

          {ringing && (
            <button onClick={stopAlarm} className="w-full h-16 mt-3 rounded-2xl bg-danger text-app text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <BellOff size={22} /> {tr("Apagar alarma")}
            </button>
          )}

          {/* AMRAP: contador de rondas */}
          {mode === "amrap" && run && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => setRounds((r) => Math.max(0, r - 1))} disabled={rounds === 0} className={`${secondaryBtn} w-14`} aria-label={tr("Quitar ronda")}><Minus size={18} /></button>
              <button onClick={() => { setRounds((r) => r + 1); vibrate(40); }} disabled={finished} className="flex-1 h-12 rounded-2xl bg-card border border-accent/40 text-accent text-base font-semibold active:scale-[0.97] transition-transform disabled:opacity-40">
                {tr("+1 ronda")}
              </button>
            </div>
          )}

          {/* Controles */}
          <div className="flex gap-2 mt-3">
            {!run ? (
              <button onClick={start} className="flex-1 h-14 rounded-2xl bg-accent text-app text-base font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <Play size={18} /> {tr("Iniciar")}
              </button>
            ) : finished ? (
              <button onClick={start} className="flex-1 h-14 rounded-2xl bg-accent text-app text-base font-semibold flex items-center justify-center gap-2">
                <RotateCcw size={18} /> {tr("Repetir")}
              </button>
            ) : running ? (
              <button onClick={pause} className="flex-1 h-14 rounded-2xl bg-ink text-app text-base font-semibold flex items-center justify-center gap-2">
                <Pause size={18} /> {tr("Pausar")}
              </button>
            ) : (
              <button onClick={resume} className="flex-1 h-14 rounded-2xl bg-accent text-app text-base font-semibold flex items-center justify-center gap-2">
                <Play size={18} /> {tr("Seguir")}
              </button>
            )}
            {run && (
              <button onClick={reset} className={`${secondaryBtn} w-14 h-14!`} aria-label={tr("Reiniciar")}><RotateCcw size={18} /></button>
            )}
          </div>

          {run && !finished && (
            <div className="flex gap-2 mt-2">
              {mode === "rest" && (
                <>
                  <button onClick={() => addRest(-15)} className={`${secondaryBtn} flex-1`}>−15 s</button>
                  <button onClick={() => addRest(15)} className={`${secondaryBtn} flex-1`}>+15 s</button>
                </>
              )}
              {mode === "stopwatch" ? (
                <button onClick={() => setLaps((l) => [...l, elapsedMs])} className={`${secondaryBtn} flex-1`}><Flag size={16} /> {tr("Vuelta")}</button>
              ) : (
                <button onClick={skip} className={`${secondaryBtn} flex-1`}><SkipForward size={16} /> {mode === "rest" ? tr("Saltar") : tr("Siguiente fase")}</button>
              )}
            </div>
          )}

          {mode === "amrap" && finished && (
            <p className="text-center text-ink text-sm mt-4">{tr("Completó {p0} rondas.", { p0: rounds })}</p>
          )}

          {mode === "stopwatch" && lapRows.length > 0 && (
            <div className="bg-card rounded-xl mt-4 divide-y divide-white/[0.05]">
              {lapRows.map((l) => (
                <div key={l.n} className="flex items-center justify-between px-4 py-2.5 text-sm tabular-nums">
                  <span className="text-soft">{tr("Vuelta {p0}", { p0: l.n })}</span>
                  <span className="text-ink font-medium">{formatStopwatch(l.split)}</span>
                  <span className="text-muted text-xs">{formatStopwatch(l.total)}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-muted text-[11px] text-center mt-5">{tr("Suena y vibra en cada cambio; al final la alarma sigue hasta que la apague. Suba el volumen del celular.")}</p>
        </div>
      </div>
    </div>
  );
}
