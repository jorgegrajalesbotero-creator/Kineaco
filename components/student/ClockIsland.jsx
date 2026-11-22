"use client";

import { useEffect, useRef, useState } from "react";
import { BellOff, ChevronDown, ChevronUp, Clock, ListChecks, Pause, Play, SkipForward, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { tr } from "@/lib/i18n";
import { beep, vibrate } from "@/lib/alarm";
import { clockCardText, clockExercises, formatClock, stateAt, timerLabel } from "@/lib/clock";
import { exerciseMarks, markBlockDone, markExercisesDone } from "@/lib/clockProgress";
import { hideNowPlaying, updateClockPosition, updateNowPlaying } from "@/lib/clockMedia";
import { drawCard } from "@/lib/clockArtwork";
import { hideClockNotification, showClockNotification } from "@/lib/clockNotification";
import { clockPhases, elapsedMs, endAt, getClock, isRunning, openClock, pauseClock, resumeClock, addRound, removeRound, resetClock, ringAlarm, setIslandCompact, skipPhase, stopAlarm, useClock } from "@/lib/clockStore";
import { WorkoutClock } from "@/components/student/WorkoutClock";

// Hora actual (fuera de los componentes: solo se usa en efectos)
const nowMs = () => Date.now();

// Cerrar el reloj y quitarlo de todos lados: la ficha, la notificación y la pantalla de
// bloqueo (eso último sale solo, porque sin reloj los avisos se retiran).
// Si está corriendo se pregunta: un toque sin querer no puede borrar un Tabata a medias.
function cerrarReloj() {
  const s = getClock();
  const corriendo = !!s.run && !s.run.pausedAt && !s.ringing;
  if (corriendo && !window.confirm(tr("¿Cerrar el reloj? Va a detenerse y perderá la cuenta."))) return;
  stopAlarm();
  resetClock();
}

// Cuánto falta para que el reloj cambie de segundo. Los pulsos se acomodan a esto en vez de
// ir cada 200 ms a ciegas: así el número baja justo cuando toca, sin quedarse pegado ni
// saltarse uno, y de paso se trabaja menos (un dibujo por segundo en vez de cinco).
function faltaParaElSegundo() {
  try {
    const s = getClock();
    if (!s.run || s.run.pausedAt) return 1000;
    const resto = elapsedMs(s, nowMs()) % 1000;
    return Math.max(60, 1000 - resto);
  } catch {
    return 250;
  }
}

// Cuánto tiempo suena la alarma y se ve la píldora roja al terminar
const RING_MS = 10000;

const MODE_LABELS = { rest: "Descanso", tabata: "Tabata", amrap: "AMRAP", stopwatch: "Cronómetro" };

// Texto del aviso que llega al celular si el reloj termina con la app cerrada
const DONE_TEXT = {
  rest: "Terminó su descanso",
  tabata: "Terminó su Tabata",
  amrap: "Terminó el AMRAP",
};

// Aviso al celular cuando el reloj arranca. Solo dos avisos por reloj: este y el de "terminó"
// (antes había una ficha que se actualizaba cada 2 segundos y llenaba el celular de avisos).
const START_TEXT = {
  rest: "Empezó su descanso",
  tabata: "Empezó su Tabata",
  amrap: "Empezó el AMRAP",
  stopwatch: "Empezó el cronómetro",
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
  const marcasEj = useRef(""); // ejercicios del Tabata ya marcados mientras corre (para no repetir)
  const cola = useRef(Promise.resolve()); // los marcados van uno detrás de otro (nunca dos a la vez)
  const avisoInicio = useRef(null); // reloj al que ya se le mandó el aviso de inicio
  const avisoFin = useRef(null); // reloj al que ya se le mandó el aviso de fin
  const lastCard = useRef(""); // ciclo y fase que ya tiene la tarjeta (para no redibujarla por gusto)
  const cardUrl = useRef(null); // carátula dibujada en uso
  const avisar = useRef(onProgressMarked); // en un ref: cambia en cada dibujo y no debe reiniciar el motor
  useEffect(() => { avisar.current = onProgressMarked; }, [onProgressMarked]);

  // Refresca mientras corre, y apenas el alumno vuelve a la app.
  // El pulso se acomoda al segundo real en vez de ir cada 200 ms a ciegas: así el número
  // cambia justo cuando toca y no se queda pegado un instante de más.
  useEffect(() => {
    let id;
    const bump = () => setTick(nowMs());
    bump();
    const onVisible = () => { if (document.visibilityState === "visible") bump(); };
    document.addEventListener("visibilitychange", onVisible);
    const latir = () => {
      bump();
      id = setTimeout(latir, faltaParaElSegundo());
    };
    if (running) latir();
    return () => {
      if (id) clearTimeout(id);
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
      marcasEj.current = "";
    }
    const phases = clockPhases(s);
    const st = stateAt(phases, elapsedMs(s, nowMs()));

    // Tabata desde la rutina: cada ejercicio queda marcado apenas termina sus turnos,
    // sin esperar al final. Solo se escribe cuando cambia algo.
    if (userId && s.mode === "tabata" && s.fromRoutine && s.dayLabel && s.exercises.length) {
      const marcas = exerciseMarks(phases, st, s.exercises);
      const firma = `${run.id}:${marcas.map((m) => `${m.setsDone}${m.allDone ? "+" : ""}`).join(",")}`;
      if (firma !== marcasEj.current && marcas.some((m) => m.setsDone > 0 || m.allDone)) {
        marcasEj.current = firma;
        const datos = { exercises: s.exercises, dayLabel: s.dayLabel, marks: marcas };
        cola.current = cola.current
          .then(() => markExercisesDone(supabase, userId, datos))
          .then((r) => { if (r.sets || r.done) avisar.current?.(); }, () => { });
      }
    }
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
          const datos = { exercises: s.exercises, dayLabel: s.dayLabel, mode: s.mode, cfg: s.configs[s.mode] };
          cola.current = cola.current
            .then(() => markBlockDone(supabase, userId, datos))
            .then((r) => { if (r.sets || r.done) avisar.current?.(); }, () => { });
        }
        // Aviso de fin. Con la app a la vista lo pone la app; con la app cerrada lo manda Supabase
        // (así nunca llegan dos).
        if (avisoFin.current !== run.id && document.visibilityState === "visible") {
          avisoFin.current = run.id;
          showClockNotification({ title: tr(DONE_TEXT[s.mode] || "¡Terminado!"), body: s.mode === "amrap" ? tr("Rondas: {p0}", { p0: s.rounds }) : tr("Toque para volver a Kineaco.") });
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
          beep([{ freq: 740, dur: 0.22 }, { freq: 740, at: 0.3, dur: 0.22 }]); // los dos en una sola pista
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

  // Tarjeta en la pantalla de bloqueo y el centro de control mientras el reloj corre.
  // La píldora es HTML y solo se ve dentro de la app; esto es lo que el alumno ve con el
  // celular bloqueado (en iPhone sale además en la isla dinámica, como actividad de audio).
  useEffect(() => {
    if (!tick) return;
    if (!s.run) {
      hideNowPlaying();
      return;
    }
    const phases = clockPhases(s);
    const st = s.mode === "stopwatch" ? null : stateAt(phases, elapsedMs(s, nowMs()));
    const paused = !!s.run.pausedAt;

    // 1) El cronómetro: va cada segundo y lo anima el celular solo, sin tocar nada más
    const duration = st && !st.done ? st.phase.dur : 0;
    const position = duration ? duration - st.remaining : 0;
    updateClockPosition({ duration, position, paused });

    // 2) Los textos y la carátula: solo cuando cambian de ciclo o de fase. Si esto se hiciera
    // cada segundo, el celular borraría y recargaría la carátula y la pantalla parpadearía.
    const texto = clockCardText({ mode: s.mode, phases, st, exercises: s.exercises, rounds: s.rounds, tr });
    // Las rondas entran en la clave: al contar una, la ficha se vuelve a dibujar y el alumno
    // confirma desde afuera que quedó.
    const clave = `${texto.phase}|${texto.cycle}|${texto.set}|${texto.title}|${texto.artist}`;
    // En AMRAP, los botones de pista de la tarjeta cuentan rondas (es lo único que el
    // celular deja añadir ahí). En los demás modos no se ponen.
    const contarRondas = s.mode === "amrap" && !st?.done;
    const poner = (artwork) => {
      if (artwork) cardUrl.current = artwork;
      updateNowPlaying({
        ...texto,
        artwork: artwork || cardUrl.current,
        onPlay: resumeClock,
        onPause: pauseClock,
        onAddRound: contarRondas ? () => { addRound(); vibrate(40); } : null,
        onRemoveRound: contarRondas ? removeRound : null,
      });
    };
    if (clave !== lastCard.current) {
      lastCard.current = clave;
      const dibujada = drawCard({
        phase: texto.phase,
        label: texto.artist.split(" · ")[0] || texto.title,
        time: duration ? formatClock(duration) : "",
        cycle: texto.cycle,
        cycles: texto.cycles,
        set: texto.set,
        sets: texto.sets,
        rounds: s.mode === "amrap" ? s.rounds : null,
        onReady: poner, // la imagen tarda un instante en estar lista
      });
      poner(dibujada);
    } else {
      poner(cardUrl.current);
    }
  }, [tick, s]);

  // Aviso de inicio: uno solo por reloj, al arrancar (pausar y seguir no vuelve a avisar).
  // El de fin va arriba, cuando termina. Si se cierra el reloj, el aviso se quita.
  const runKey = s.run?.id || null;
  useEffect(() => {
    if (!runKey) {
      hideClockNotification();
      return;
    }
    const c = getClock();
    if (avisoInicio.current === runKey || c.run?.pausedAt) return;
    avisoInicio.current = runKey;
    showClockNotification({ title: tr(START_TEXT[c.mode] || "Reloj"), body: timerLabel({ mode: c.mode, ...c.configs[c.mode] }, tr) });
  }, [runKey]);

  // Rondas contadas desde los botones de la notificación: el service worker avisa por aquí
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
    const oir = (e) => {
      if (e.data?.type !== "clock-round") return;
      if (e.data.delta > 0) { addRound(); vibrate(40); } else removeRound();
    };
    navigator.serviceWorker.addEventListener("message", oir);
    return () => navigator.serviceWorker.removeEventListener("message", oir);
  }, []);

  // Al salir de la app del alumno, no dejar nada colgado
  useEffect(() => () => { hideNowPlaying(); hideClockNotification(); }, []);

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
  // Mismo pulso acomodado al segundo que usa el motor: antes la píldora iba por su cuenta cada
  // 250 ms y, al no coincidir con el motor, el número se veía a tirones.
  useEffect(() => {
    let id;
    setNow(nowMs());
    if (!running) return undefined;
    const latir = () => {
      setNow(nowMs());
      id = setTimeout(latir, faltaParaElSegundo());
    };
    latir();
    return () => clearTimeout(id);
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
        <div role="alert" className="pointer-events-auto flex items-center gap-2.5 bg-danger text-app rounded-full pl-4 pr-1.5 py-1.5 shadow-[0_14px_34px_-10px_rgb(0_0_0/0.8)] animate-pulse">
          <span className="text-[15px] font-semibold">{tr("¡Terminado!")} · {tr(MODE_LABELS[s.mode])}</span>
          <button onClick={stopAlarm} className="flex items-center gap-1.5 bg-app/15 rounded-full px-3.5 py-1.5 text-[15px] font-semibold active:scale-95 transition-transform">
            <BellOff size={15} /> {tr("Apagar")}
          </button>
          <button onClick={cerrarReloj} aria-label={tr("Cerrar el reloj")} className="w-8 h-8 rounded-full bg-app/15 flex items-center justify-center shrink-0 active:scale-90 transition-transform">
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openClock()}
          aria-label={`${tr("Reloj")}: ${label} ${time}. ${tr("Toque para abrirlo")}`}
          className="pointer-events-auto flex items-center gap-2.5 bg-black/85 backdrop-blur-xl border border-white/[0.07] rounded-full pl-2 pr-4 py-2 shadow-[0_14px_34px_-10px_rgb(0_0_0/0.85)] animate-fade-in active:scale-[0.97] transition-transform max-w-full"
        >
          <span className="relative w-7 h-7 shrink-0 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="12" cy="12" r={R} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
              <circle cx="12" cy="12" r={R} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, frac)))} style={{ transition: "stroke-dashoffset 0.25s linear" }} />
            </svg>
            {paused && <Pause size={11} className="text-soft relative" />}
          </span>
          <span className="text-soft text-[13px] truncate">{paused ? tr("En pausa") : label}</span>
          <span className="font-rounded text-ink text-[17px] font-semibold tracking-[-0.01em]">{time}</span>
          {(s.mode === "tabata" || s.mode === "amrap") && (
            <span
              role="button"
              tabIndex={0}
              aria-label={tr("Agrandar")}
              onClick={(e) => { e.stopPropagation(); setIslandCompact(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setIslandCompact(false); } }}
              className="w-7 h-7 rounded-full bg-white/[0.12] flex items-center justify-center text-soft"
            >
              <ChevronDown size={14} />
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            aria-label={tr("Cerrar el reloj")}
            onClick={(e) => { e.stopPropagation(); cerrarReloj(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); cerrarReloj(); } }}
            className="-mr-2.5 w-7 h-7 rounded-full bg-white/[0.12] flex items-center justify-center text-soft"
          >
            <X size={14} />
          </span>
        </button>
      )}
    </div>
  );
}

