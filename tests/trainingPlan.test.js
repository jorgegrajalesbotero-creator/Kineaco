import { describe, it, expect } from "vitest";
import { addDays, mondayOf, parseDate, planWeekOf, plansOverlap, currentOrNextPlan } from "@/lib/trainingPlan";

describe("addDays", () => {
  it("suma días sin mutar la fecha original", () => {
    const base = parseDate("2026-01-01");
    const plus5 = addDays(base, 5);
    expect(plus5.getDate()).toBe(6);
    expect(base.getDate()).toBe(1); // no mutada
  });
});

describe("mondayOf", () => {
  it("siempre cae en lunes (getDay() === 1)", () => {
    expect(mondayOf(parseDate("2026-01-07")).getDay()).toBe(1);
    expect(mondayOf(parseDate("2026-06-20")).getDay()).toBe(1);
  });
});

describe("planWeekOf", () => {
  const plan = { start_date: "2026-01-05", weeks: 4 };
  const start = parseDate("2026-01-05");

  it("la fecha de inicio es la semana 1 (regresión BUG planWeekOf: activa aunque el inicio no sea lunes)", () => {
    expect(planWeekOf(plan, start)).toBe(1);
  });
  it("7 días después es la semana 2", () => {
    expect(planWeekOf(plan, addDays(start, 7))).toBe(2);
  });
  it("devuelve null fuera del plan (antes del inicio o pasada la última semana)", () => {
    expect(planWeekOf(plan, addDays(start, -7))).toBeNull();
    expect(planWeekOf(plan, addDays(start, 28))).toBeNull(); // semana 5 > 4
  });
});

describe("plansOverlap", () => {
  const a = { start_date: "2026-01-05", weeks: 4 }; // cubre 28 días

  it("detecta planes que se solapan", () => {
    expect(plansOverlap(a, { start_date: "2026-01-20", weeks: 4 })).toBe(true);
  });
  it("no marca solape cuando van seguidos sin cruzarse", () => {
    expect(plansOverlap(a, { start_date: "2026-03-05", weeks: 4 })).toBe(false);
  });
});

describe("currentOrNextPlan", () => {
  it("si ninguno está activo hoy, devuelve el próximo que empieza", () => {
    const plans = [
      { start_date: "2099-03-05", weeks: 4 },
      { start_date: "2099-01-05", weeks: 4 },
    ];
    expect(currentOrNextPlan(plans).start_date).toBe("2099-01-05");
  });
});
