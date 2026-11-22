"use client";

import { useEffect, useRef, useState } from "react";
import { BellOff, Check, ChevronDown, ChevronUp, Maximize2, Pause, Play, SkipForward } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { tr } from "@/lib/i18n";
import { beep, vibrate } from "@/lib/alarm";
import { clockExerciseProgress, clockExercises, formatClock, stateAt } from "@/lib/clock";
import { markBlockDone } from "@/lib/clockProgress";
import { clockPhases, elapsedMs, endAt, isRunning, openClock, pauseClock, resumeClock, ringAlarm, setIslandCompact, skipPhase, stopAlarm, useClock } from "@/lib/clockStore";
import { WorkoutClock } from "@/components/student/WorkoutClock";

// Hora actual (fuera de los componentes: solo se usa en efectos)
const nowMs = () => Date.now();

// Cuánto tiempo suena la alarma y se ve la píldora roja al terminar
const RING_MS = 10000;

const MODE_LABELS = { rest: "Descanso", tabata: "Tabata", amrap: "AMRAP", stopwatch: "Cronómetro" };

// Texto del aviso que llega al celular si el reloj termina con la app cerrada
const DONE_TEXT = {
  rest: "Terminó su descanso",
  tabata: "Terminó su Tabata",
  amrap: "Terminó el AMRAP",
};

// Todo el reloj del alumno: el motor (sonidos, alarma, aviso al celular), la píldora y el reloj grande.
// Va una sola vez en la app del alumno.
// onProgressMarked: avisa a la rutina de que el reloj dio el bloque por hecho, para que se vuelva a dibujar.
export function ClockHost({ userId, onProgressMarked }) {
  const s = useClock();
  return (
    <>
      <ClockEngine userId={userId} onProgressMarked={onProgressMarked} />
      {!s.open && <ClockIsland />}
      {s.open && <WorkoutClock />}
    </>
  );
}

