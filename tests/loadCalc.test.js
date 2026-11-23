import { describe, it, expect } from "vitest";
import { cellKey, roundTo, fmtNum, rmOf, baseFor, planWeeks, loadFor, loadMapForWeek, pctFromRir } from "@/lib/loadCalc";

describe("cellKey", () => {
  it("compone la clave ejercicio:semana", () => {
    expect(cellKey("ex1", 3)).toBe("ex1:3");
  });
});

describe("roundTo", () => {
  it("redondea al paso indicado (por defecto 2.5)", () => {
    expect(roundTo(101)).toBe(100);
    expect(roundTo(102)).toBe(102.5);
    expect(roundTo(103, 5)).toBe(105);
  });
});

describe("fmtNum", () => {
  it("usa coma decimal y máximo un decimal", () => {
    expect(fmtNum(35.56)).toBe("35,6");
    expect(fmtNum(40)).toBe("40");
  });
  it("devuelve vacío para null", () => {
    expect(fmtNum(null)).toBe("");
  });
});

describe("rmOf (RM medido o estimado con Epley)", () => {
  it("devuelve el peso tal cual si no es serie de trabajo", () => {
    expect(rmOf({ weight_kg: 100, base_type: "max" })).toBe(100);
  });
  it("devuelve el peso si la serie de trabajo es de 1 rep", () => {
    expect(rmOf({ weight_kg: 100, base_type: "work", reps: 1 })).toBe(100);
  });
  it("estima con Epley para más de 1 rep", () => {
    expect(rmOf({ weight_kg: 100, base_type: "work", reps: 10 })).toBeCloseTo(133.33, 1);
  });
  it("devuelve null sin peso", () => {
    expect(rmOf({ weight_kg: null })).toBeNull();
    expect(rmOf(null)).toBeNull();
  });
});

describe("baseFor", () => {
  const loads = [
    { exercise_id: "e1", from_week: 1, weight_kg: 80 },
    { exercise_id: "e1", from_week: 5, weight_kg: 100 },
    { exercise_id: "e2", from_week: 1, weight_kg: 50 },
  ];
  it("toma la base vigente (from_week más alto que no pase la semana)", () => {
    expect(baseFor(loads, "e1", 3).weight_kg).toBe(80);
    expect(baseFor(loads, "e1", 6).weight_kg).toBe(100);
  });
  it("no mezcla ejercicios", () => {
    expect(baseFor(loads, "e2", 3).weight_kg).toBe(50);
  });
});

describe("planWeeks", () => {
  const phases = [{ weeks: 2, pct_start: 70, pct_end: 80, reps_start: "8", reps_end: "6", order_index: 0 }];

  it("reparte el porcentaje entre las semanas de la fase", () => {
    const weeks = planWeeks(phases, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].week).toBe(1);
    expect(weeks[0].pct).toBe(70);
    expect(weeks[1].pct).toBe(80);
    expect(weeks[0].reps).toBe("8");
    expect(weeks[1].reps).toBe("6");
  });

  it("una casilla editada a mano manda sobre el cálculo", () => {
    const weeks = planWeeks(phases, 2, { 1: { pct: "75" } });
    expect(weeks[0].pct).toBe(75);
    expect(weeks[0].pctEdited).toBe(true);
  });

  it("rellena semanas sin fase hasta el total", () => {
    const weeks = planWeeks(phases, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks[3].phase).toBeNull();
    expect(weeks[3].pctAuto).toBeNull();
  });
});

describe("modo solo series y reps", () => {
  const phases = [{ phase_type: "acumulacion", weeks: 2, order_index: 0, pct_start: 65, pct_end: 75, reps_start: "12", reps_end: "10", sets_start: 3, sets_end: 4 }];
  const weeks = planWeeks(phases, 2);
  const loads = [{ exercise_id: "plancha", from_week: 1, base_type: "reps", weight_kg: null }];

  it("sigue series y reps de la fase sin peso", () => {
    expect(baseFor(loads, "plancha", 1)).toBeTruthy();
    const w1 = loadFor({ weeks, loads, exerciseId: "plancha", week: 1 });
    expect(w1.kg).toBe(null);
    expect(w1.repsOnly).toBe(true);
    expect(w1.reps).toBe("12");
    expect(w1.sets).toBe(3);
    const w2 = loadFor({ weeks, loads, exerciseId: "plancha", week: 2 });
    expect(w2.reps).toBe("10");
    expect(w2.sets).toBe(4);
  });

  it("las reps y series escritas a mano mandan, y llegan al alumno", () => {
    const cells = { [cellKey("plancha", 2)]: { reps: "30 s", sets: "5" } };
    const w2 = loadFor({ weeks, loads, cells, exerciseId: "plancha", week: 2 });
    expect(w2.reps).toBe("30 s");
    expect(w2.sets).toBe(5);
    const map = loadMapForWeek({ phases, totalWeeks: 2, weekRows: [], loads, cellRows: [{ exercise_id: "plancha", week_index: 2, reps: "30 s", sets: 5 }], week: 2 });
    expect(map.plancha).toEqual({ value_type: "kg", value: null, reps: "30 s", sets: 5 });
  });

  it("reps por casilla también en ejercicios con peso", () => {
    const withKg = [{ exercise_id: "sq", from_week: 1, base_type: "rm", weight_kg: 100, rounding: 2.5 }];
    const cells = { [cellKey("sq", 1)]: { reps: "8" } };
    const r = loadFor({ weeks, loads: withKg, cells, exerciseId: "sq", week: 1 });
    expect(r.kg).toBe(65);
    expect(r.reps).toBe("8");
    expect(r.repsManual).toBe(true);
  });
});

