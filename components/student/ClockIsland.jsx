"use client";

import { useEffect, useRef, useState } from "react";
import { BellOff, Check, ChevronDown, ChevronUp, Maximize2, Pause, Play, SkipForward } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { tr } from "@/lib/i18n";
import { beep, vibrate } from "@/lib/alarm";
import { clockCardText, clockExerciseProgress, clockExercises, formatClock, stateAt } from "@/lib/clock";
import { markBlockDone } from "@/lib/clockProgress";
import { hideNowPlaying, updateClockPosition, updateNowPlaying } from "@/lib/clockMedia";
import { drawCard } from "@/lib/clockArtwork";
import { REFRESCO_MS, hideClockNotification, showClockNotification } from "@/lib/clockNotification";
import { clockPhases, elapsedMs, endAt, getClock, isRunning, openClock, pauseClock, resumeClock, ringAlarm, setIslandCompact, skipPhase, stopAlarm, useClock } from "@/lib/clockStore";
import { WorkoutClock } from "@/components/student/WorkoutClock";

// Hora actual (fuera de los componentes: solo se usa en efectos)
const nowMs = () => Date.now();

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
    const texto = clockCardText({ mode: s.mode, phases, st, exercises: s.exercises, tr });
    const clave = `${texto.phase}|${texto.cycle}|${texto.set}|${texto.title}`;
    const poner = (artwork) => {
      if (artwork) cardUrl.current = artwork;
      updateNowPlaying({ ...texto, artwork: artwork || cardUrl.current, onPlay: resumeClock, onPause: pauseClock });
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
        onReady: poner, // la imagen tarda un instante en estar lista
      });
      poner(dibujada);
    } else {
      poner(cardUrl.current);
    }
  }, [tick, s]);

  // Ficha en el panel de notificaciones, con forma de cronómetro (no de reproductor).
  // Se refresca cada dos segundos y en silencio; es la única forma, desde la web, de que la
  // ficha NO tenga el marco del reproductor de música que impone el celular.
  useEffect(() => {
    if (!s.run) {
      hideClockNotification();
      return undefined;
    }
    const pintar = () => {
      const phases = clockPhases(s);
      const st = s.mode === "stopwatch" ? null : stateAt(phases, elapsedMs(s, nowMs()));
      if (st?.done) {
        showClockNotification({ title: tr("¡Terminado!"), body: tr(MODE_LABELS[s.mode]) });
        return;
      }
      const tiempo = st ? formatClock(st.remaining) : formatClock(elapsedMs(s, nowMs()) / 1000);
      const texto = clockCardText({ mode: s.mode, phases, st, exercises: s.exercises, tr });
      const pausa = s.run.pausedAt ? ` · ${tr("En pausa")}` : "";
      showClockNotification({
        title: `${tiempo} · ${texto.artist || texto.title}${pausa}`,
        body: [texto.title !== texto.artist ? texto.title : "", texto.album].filter(Boolean).join(" · "),
      });
    };
    pintar();
    const id = setInterval(pintar, REFRESCO_MS);
    return () => clearInterval(id);
  }, [s]);

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
              className="-mr-2.5 w-7 h-7 rounded-full bg-white/[0.12] flex items-center justify-center text-soft"
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
  // Botón redondo translúcido, como los de las tarjetas del sistema
  const ctrl = "w-9 h-9 rounded-full bg-white/[0.12] flex items-center justify-center text-ink active:scale-90 transition-transform";
  const RING = 29;
  const RING_C = 2 * Math.PI * RING;

  return (
    <div className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none top-[calc(env(safe-area-inset-top)+0.5rem)] md:top-4 px-3">
      <div className="pointer-events-auto w-full max-w-md rounded-[28px] bg-black/75 backdrop-blur-2xl border border-white/[0.07] shadow-[0_20px_50px_-12px_rgb(0_0_0/0.9)] px-5 pt-4 pb-4 animate-fade-in">
        {/* Fase, con su punto de color, y las acciones de la tarjeta */}
        <div className="flex items-center gap-2">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
          <span className={`text-[13px] font-medium ${textColor}`}>{paused ? tr("En pausa") : label}</span>
          <span className="flex-1" />
          <button onClick={() => openClock()} aria-label={tr("Abrir el reloj completo")} className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-soft active:scale-90 transition-transform"><Maximize2 size={14} /></button>
          <button onClick={() => setIslandCompact(true)} aria-label={tr("Achicar")} className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-soft active:scale-90 transition-transform"><ChevronUp size={16} /></button>
        </div>

        {/* El tiempo manda; a su derecha el anillo que lo acompaña, con la pausa dentro */}
        <div className="flex items-end gap-3 mt-2">
          <div className="flex-1 min-w-0">
            <p className="font-rounded text-ink text-[3.5rem] font-semibold leading-[1.02] tracking-[-0.035em]">
              {st.done ? "0:00" : formatClock(st.remaining)}
            </p>
            {counter && <p className="text-soft text-[13px] leading-tight mt-1 truncate">{counter}</p>}
          </div>

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

        {hasExercises && (current || next) && (
          <div className="mt-3">
            {current && (
              <p className="text-ink text-[17px] font-semibold leading-snug truncate">
                {current.name}{current.detail && <span className="text-soft text-[13px] font-normal"> · {current.detail}</span>}
              </p>
            )}
            {next && (
              <p className="text-soft text-[13px] leading-snug truncate mt-0.5">
                {tr("Sigue")}: {next.name}{next.detail && <span className="text-muted"> · {next.detail}</span>}
              </p>
            )}
          </div>
        )}

        {/* Tabata: la lista completa, contando y tachando lo que ya hizo en esta serie */}
        {progress && (
          <ol className="mt-3 pt-3 border-t border-white/[0.06] max-h-[8.5rem] overflow-y-auto overscroll-contain space-y-1">
            {progress.items.map((e, i) => (
              <li
                key={i}
                aria-label={tr("{p0}: {p1} de {p2} veces", { p0: e.name, p1: e.done, p2: e.total })}
                className={`flex items-baseline gap-2.5 text-[13px] leading-snug ${e.current ? "text-accent font-semibold" : e.complete ? "text-muted" : "text-soft"}`}
              >
                <span className="text-muted w-3 shrink-0 tabular-nums">{i + 1}</span>
                <span className={`flex-1 min-w-0 truncate ${e.complete ? "line-through" : ""}`}>{e.name}</span>
                <span className="shrink-0 flex items-center gap-1 tabular-nums" aria-hidden="true">
                  {e.done}/{e.total}
                  <Check size={12} strokeWidth={3} className={e.complete ? "text-accent" : "text-transparent"} />
                </span>
              </li>
            ))}
          </ol>
        )}

        {isAmrap && hasExercises && !st.done && (
          <ol className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
            {s.exercises.map((e, i) => (
              <li key={i} className="text-soft text-[13px] leading-snug flex gap-2.5">
                <span className="text-muted w-3 shrink-0 tabular-nums">{i + 1}</span>
                <span className="min-w-0 truncate">{e.name}{e.detail && <span className="text-muted"> · {e.detail}</span>}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
