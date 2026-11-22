"use client";

import { useEffect, useState } from "react";
import { BellOff, Check, ChevronDown, Flag, Minus, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { tr } from "@/lib/i18n";
import { audioState, vibrate } from "@/lib/alarm";
import { CLOCK_FIELDS, CLOCK_MODES, clockExerciseProgress, clockExercises, formatClock, formatStopwatch, stateAt, visibleFields } from "@/lib/clock";
import {
  addLap, addRestSeconds, addRound, backToProgrammed, clockPhases, elapsedMs as elapsedOf, isRunning, minimizeClock,
  pauseClock, removeRound, resetClock, resumeClock, setClockField, setClockMode, skipPhase, startClock, stopAlarm, useClock,
} from "@/lib/clockStore";
import { ClockField } from "@/components/ui/ClockField";

const MODE_LABELS = { rest: "Descanso", tabata: "Tabata", amrap: "AMRAP", stopwatch: "Cronómetro" };
const MODE_HINTS = {
  rest: "Cuenta regresiva entre series.",
  tabata: "Trabajo y descanso por ciclos: Tabata clásico (20 s / 10 s × 8) o intermitentes con los tiempos que usted quiera.",
  amrap: "Tantas rondas como pueda en el tiempo. Cuente cada ronda con «+1 ronda».",
  stopwatch: "Cuenta hacia arriba. Marque vueltas cuando quiera.",
};

// Hora actual (fuera del componente: solo se usa en efectos, nunca al dibujar)
const nowMs = () => Date.now();

// Reloj de entrenamiento a pantalla completa. El estado vive en lib/clockStore: al cerrarlo
// el reloj sigue corriendo en la píldora de arriba. Los pitidos y la alarma los maneja ClockHost.
export function WorkoutClock() {
  const s = useClock();
  const { mode, run, rounds, laps, ringing } = s;
  const programmed = s.preset;
  const cfg = s.configs[mode];
  const [now, setNow] = useState(0);
  const running = isRunning(s);
  useEffect(() => {
    setNow(nowMs());
    if (!running) return undefined;
    const id = setInterval(() => setNow(nowMs()), mode === "stopwatch" ? 100 : 200);
    return () => clearInterval(id);
  }, [running, mode, run?.id]);

  const phases = clockPhases(s);
  const elapsedMs = run && now ? elapsedOf(s, now) : 0;
  const st = mode === "stopwatch" ? null : stateAt(phases, elapsedMs);
  const finished = !!st?.done && !!run;
  const isProgrammed = !!programmed && mode === programmed.mode && CLOCK_FIELDS[mode].every((f) => cfg[f.key] === programmed[f.key]);

  const start = () => startClock(); // el pitido de arranque lo hace startClock, dentro del toque
  const changeMode = (m) => { if (m !== mode) setClockMode(m); };
  const setField = (field, value) => setClockField(field, value);
  const skip = () => { if (run && st && !st.done) skipPhase(st.index); };

  // Colores según la fase: trabajo en lima, descanso en azul, preparación en ámbar
  const phaseType = mode === "stopwatch" ? (run ? "work" : null) : finished ? "done" : run ? st.phase.type : null;
  const face = {
    work: "bg-accent text-app",
    rest: "bg-calm text-app",
    setrest: "bg-calm text-app",
    cooldown: "bg-calm text-app",
    prep: "bg-warning text-app",
    done: "bg-card text-ink",
  }[phaseType] || "bg-card text-ink";
  const phaseLabel = {
    work: mode === "amrap" ? tr("¡A trabajar!") : mode === "stopwatch" ? tr("Cronómetro") : tr("Trabajo"),
    rest: tr("Descanso"),
    setrest: tr("Descanso entre series"),
    cooldown: tr("Enfriamiento"),
    prep: tr("Prepárese"),
    done: tr("¡Terminado!"),
  }[phaseType] || tr(MODE_LABELS[mode]);

  let big;
  if (mode === "stopwatch") big = formatStopwatch(elapsedMs);
  else if (!run) big = formatClock((phases.find((p) => p.type === "work") || phases[0])?.dur ?? 0);
  else big = formatClock(st.remaining);

  let sub = "";
  if (mode === "tabata") {
    const total = cfg.rounds;
    const round = run ? (finished ? total : st.phase.type === "prep" ? 1 : st.phase.round) : 1;
    sub = tr("Ciclo {p0} de {p1}", { p0: round, p1: total });
    if (cfg.sets > 1) {
      const set = run ? (finished ? cfg.sets : st.phase.set) : 1;
      sub = `${tr("Serie {p0} de {p1}", { p0: set, p1: cfg.sets })} · ${sub}`;
    }
    if (run && !finished) sub += ` · ${tr("Total")} ${formatClock(st.totalRemaining)}`;
  } else if (mode === "amrap") {
    sub = tr("Rondas: {p0}", { p0: rounds });
  } else if (mode === "rest" && run && !finished) {
    sub = tr("Toque +15 s si necesita más tiempo");
  }

  // Ejercicios del bloque (Tabata / AMRAP): cuál toca ahora y cuál sigue
  const exList = mode === "tabata" || mode === "amrap" ? s.exercises : [];
  const { current: exNow, next: exNext } = clockExercises(mode, phases, run ? st : null, exList);
  const nowIdx = exNow ? exList.indexOf(exNow) : -1;
  // Cuenta por serie: cuántas veces lleva cada ejercicio y cuáles ya terminó (solo Tabata)
  const progress = clockExerciseProgress(mode, phases, run ? st : null, exList);

  const lapRows = laps.map((t, i) => ({ n: i + 1, split: t - (laps[i - 1] || 0), total: t })).reverse();
  const secondaryBtn = "h-12 rounded-2xl bg-field text-ink text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-[70] bg-app flex flex-col animate-fade-in" role="dialog" aria-modal="true" aria-label={tr("Reloj")}>
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2">
        <h2 className="text-ink text-lg font-semibold">{tr("Reloj")}</h2>
        <button onClick={minimizeClock} aria-label={run ? tr("Minimizar (el reloj sigue corriendo)") : tr("Cerrar")} className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-soft">
          <ChevronDown size={20} />
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

          {programmed && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-4 text-xs ${isProgrammed ? "bg-accent/15 text-accent" : "bg-card text-soft"}`}>
              <span className="flex-1">{isProgrammed ? tr("Programado por su coach. Puede ajustarlo si lo necesita.") : tr("Usted cambió lo que programó su coach.")}</span>
              {!isProgrammed && !run && (
                <button onClick={backToProgrammed} className="text-accent font-semibold shrink-0">{tr("Volver a lo programado")}</button>
              )}
            </div>
          )}

          {/* Configuración (solo antes de iniciar) */}
          {!run && CLOCK_FIELDS[mode].length > 0 && (
            <div className="grid grid-cols-1 gap-2 mb-4">
              {visibleFields(mode, cfg).map((f) => (
                <ClockField key={`${mode}-${f.key}`} field={f} value={cfg[f.key]} onChange={(v) => setField(f, v)} t={tr} />
              ))}
              {CLOCK_FIELDS[mode].some((f) => f.unit === "time") && (
                <p className="text-muted text-[11px] px-1">{tr("Toque el tiempo para escribirlo exacto (por ejemplo 7 o 1:30). Mantenga − o + para ir más rápido.")}</p>
              )}
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
          {/* Ejercicio actual y siguiente */}
          {exList.length > 0 && (exNow || exNext) && (
            <div className="bg-card rounded-2xl px-4 py-3 mt-3 space-y-1.5">
              {exNow && (
                <p className="text-ink text-lg font-semibold leading-snug">
                  <span className="text-accent text-xs font-semibold uppercase tracking-wider mr-2">{tr("Ahora")}</span>
                  {exNow.name}{exNow.detail && <span className="text-soft text-sm font-normal"> · {exNow.detail}</span>}
                </p>
              )}
              {exNext && (
                <p className={exNow ? "text-soft text-sm" : "text-ink text-lg font-semibold leading-snug"}>
                  <span className="text-muted text-xs font-semibold uppercase tracking-wider mr-2">{tr("Sigue")}</span>
                  {exNext.name}{exNext.detail && <span className="text-muted text-xs font-normal"> · {exNext.detail}</span>}
                </p>
              )}
            </div>
          )}

          {mode === "amrap" && run && (
            <div className="flex gap-2 mt-3">
              <button onClick={removeRound} disabled={rounds === 0} className={`${secondaryBtn} w-14`} aria-label={tr("Quitar ronda")}><Minus size={18} /></button>
              <button onClick={() => { addRound(); vibrate(40); }} disabled={finished} className="flex-1 h-12 rounded-2xl bg-card border border-accent/40 text-accent text-base font-semibold active:scale-[0.97] transition-transform disabled:opacity-40">
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
              <button onClick={pauseClock} className="flex-1 h-14 rounded-2xl bg-ink text-app text-base font-semibold flex items-center justify-center gap-2">
                <Pause size={18} /> {tr("Pausar")}
              </button>
            ) : (
              <button onClick={resumeClock} className="flex-1 h-14 rounded-2xl bg-accent text-app text-base font-semibold flex items-center justify-center gap-2">
                <Play size={18} /> {tr("Seguir")}
              </button>
            )}
            {run && (
              <button onClick={resetClock} className={`${secondaryBtn} w-14 h-14!`} aria-label={tr("Reiniciar")}><RotateCcw size={18} /></button>
            )}
          </div>

          {run && !finished && (
            <div className="flex gap-2 mt-2">
              {mode === "rest" && (
                <>
                  <button onClick={() => addRestSeconds(-15)} className={`${secondaryBtn} flex-1`}>−15 s</button>
                  <button onClick={() => addRestSeconds(15)} className={`${secondaryBtn} flex-1`}>+15 s</button>
                </>
              )}
              {mode === "stopwatch" ? (
                <button onClick={() => addLap(elapsedMs)} className={`${secondaryBtn} flex-1`}><Flag size={16} /> {tr("Vuelta")}</button>
              ) : (
                <button onClick={skip} className={`${secondaryBtn} flex-1`}><SkipForward size={16} /> {mode === "rest" ? tr("Saltar") : tr("Siguiente fase")}</button>
              )}
            </div>
          )}

          {exList.length > 0 && (
            <div className="mt-4">
              <p className="text-muted text-xs mb-1.5">
                {mode === "tabata" ? tr("Un ejercicio por ciclo, en este orden:") : tr("Ejercicios de cada ronda:")}
                {progress && progress.sets > 1 && ` · ${tr("Serie {p0} de {p1}", { p0: progress.set, p1: progress.sets })}`}
              </p>
              <ol className="bg-card rounded-xl divide-y divide-white/[0.05]">
                {(progress ? progress.items : exList).map((e, i) => (
                  <li
                    key={i}
                    aria-label={progress ? tr("{p0}: {p1} de {p2} veces", { p0: e.name, p1: e.done, p2: e.total }) : undefined}
                    className={`flex items-baseline gap-2 px-4 py-2 text-sm ${e.current || (!progress && i === nowIdx) ? "text-accent font-semibold" : e.complete ? "text-muted" : "text-soft"}`}
                  >
                    <span className="text-muted text-xs w-4 shrink-0">{i + 1}</span>
                    <span className={`flex-1 min-w-0 ${e.complete ? "line-through" : ""}`}>{e.name}{e.detail && <span className="text-muted text-xs font-normal"> · {e.detail}</span>}</span>
                    {progress && (
                      <span className="shrink-0 flex items-center gap-1 text-xs tabular-nums" aria-hidden="true">
                        {e.done}/{e.total}
                        <Check size={13} strokeWidth={3} className={e.complete ? "text-accent" : "text-transparent"} />
                      </span>
                    )}
                  </li>
                ))}
              </ol>
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

          <p className="text-muted text-[11px] text-center mt-5">{tr("Puede cerrar el reloj o salir de la app: sigue corriendo en la píldora de arriba.")} {tr("Suena y vibra en cada cambio; al final la alarma sigue hasta que la apague. Suba el volumen del celular.")}</p>

          {/* Estado del sonido: sirve para revisar por qué no suena o por qué no sale la tarjeta
              en la pantalla de bloqueo. Se puede quitar cuando el reloj esté afinado. */}
          <AudioStatus running={running} />
        </div>
      </div>
    </div>
  );
}

// Estado del sonido en pequeñito, para no andar adivinando por qué no suena en el celular.
// "Sonido" es el motor de audio (debe decir running), "Fondo" es el audio que mantiene viva la
// sesión y "Tarjeta" es la de la pantalla de bloqueo.
function AudioStatus({ running }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    const leer = () => setInfo(audioState());
    leer();
    const id = setInterval(leer, 1000);
    return () => clearInterval(id);
  }, [running]);
  if (!info) return null;
  const ok = info.contexto === "running";
  return (
    <p className="text-muted text-[10px] text-center mt-2 tabular-nums">
      {tr("Sonido")}: <span className={ok ? "text-accent" : "text-warning"}>{info.contexto}</span>
      {" · "}{tr("Fondo")}: <span className={info.sonando ? "text-accent" : "text-warning"}>{info.sonando ? tr("sí") : tr("no")}</span>
      {" · "}{tr("Tarjeta")}: <span className={info.tarjeta ? "text-accent" : "text-warning"}>{info.tarjeta ? tr("sí") : tr("no")}</span>
      {" · "}{info.sesion}
    </p>
  );
}