// Píldora grande y translúcida para Tabata y AMRAP: el tiempo, el ejercicio que se está haciendo
// (grande y resaltado) y cuál sigue. Un solo ejercicio a la vez: la lista completa se ve en la
// rutina ("Ver rutina" achica la píldora) o en el reloj grande ("Abrir reloj").
function BigIsland({ s, now }) {
  const phases = clockPhases(s);
  const st = stateAt(phases, elapsedMs(s, now));
  const paused = !!s.run.pausedAt && !st.done;
  const type = st.done ? "done" : st.phase.type;
  const isAmrap = s.mode === "amrap";
  const { current, next } = clockExercises(s.mode, phases, st, s.exercises);

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

  // Serie y ciclo, cortos, a la derecha de la fase
  let counter = "";
  if (isAmrap) counter = tr("Rondas: {p0}", { p0: s.rounds });
  else if (!st.done && st.phase.type !== "prep") {
    counter = `${tr("Ciclo")} ${st.phase.round}/${st.phase.rounds}`;
    if (st.phase.sets > 1) counter = `${tr("Serie")} ${st.phase.set}/${st.phase.sets} · ${counter}`;
  }

  // Botón redondo translúcido, como los de las tarjetas del sistema
  const ctrl = "w-9 h-9 rounded-full bg-white/[0.12] flex items-center justify-center text-ink active:scale-90 transition-transform";
  const chip = "flex items-center gap-1.5 bg-white/[0.12] rounded-full px-3 py-1.5 text-[13px] text-ink active:scale-95 transition-transform";
  const RING = 29;
  const RING_C = 2 * Math.PI * RING;

  return (
    <div className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none top-[calc(env(safe-area-inset-top)+0.5rem)] md:top-4 px-3">
      <div className="pointer-events-auto w-full max-w-md rounded-[28px] bg-black/80 backdrop-blur-2xl border border-white/[0.07] shadow-[0_20px_50px_-12px_rgb(0_0_0/0.9)] px-5 pt-4 pb-4 animate-fade-in">
        {/* Fase con su punto de color, serie y ciclo, y las acciones de la tarjeta */}
        <div className="flex items-center gap-2">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
          <span className={`text-[13px] font-medium ${textColor}`}>{paused ? tr("En pausa") : label}</span>
          {counter && <span className="text-soft text-[13px] tabular-nums truncate">· {counter}</span>}
          <span className="flex-1" />
          <button onClick={() => setIslandCompact(true)} aria-label={tr("Achicar")} className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-soft active:scale-90 transition-transform"><ChevronUp size={16} /></button>
          <button onClick={cerrarReloj} aria-label={tr("Cerrar el reloj")} className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-soft active:scale-90 transition-transform"><X size={16} /></button>
        </div>

        {/* El tiempo manda; a su derecha el anillo que lo acompaña, con la pausa dentro */}
        <div className="flex items-end gap-3 mt-1">
          <p className="flex-1 min-w-0 font-rounded text-ink text-[3.5rem] font-semibold leading-[1.02] tracking-[-0.035em] tabular-nums">
            {st.done ? "0:00" : formatClock(st.remaining)}
          </p>

          {!st.done && !isAmrap && (
            <button onClick={() => skipPhase(st.index)} aria-label={tr("Siguiente fase")} className={`${ctrl} mb-1.5`}><SkipForward size={16} /></button>
          )}

          {!st.done && (
            <button
              onClick={paused ? resumeClock : pauseClock}
              aria-label={paused ? tr("Seguir") : tr("Pausar")}
              className="relative w-[68px] h-[68px] shrink-0 flex items-center justify-center text-ink active:scale-90 transition-transform"
            >
              <svg viewBox="0 0 68 68" className="absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx="34" cy="34" r={RING} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="4" />
                <circle
                  cx="34" cy="34" r={RING} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - Math.max(0, Math.min(1, frac)))}
                  style={{ transition: "stroke-dashoffset 0.25s linear" }}
                />
              </svg>
              {paused ? <Play size={22} className="relative ml-0.5" /> : <Pause size={22} className="relative" />}
            </button>
          )}
        </div>

        {/* El ejercicio que se está haciendo: grande y resaltado en el color de la app */}
        {current && (
          <div className="mt-3 rounded-2xl bg-accent/15 border border-accent/40 px-3.5 py-2.5">
            <p className="text-accent text-[11px] font-semibold uppercase tracking-[0.12em]">{tr("Ahora")}</p>
            <p className="text-accent text-[1.65rem] font-semibold leading-tight break-words">{current.name}</p>
            {current.detail && <p className="text-soft text-[13px] leading-snug mt-0.5 truncate">{current.detail}</p>}
          </div>
        )}
        {next && (
          <p className={`text-soft text-[13px] leading-snug truncate ${current ? "mt-2" : "mt-3"}`}>
            {tr("Sigue")}: <span className="text-ink">{next.name}</span>{next.detail && <span className="text-muted"> · {next.detail}</span>}
          </p>
        )}

        {/* La lista completa no va aquí: se ve en la rutina o en el reloj grande */}
        <div className="flex gap-2 mt-3">
          <button onClick={() => setIslandCompact(true)} className={chip}><ListChecks size={14} /> {tr("Ver rutina")}</button>
          <button onClick={() => openClock()} className={chip}><Clock size={14} /> {tr("Abrir reloj")}</button>
        </div>
      </div>
    </div>
  );
}