describe("RIR (autorregulada)", () => {
  it("sin % en la fase, el % sale de reps + RIR", () => {
    const w = planWeeks([{ phase_type: "acumulacion", weeks: 2, reps_start: "10", reps_end: "10", rir_start: 2, rir_end: 2 }], 2);
    expect(w[0].rir).toBe(2);
    expect(w[0].pct).toBe(pctFromRir("10", 2));
    expect(w[0].pct).toBe(71.5);
  });
  it("cambiar el RIR de una semana recalcula su %", () => {
    const w = planWeeks([{ phase_type: "acumulacion", weeks: 1, reps_start: "10", rir_start: 2 }], 1, { 1: { rir: 0 } });
    expect(w[0].rir).toBe(0);
    expect(w[0].pct).toBe(pctFromRir("10", 0));
  });
  it("base por esfuerzo sin RM: usa la última sesión registrada", () => {
    const weeks = planWeeks([{ phase_type: "acumulacion", weeks: 2, reps_start: "10", rir_start: 2 }], 2);
    const loads = [{ exercise_id: "e", from_week: 1, base_type: "rir", weight_kg: 40, rounding: 2.5 }];
    // Sin registro: el peso de partida
    expect(loadFor({ weeks, loads, exerciseId: "e", week: 1, startDate: "2026-11-02" }).kg).toBe(40);
    // Con registro: 50 kg × 10 dejando 2 → RM ~ 70 → 71,5 % ≈ 50
    const history = { e: [{ date: "2026-11-03", weight: 50, reps: 10, rir: 2 }] };
    const r = loadFor({ weeks, loads, exerciseId: "e", week: 2, startDate: "2026-11-02", history });
    expect(r.kg).toBe(50);
    expect(r.rir).toBe(2);
  });
});

describe("progresión doble", () => {
  const weeks = planWeeks([{ phase_type: "otro", weeks: 4, sets_start: 3, sets_end: 3 }], 4);
  const loads = [{ exercise_id: "e", from_week: 1, base_type: "double", weight_kg: 20, rep_min: 8, rep_max: 12, rounding: 2.5 }];
  it("sin registro queda el peso inicial y las reps son el rango", () => {
    const r = loadFor({ weeks, loads, exerciseId: "e", week: 1, startDate: "2026-11-02" });
    expect(r.kg).toBe(20);
    expect(r.reps).toBe("8-12");
  });
  it("sube cuando hace el tope en todas las series", () => {
    const history = { e: [
      { date: "2026-11-03", weight: 20, reps: 12 }, { date: "2026-11-03", weight: 20, reps: 12 }, { date: "2026-11-03", weight: 20, reps: 11 },
      { date: "2026-11-05", weight: 20, reps: 12 }, { date: "2026-11-05", weight: 20, reps: 12 }, { date: "2026-11-05", weight: 20, reps: 12 },
    ] };
    expect(loadFor({ weeks, loads, exerciseId: "e", week: 2, startDate: "2026-11-02", history }).kg).toBe(22.5);
    // Un día antes del 5 todavía no había subido
    expect(loadFor({ weeks, loads, exerciseId: "e", week: 1, startDate: "2026-11-02", history, date: "2026-11-05" }).kg).toBe(20);
  });
  it("usa el incremento propio si lo tiene", () => {
    const own = [{ ...loads[0], increment: 5 }];
    const history = { e: [1, 2, 3].map(() => ({ date: "2026-11-03", weight: 20, reps: 12 })) };
    expect(loadFor({ weeks, loads: own, exerciseId: "e", week: 2, startDate: "2026-11-02", history }).kg).toBe(25);
  });
});

describe("ondulante diaria", () => {
  const weeks = planWeeks([{ phase_type: "progresion", weeks: 1, pct_start: 75, sets_start: 4, sets_end: 4 }], 1);
  const loads = [{ exercise_id: "e", from_week: 1, base_type: "rm", weight_kg: 100, rounding: 2.5 }];
  it("cada objetivo ajusta %, reps y series", () => {
    const f = loadFor({ weeks, loads, exerciseId: "e", week: 1, goal: "fuerza" });
    expect(f.kg).toBe(82.5);
    expect(f.reps).toBe("4-6");
    expect(f.sets).toBe(5);
    const r = loadFor({ weeks, loads, exerciseId: "e", week: 1, goal: "resistencia" });
    expect(r.kg).toBe(62.5);
    expect(r.sets).toBe(3);
  });
  it("sin objetivo queda la semana tal cual", () => {
    expect(loadFor({ weeks, loads, exerciseId: "e", week: 1 }).kg).toBe(75);
  });
});
