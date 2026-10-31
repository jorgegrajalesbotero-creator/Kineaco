import { describe, it, expect } from "vitest";
import { cellKey, roundTo, fmtNum, rmOf, baseFor, planWeeks } from "@/lib/loadCalc";

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