// Lleva la cuenta aunque no se vea el reloj: pitidos en cada cambio, alarma al final,
// pantalla encendida mientras corre y el aviso programado para cuando la app está cerrada.
function ClockEngine({ userId, onProgressMarked }) {
  const s = useClock();
  const running = isRunning(s);
  const [tick, setTick] = useState(0);
  const lastIndex = useRef(-1);
  const lastTick = useRef(null);
  const runId = useRef(null);
  const wakeLock = useRef(null);
  const sentAlarm = useRef(0);
  const marked = useRef(null); // reloj cuyo bloque ya se dio por hecho (para no marcarlo dos veces)
  const avisar = useRef(onProgressMarked); // en un ref: cambia en cada dibujo y no debe reiniciar el motor
  useEffect(() => { avisar.current = onProgressMarked; }, [onProgressMarked]);

  // Refresca mientras corre, y apenas el alumno vuelve a la app
  useEffect(() => {
    const bump = () => setTick(nowMs());
    bump();
    const onVisible = () => { if (document.visibilityState === "visible") bump(); };
    document.addEventListener("visibilitychange", onVisible);
    const id = running ? setInterval(bump, 200) : null;
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running]);

  // Pitidos y vibración: cambio de fase, últimos 3 segundos y alarma final
  useEffect(() => {
    if (!tick) return;
    const run = s.run;
    if (!run || s.mode === "stopwatch") {
      lastIndex.current = -1;
      runId.current = run?.id || null;
      return;
    }
    if (runId.current !== run.id) {
      runId.current = run.id;
      lastIndex.current = -1;
      lastTick.current = null;
    }
    const phases = clockPhases(s);
    const st = stateAt(phases, elapsedMs(s, nowMs()));
    if (st.done) {
      if (lastIndex.current !== phases.length) {
        lastIndex.current = phases.length;
        if (!run.pausedAt) pauseClock(true); // se queda en 0:00 (sin pitido: ya suena la alarma)
        if (!s.ringing && !run.acked) ringAlarm();
        // Con la app a la vista se borra el aviso al celular (ya suena aquí). Si la app está en segundo
        // plano (otra pestaña u otra app) se deja, para que llegue la notificación.
        if (userId && document.visibilityState === "visible") supabase.rpc("clear_clock_alarm").then(() => { }, () => { });
        sentAlarm.current = 0;
        // Terminó el reloj de un bloque de la rutina: sus ejercicios quedan marcados como hechos.
        // Solo una vez por reloj, y solo si se abrió desde la rutina (el reloj suelto no marca nada).
        if (userId && s.fromRoutine && s.dayLabel && marked.current !== run.id) {
          marked.current = run.id;
          markBlockDone(supabase, userId, { exercises: s.exercises, dayLabel: s.dayLabel, mode: s.mode, cfg: s.configs[s.mode] })
            .then((r) => { if (r.sets || r.done) avisar.current?.(); }, () => { });
        }
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
    if (!run.pausedAt && st.remaining <= 3 && st.remaining >= 1 && lastTick.current !== `${st.index}:${st.remaining}`) {
      lastTick.current = `${st.index}:${st.remaining}`;
      beep({ freq: 988, dur: 0.12, vol: 0.7 });
    }
  }, [tick, s, userId]);

  // Al terminar, la alarma suena y la píldora queda en rojo 10 segundos; después se apaga sola
  // (también se puede apagar antes con "Apagar").
  useEffect(() => {
    if (!s.ringing) return undefined;
    const id = setTimeout(stopAlarm, RING_MS);
    return () => clearTimeout(id);
  }, [s.ringing]);

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

  // Aviso al celular para cuando termine con la app cerrada (lo envía Supabase).
  // Se programa al iniciar / reanudar / sumar tiempo y se borra al pausar o reiniciar.
  const end = endAt(s);
  const mode = s.mode;
  useEffect(() => {
    if (!userId) return;
    const key = end ? Math.round(end / 1000) : 0;
    if (key === sentAlarm.current) return;
    const hadOne = sentAlarm.current !== 0;
    sentAlarm.current = key;
    if (end && end - nowMs() > 5000 && DONE_TEXT[mode]) {
      supabase
        .rpc("set_clock_alarm", { p_fire_at: new Date(end).toISOString(), p_title: DONE_TEXT[mode], p_body: "Toque para volver a Kineaco." })
        .then(() => { }, () => { });
    } else if (hadOne) {
      supabase.rpc("clear_clock_alarm").then(() => { }, () => { });
    }
  }, [end, mode, userId]);

  return null;
}

// Píldora arriba (tipo isla del iPhone): el reloj sigue corriendo y al tocarla se abre en grande.
// Queda debajo de la isla / muesca del iPhone gracias a env(safe-area-inset-top).
function ClockIsland() {
  const s = useClock();
  const [now, setNow] = useState(0);
  const running = isRunning(s);
  useEffect(() => {
    setNow(nowMs());
    if (!running) return undefined;
    const id = setInterval(() => setNow(nowMs()), 250);
    return () => clearInterval(id);
  }, [running, s.run?.id]);

  if (!s.run || !now) return null;
  if (!s.ringing && !s.compact && (s.mode === "tabata" || s.mode === "amrap")) return <BigIsland s={s} now={now} />;

  const paused = !!s.run.pausedAt && !s.ringing;
  let time;
  let label;
  let frac = 1;
  let tone = "accent";
  if (s.mode === "stopwatch") {
    time = formatClock(elapsedMs(s, now) / 1000);
    label = tr("Cronómetro");
  } else {
    const st = stateAt(clockPhases(s), elapsedMs(s, now));
    if (st.done) {
      time = "0:00";
      label = tr("¡Terminado!");
      frac = 0;
    } else {
      time = formatClock(st.remaining);
      frac = st.phase.dur ? st.remaining / st.phase.dur : 1;
      const type = st.phase.type;
      tone = type === "rest" || type === "setrest" || type === "cooldown" ? "calm" : type === "prep" ? "warning" : "accent";
      const setText = st.phase.sets > 1 ? ` · S${st.phase.set}/${st.phase.sets}` : "";
      if (type === "prep") label = tr("Prepárese");
      else if (type === "setrest") label = `${tr("Descanso entre series")}${setText}`;
      else if (type === "cooldown") label = tr("Enfriamiento");
      else if (s.mode === "rest") label = tr("Descanso");
      else if (s.mode === "amrap") label = `AMRAP · ${tr("Rondas: {p0}", { p0: s.rounds })}`;
      else label = `${type === "rest" ? tr("Descanso") : tr("Trabajo")} · ${st.phase.round}/${st.phase.rounds}${setText}`;
    }
  }

  const color = { accent: "var(--color-accent)", calm: "var(--color-calm)", warning: "var(--color-warning)" }[tone];
  const R = 9;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none top-[calc(env(safe-area-inset-top)+0.5rem)] md:top-4 px-4">
      {s.ringing ? (
        <div role="alert" className="pointer-events-auto flex items-center gap-2 bg-danger text-app rounded-full pl-4 pr-1.5 py-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] animate-pulse">
          <span className="text-sm font-semibold">{tr("¡Terminado!")} · {tr(MODE_LABELS[s.mode])}</span>
          <button onClick={stopAlarm} className="flex items-center gap-1.5 bg-app/15 rounded-full px-3 py-1.5 text-sm font-semibold">
            <BellOff size={15} /> {tr("Apagar")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openClock()}
          aria-label={`${tr("Reloj")}: ${label} ${time}. ${tr("Toque para abrirlo")}`}
          className="pointer-events-auto flex items-center gap-2.5 bg-black/90 border border-white/[0.08] rounded-full pl-1.5 pr-4 py-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] animate-fade-in active:scale-[0.97] transition-transform max-w-full"
        >
          <span className="relative w-7 h-7 shrink-0 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="12" cy="12" r={R} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
              <circle cx="12" cy="12" r={R} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, frac)))} style={{ transition: "stroke-dashoffset 0.25s linear" }} />
            </svg>
            {paused && <Pause size={11} className="text-soft relative" />}
          </span>
          <span className="text-soft text-xs truncate">{paused ? tr("En pausa") : label}</span>
          <span className="text-ink text-[15px] font-semibold tabular-nums">{time}</span>
          {(s.mode === "tabata" || s.mode === "amrap") && (
            <span
              role="button"
              tabIndex={0}
              aria-label={tr("Agrandar")}
              onClick={(e) => { e.stopPropagation(); setIslandCompact(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setIslandCompact(false); } }}
              className="-mr-2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-soft"
            >
              <ChevronDown size={14} />
            </span>
          )}
        </button>
      )}
    </div>
  );
}

