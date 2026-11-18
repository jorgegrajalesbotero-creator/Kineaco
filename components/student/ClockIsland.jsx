"use client";

import { useEffect, useRef, useState } from "react";
import { BellOff, Pause } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { tr } from "@/lib/i18n";
import { beep, vibrate } from "@/lib/alarm";
import { formatClock, stateAt } from "@/lib/clock";
import { clockPhases, elapsedMs, endAt, isRunning, openClock, pauseClock, ringAlarm, stopAlarm, useClock } from "@/lib/clockStore";
import { WorkoutClock } from "@/components/student/WorkoutClock";

// Hora actual (fuera de los componentes: solo se usa en efectos)
const nowMs = () => Date.now();

// Cuánto tiempo suena la alarma y se ve la píldora roja al terminar
const RING_MS = 10000;

const MODE_LABELS = { rest: "Descanso", tabata: "Tabata", intervals: "Intervalos", amrap: "AMRAP", stopwatch: "Cronómetro" };

// Texto del aviso que llega al celular si el reloj termina con la app cerrada
const DONE_TEXT = {
  rest: "Terminó su descanso",
  tabata: "Terminó su Tabata",
  intervals: "Terminaron sus intervalos",
  amrap: "Terminó el AMRAP",
};

// Todo el reloj del alumno: el motor (sonidos, alarma, aviso al celular), la píldora y el reloj grande.
// Va una sola vez en la app del alumno.
export function ClockHost({ userId }) {
  const s = useClock();
  return (
    <>
      <ClockEngine userId={userId} />
      {!s.open && <ClockIsland />}
      {s.open && <WorkoutClock />}
    </>
  );
}

// Lleva la cuenta aunque no se vea el reloj: pitidos en cada cambio, alarma al final,
// pantalla encendida mientras corre y el aviso programado para cuando la app está cerrada.
function ClockEngine({ userId }) {
  const s = useClock();
  const running = isRunning(s);
  const [tick, setTick] = useState(0);
  const lastIndex = useRef(-1);
  const lastTick = useRef(null);
  const runId = useRef(null);
  const wakeLock = useRef(null);
  const sentAlarm = useRef(0);

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
        if (!run.pausedAt) pauseClock(); // se queda en 0:00
        if (!s.ringing && !run.acked) ringAlarm();
        if (userId) supabase.rpc("clear_clock_alarm").then(() => { }, () => { });
        sentAlarm.current = 0;
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
      tone = type === "rest" ? "calm" : type === "prep" ? "warning" : "accent";
      if (type === "prep") label = tr("Prepárese");
      else if (s.mode === "rest") label = tr("Descanso");
      else if (s.mode === "amrap") label = `AMRAP · ${tr("Rondas: {p0}", { p0: s.rounds })}`;
      else label = `${type === "rest" ? tr("Descanso") : tr("Trabajo")} · ${st.phase.round}/${st.phase.rounds}`;
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
        </button>
      )}
    </div>
  );
}
