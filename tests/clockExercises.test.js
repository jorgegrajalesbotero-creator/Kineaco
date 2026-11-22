import { describe, it, expect } from "vitest";
import { buildPhases, canonicalMode, clockExerciseProgress, clockExercises, normalizeTimer, stateAt, timerLabel, visibleFields } from "@/lib/clock";

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

// Cuenta por serie: cuántas veces va cada ejercicio y cuáles ya terminó
describe("clockExerciseProgress", () => {
  // 8 ciclos y 3 ejercicios: al primero y al segundo les tocan 3 veces, al tercero 2
  const phases = buildPhases("tabata", { prep: 10, work: 20, rest: 10, rounds: 8 });
  const at = (ms) => clockExerciseProgress("tabata", phases, stateAt(phases, ms), ex);

  it("sin iniciar: nadie lleva nada, pero ya se sabe cuántas le tocan a cada uno", () => {
    const p = clockExerciseProgress("tabata", phases, null, ex);
    expect(p.set).toBe(1);
    expect(p.sets).toBe(1);
    expect(p.done).toBe(0);
    expect(p.total).toBe(8);
    expect(p.items.map((i) => i.total)).toEqual([3, 3, 2]);
    expect(p.items.every((i) => i.done === 0 && !i.current && !i.complete)).toBe(true);
  });

  it("los ciclos que no se reparten parejos se cuentan tal como caen", () => {
    expect(at(0).items.map((i) => `${i.done}/${i.total}`)).toEqual(["0/3", "0/3", "0/2"]);
  });

  it("en el primer ciclo de trabajo marca el ejercicio actual", () => {
    const p = at(12000); // preparación 10 s + 2 s del ciclo 1
    expect(p.items[0]).toMatchObject({ name: "Burpees", done: 0, total: 3, current: true });
    expect(p.items[1].current).toBe(false);
  });

  it("va contando los ciclos ya hechos", () => {
    // prep 10 + (20+10) × 3 = 100 s → va en el ciclo 4, otra vez Burpees
    const p = at(101000);
    expect(p.done).toBe(3);
    expect(p.items.map((i) => i.done)).toEqual([1, 1, 1]);
    expect(p.items[0].current).toBe(true);
  });

  it("tacha el ejercicio cuando ya hizo todas sus veces de la serie", () => {
    const p = at(200000); // dentro del ciclo 7, el tercero de Burpees
    expect(p.items[0]).toMatchObject({ done: 2, total: 3, current: true });
    const fin = at(225000); // ciclo 8: Burpees ya hizo sus 3
    expect(fin.items[0]).toMatchObject({ done: 3, total: 3, complete: true });
    expect(fin.items[1].complete).toBe(false);
  });

  it("al terminar, todos quedan completos", () => {
    const p = at(10_000_000);
    expect(p.items.every((i) => i.complete)).toBe(true);
    expect(p.done).toBe(p.total);
    expect(p.items.some((i) => i.current)).toBe(false);
  });

  it("la cuenta se reinicia en cada serie", () => {
    const dos = buildPhases("tabata", { prep: 10, work: 20, rest: 10, rounds: 4, sets: 2, setRest: 60 });
    const pos = (ms) => clockExerciseProgress("tabata", dos, stateAt(dos, ms), ex);
    const serie1 = pos(110000); // último ciclo de la serie 1
    expect(serie1.set).toBe(1);
    expect(serie1.items.map((i) => i.done)).toEqual([1, 1, 1]);
    const serie2 = pos(185000); // ya en la serie 2
    expect(serie2.set).toBe(2);
    expect(serie2.sets).toBe(2);
    expect(serie2.items.map((i) => i.done)).toEqual([0, 0, 0]);
    expect(serie2.items[0].current).toBe(true);
  });

  it("en el descanso entre series se ve la serie que acaba de terminar, completa", () => {
    const dos = buildPhases("tabata", { prep: 10, work: 20, rest: 10, rounds: 3, sets: 2, setRest: 60 });
    const p = clockExerciseProgress("tabata", dos, stateAt(dos, 105000), ex);
    expect(p.set).toBe(1);
    expect(p.items.every((i) => i.complete)).toBe(true);
  });

  it("no aplica en AMRAP ni sin ejercicios", () => {
    expect(clockExerciseProgress("amrap", buildPhases("amrap", { minutes: 10 }), null, ex)).toBeNull();
    expect(clockExerciseProgress("tabata", phases, null, [])).toBeNull();
  });
});
