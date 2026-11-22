import { describe, it, expect } from "vitest";
import { planBlockMarks, setsFromClock } from "@/lib/clockProgress";

// Ejercicio "por serie" (el alumno marca serie a serie)
const porSerie = (n, setsCount = 3) => ({
  name: `Ejercicio ${n}`,
  exerciseId: `ex-${n}`,
  itemKey: `item-${n}`,
  routineId: "rut-1",
  setsCount,
  byItem: true,
  targetWeight: 20,
  targetReps: "12 reps",
});

// Ejercicio de un bloque de intermitentes: sin series, se marca entero
const suelto = (n) => ({ name: `Intermitente ${n}`, exerciseId: `ex-${n}`, itemKey: `item-${n}`, routineId: "rut-1", setsCount: 0, byItem: true });

describe("setsFromClock", () => {
  it("el Tabata da por hechas las series que corrió", () => {
    expect(setsFromClock("tabata", { sets: 4 })).toEqual({ sets: 4, allSets: false });
    expect(setsFromClock("intervals", { sets: 2 })).toEqual({ sets: 2, allSets: false });
    expect(setsFromClock("tabata", {})).toEqual({ sets: 1, allSets: false });
  });
  it("el AMRAP da el ejercicio por terminado", () => {
    expect(setsFromClock("amrap", { minutes: 12 })).toEqual({ sets: 1, allSets: true });
  });
});

describe("planBlockMarks", () => {
  it("marca una serie de cada ejercicio por cada serie del reloj", () => {
    const { setRows, doneRows } = planBlockMarks([porSerie(1), porSerie(2)], { sets: 2 });
    expect(setRows.map((r) => `${r.ex.itemKey}#${r.setNumber}`)).toEqual(["item-1#1", "item-1#2", "item-2#1", "item-2#2"]);
    expect(doneRows).toHaveLength(0); // les faltaba la tercera serie
  });

  it("al completar todas las series también da el ejercicio por terminado", () => {
    const { setRows, doneRows } = planBlockMarks([porSerie(1)], { sets: 3 });
    expect(setRows).toHaveLength(3);
    expect(doneRows.map((r) => r.ex.itemKey)).toEqual(["item-1"]);
  });

  it("nunca repite lo que el alumno ya marcó a mano", () => {
    const { setRows, doneRows } = planBlockMarks([porSerie(1)], { sets: 3, doneSets: { "rut-1|item-1": [1, 2] } });
    expect(setRows.map((r) => r.setNumber)).toEqual([3]); // solo faltaba la tercera
    expect(doneRows).toHaveLength(1);
  });

  it("no vuelve a dar por terminado lo que ya estaba terminado", () => {
    const { setRows, doneRows } = planBlockMarks([porSerie(1)], {
      sets: 3,
      doneSets: { "rut-1|item-1": [1, 2, 3] },
      doneDone: new Set(["rut-1|item-1"]),
    });
    expect(setRows).toHaveLength(0);
    expect(doneRows).toHaveLength(0);
  });

  it("nunca marca más series de las que tiene el ejercicio", () => {
    const { setRows } = planBlockMarks([porSerie(1, 2)], { sets: 8 });
    expect(setRows.map((r) => r.setNumber)).toEqual([1, 2]);
  });

  it("los ejercicios sin series (intermitentes) se marcan enteros", () => {
    const { setRows, doneRows } = planBlockMarks([suelto(1), suelto(2)], { sets: 4 });
    expect(setRows).toHaveLength(0);
    expect(doneRows.map((r) => r.ex.itemKey)).toEqual(["item-1", "item-2"]);
  });

  it("el AMRAP completa todas las series del ejercicio", () => {
    const { setRows, doneRows } = planBlockMarks([porSerie(1)], { sets: 1, allSets: true });
    expect(setRows.map((r) => r.setNumber)).toEqual([1, 2, 3]);
    expect(doneRows).toHaveLength(1);
  });

  it("el reloj suelto, sin ejercicios identificados, no marca nada", () => {
    expect(planBlockMarks([{ name: "Sentadilla" }], { sets: 4 })).toEqual({ setRows: [], doneRows: [] });
    expect(planBlockMarks([], { sets: 4 })).toEqual({ setRows: [], doneRows: [] });
    expect(planBlockMarks(undefined, {})).toEqual({ setRows: [], doneRows: [] });
  });
});

// ---- Marcado ejercicio por ejercicio mientras corre el Tabata ----
import { exerciseMarks, planExerciseMarks } from "@/lib/clockProgress";
import { buildPhases, stateAt } from "@/lib/clock";

describe("exerciseMarks", () => {
  // 3 ejercicios, 6 ciclos (cada uno 2 veces por serie), 2 series, sin preparación
  const cfg = { prep: 0, work: 20, rest: 10, rounds: 6, sets: 2, setRest: 60, cooldown: 0 };
  const phases = buildPhases("tabata", cfg);
  const ex = [porSerie(1, 2), porSerie(2, 2), porSerie(3, 2)];
  const marcas = (seg) => exerciseMarks(phases, stateAt(phases, seg * 1000), ex);

  it("al empezar no hay nada hecho", () => {
    expect(marcas(1).map((m) => m.setsDone)).toEqual([0, 0, 0]);
  });

  it("un ejercicio queda hecho en la serie apenas termina sus dos turnos, sin esperar a los demás", () => {
    // Ciclos 1-4 terminados (4 × 30 s = 120 s): el 1 ya hizo sus dos turnos (ciclos 1 y 4)
    const m = marcas(121);
    expect(m[0]).toEqual({ setsDone: 1, allDone: false });
    expect(m[1].setsDone).toBe(0); // le falta el ciclo 5
    expect(m[2].setsDone).toBe(0);
  });

  it("al terminar todo, cada ejercicio queda completo en todas las series", () => {
    expect(marcas(100000)).toEqual([
      { setsDone: 2, allDone: true },
      { setsDone: 2, allDone: true },
      { setsDone: 2, allDone: true },
    ]);
  });

  it("planExerciseMarks marca la serie del ejercicio terminado y no repite lo ya guardado", () => {
    const m = marcas(121);
    const { setRows, doneRows } = planExerciseMarks(ex, m);
    expect(setRows.map((r) => `${r.ex.itemKey}#${r.setNumber}`)).toEqual(["item-1#1"]);
    expect(doneRows).toHaveLength(0);
    const otraVez = planExerciseMarks(ex, m, { doneSets: { "rut-1|item-1": [1] } });
    expect(otraVez.setRows).toHaveLength(0);
  });

  it("un ejercicio sin series se da por hecho solo cuando terminó en todas las series", () => {
    const sueltos = [suelto(1), suelto(2), suelto(3)];
    expect(planExerciseMarks(sueltos, exerciseMarks(phases, stateAt(phases, 121000), sueltos)).doneRows).toHaveLength(0);
    const fin = planExerciseMarks(sueltos, exerciseMarks(phases, stateAt(phases, 100000000), sueltos));
    expect(fin.doneRows.map((r) => r.ex.itemKey)).toEqual(["item-1", "item-2", "item-3"]);
  });
});
