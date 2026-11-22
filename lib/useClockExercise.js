"use client";

// Qué ejercicio de la rutina está haciendo el alumno según el Tabata que corre, para
// resaltarlo en la lista. Devuelve la clave "rutina|item" del ejercicio, o null.
// Solo vuelve a dibujar la rutina cuando cambia el ejercicio (no a cada segundo).
import { useEffect, useState } from "react";
import { clockExercises, stateAt } from "@/lib/clock";
import { clockPhases, elapsedMs, getClock, useClock } from "@/lib/clockStore";

export function clockExerciseKey(s, dayLabel, now = Date.now()) {
  if (!s?.run || s.mode !== "tabata" || !s.fromRoutine || !dayLabel || s.dayLabel !== dayLabel) return null;
  const phases = clockPhases(s);
  const { current } = clockExercises(s.mode, phases, stateAt(phases, elapsedMs(s, now)), s.exercises);
  if (!current || !current.routineId) return null;
  return `${current.routineId}|${current.itemKey ?? current.exerciseId}`;
}

export function useClockExercise(dayLabel) {
  const s = useClock();
  const [key, setKey] = useState(null);
  const activo = !!s.run && s.mode === "tabata" && s.fromRoutine && s.dayLabel === dayLabel;
  useEffect(() => {
    const leer = () => setKey(clockExerciseKey(getClock(), dayLabel));
    leer();
    if (!activo) return undefined;
    const id = setInterval(leer, 500);
    return () => clearInterval(id);
  }, [activo, dayLabel, s.run?.id, s.run?.pausedAt]);
  return activo ? key : null;
}