// Píldora grande y translúcida para Tabata y AMRAP: tiempo grande + qué ejercicio toca y cuál sigue
// (en AMRAP, la lista de la ronda, sin marcar nada),
// sin tapar la rutina (se ven los ejercicios por detrás). Se puede achicar a la píldora normal.
function BigIsland({ s, now }) {
  const phases = clockPhases(s);
  const st = stateAt(phases, elapsedMs(s, now));
  const paused = !!s.run.pausedAt && !st.done;
  const type = st.done ? "done" : st.phase.type;
  const isAmrap = s.mode === "amrap";
  const { current, next } = clockExercises(s.mode, phases, st, s.exercises);
  const hasExercises = s.exercises.length > 0;
  // Cuenta por serie: cuántas veces lleva cada ejercicio y cuáles ya terminó (solo Tabata)
  const progress = clockExerciseProgress(s.mode, phases, st, s.exercises);

  const tone = type === "rest" || type === "setrest" || type === "cooldown" ? "calm" : type === "prep" ? "warning" : "accent";
  const color = { accent: "var(--color-accent)", calm: "var(--color-calm)", warning: "var(--color-warning)" }[tone];
  const textColor = { accent: "text-accent", calm: "text-calm", warning: "text-warning" }[tone];
  const frac = st.done ? 0 : st.phase.dur ? st.remaining / st.phase.dur : 1;

  let label;
  if (st.done) label = tr("¡Terminado!");
  else if (type === "prep") label = tr("Prepárese");
  else if (type === "setrest") label = tr("Descanso entre series");
  else if (type === "cooldown") label = tr("Enfriamiento");
  else if (type === "rest") label = tr("Descanso");
  else label = isAmrap ? "AMRAP" : tr("Trabajo");

  let counter = "";
  if (isAmrap) counter = tr("Rondas: {p0}", { p0: s.rounds });
  else if (!st.done && st.phase.type !== "prep") {
    counter = tr("Ciclo {p0} de {p1}", { p0: st.phase.round, p1: st.phase.rounds });
    if (st.phase.sets > 1) counter = `${tr("Serie {p0} de {p1}", { p0: st.phase.set, p1: st.phase.sets })} · ${counter}`;
  }

  const working = !st.done && type === "work";
  const ctrl = "w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-ink active:scale-90 transition-transform";

  return (
    <div className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none top-[calc(env(safe-area-inset-top)+0.5rem)] md:top-4 px-3">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl bg-black/55 backdrop-blur-md border border-white/[0.1] shadow-[0_14px_40px_-12px_rgba(0,0,0,0.85)] px-4 pt-3 pb-3 animate-fade-in">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${textColor}`}>{paused ? tr("En pausa") : label}</span>
          {counter && <span className="text-soft text-[11px] truncate">· {counter}</span>}
          <span className="flex-1" />
          <button onClick={() => openClock()} aria-label={tr("Abrir el reloj completo")} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-soft"><Maximize2 size={14} /></button>
          <button onClick={() => setIslandCompact(true)} aria-label={tr("Achicar")} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-soft"><ChevronUp size={16} /></button>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <p className="text-ink text-5xl font-semibold tabular-nums leading-none flex-1">{st.done ? "0:00" : formatClock(st.remaining)}</p>
          {!st.done && (
            paused ? (
              <button onClick={resumeClock} aria-label={tr("Seguir")} className={ctrl}><Play size={18} /></button>
            ) : (
              <button onClick={pauseClock} aria-label={tr("Pausar")} className={ctrl}><Pause size={18} /></button>
            )
          )}
          {!st.done && !isAmrap && (
            <button onClick={() => skipPhase(st.index)} aria-label={tr("Siguiente fase")} className={ctrl}><SkipForward size={18} /></button>
          )}
        </div>

        <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-2.5">
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color, transition: "width 0.25s linear" }} />
        </div>

        {hasExercises && (current || next) && (
          <div className="mt-2.5 space-y-1">
            {current && (
              <p className="text-ink text-base font-semibold leading-snug">
                <span className="text-accent text-[11px] font-semibold uppercase tracking-wider mr-1.5">{tr("Ahora")}</span>
                {current.name}{current.detail && <span className="text-soft text-xs font-normal"> · {current.detail}</span>}
              </p>
            )}
            {next && (
              <p className={current ? "text-soft text-sm leading-snug" : "text-ink text-base font-semibold leading-snug"}>
                <span className="text-muted text-[11px] font-semibold uppercase tracking-wider mr-1.5">{tr("Sigue")}</span>
                {next.name}{next.detail && <span className="text-muted text-xs font-normal"> · {next.detail}</span>}
              </p>
            )}
          </div>
        )}

        {/* Tabata: la lista completa, contando y tachando lo que ya hizo en esta serie */}
        {progress && (
          <ol className="mt-2.5 pt-2.5 border-t border-white/[0.08] max-h-[8.5rem] overflow-y-auto overscroll-contain space-y-0.5">
            {progress.items.map((e, i) => (
              <li
                key={i}
                aria-label={tr("{p0}: {p1} de {p2} veces", { p0: e.name, p1: e.done, p2: e.total })}
                className={`flex items-baseline gap-2 text-sm leading-snug ${e.current ? "text-accent font-semibold" : e.complete ? "text-muted" : "text-soft"}`}
              >
                <span className="text-muted text-xs w-3.5 shrink-0">{i + 1}</span>
                <span className={`flex-1 min-w-0 truncate ${e.complete ? "line-through" : ""}`}>{e.name}</span>
                <span className="shrink-0 flex items-center gap-0.5 text-xs tabular-nums" aria-hidden="true">
                  {e.done}/{e.total}
                  <Check size={12} strokeWidth={3} className={e.complete ? "text-accent" : "text-transparent"} />
                </span>
              </li>
            ))}
          </ol>
        )}

        {isAmrap && hasExercises && !st.done && (
          <ol className="mt-2.5 space-y-0.5">
            {s.exercises.map((e, i) => (
              <li key={i} className="text-ink text-sm leading-snug flex gap-2">
                <span className="text-muted text-xs w-4 shrink-0 pt-0.5">{i + 1}</span>
                <span className="min-w-0">{e.name}{e.detail && <span className="text-soft text-xs"> · {e.detail}</span>}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
