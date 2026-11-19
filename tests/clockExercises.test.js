import { describe, it, expect } from "vitest";
import { buildPhases, canonicalMode, clockExercises, normalizeTimer, stateAt, timerLabel, visibleFields } from "@/lib/clock";

const ex = [{ name: "Burpees" }, { name: "Sentadilla" }, { name: "Plancha" }];

describe("un solo Tabata", () => {
  it("los relojes viejos de intervalos se leen como Tabata", () => {
    expect(canonicalMode("intervals")).toBe("tabata");
    const t = normalizeTimer({ mode: "intervals", work: 40, rest: 20, rounds: 10 });
    expect(t).toMatchObject({ mode: "tabata", work: 40, rest: 20, rounds: 10 });
    expect(timerLabel(t)).toContain("Tabata 0:40 / 0:20 × 10");
  });
  it("el descanso entre series siempre se ve para programarlo", () => {
    expect(visibleFields("tabata", { sets: 1 }).map((f) => f.key)).toContain("setRest");
  });
});

describe("clockExercises", () => {
  const phases = buildPhases("tabata", { prep: 10, work: 20, rest: 10, rounds: 4 });
  it("antes de iniciar dice cuál es el primero", () => {
    expect(clockExercises("tabata", phases, null, ex)).toEqual({ current: null, next: ex[0] });
  });
  it("en la preparación: sigue el primero", () => {
    expect(clockExercises("tabata", phases, stateAt(phases, 2000), ex)).toEqual({ current: null, next: ex[0] });
  });
  it("en el trabajo: ahora y sigue", () => {
    expect(clockExercises("tabata", phases, stateAt(phases, 12000), ex)).toEqual({ current: ex[0], next: ex[1] });
  });
  it("en el descanso: dice el siguiente", () => {
    expect(clockExercises("tabata", phases, stateAt(phases, 32000), ex)).toEqual({ current: null, next: ex[1] });
  });
  it("vuelve a empezar la lista cuando hay más ciclos que ejercicios", () => {
    // ciclo 4 (trabajo desde 10 + 3·30 = 100 s) → 4º ciclo = 1er ejercicio
    expect(clockExercises("tabata", phases, stateAt(phases, 101000), ex).current).toBe(ex[0]);
  });
  it("AMRAP no marca ejercicio por ejercicio", () => {
    const p = buildPhases("amrap", { minutes: 5 });
    expect(clockExercises("amrap", p, stateAt(p, 20000), ex)).toEqual({ current: null, next: null });
  });
  it("sin ejercicios no dice nada", () => {
    expect(clockExercises("tabata", phases, stateAt(phases, 12000), [])).toEqual({ current: null, next: null });
  });
});
