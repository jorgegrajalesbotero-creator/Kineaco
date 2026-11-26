import { describe, expect, it } from "vitest";
import { addDaysISO, canEditInPlace, movedOrder, planTargetWeeks, splitExtra } from "@/lib/previewEdits";

describe("planTargetWeeks", () => {
  it("solo esta semana", () => expect(planTargetWeeks(3, 6, "week")).toEqual([3]));
  it("desde esta semana hasta el final", () => expect(planTargetWeeks(3, 6, "from")).toEqual([3, 4, 5, 6]));
  it("última semana", () => expect(planTargetWeeks(6, 6, "from")).toEqual([6]));
});

describe("canEditInPlace", () => {
  const schedule = {
    plans: [{ id: "p1", training_plan_days: [
      { routine_id: "r1", day_label: "Lunes", week_index: 3 },
      { routine_id: "r1", day_label: "Lunes", week_index: 4 },
      { routine_id: "r2", day_label: "Martes", week_index: 3 },
    ] }],
    fixed: [{ routine_id: "r9" }],
    extras: [{ routine_id: "r8" }],
  };
  it("se usa solo en las semanas que cambian", () => {
    expect(canEditInPlace("r1", schedule, "p1", "Lunes", [3, 4, 5])).toBe(true);
  });
  it("se usa en otra semana: hay que copiar", () => {
    expect(canEditInPlace("r1", schedule, "p1", "Lunes", [3])).toBe(false);
  });
  it("otro día o en la semana base o en un extra: hay que copiar", () => {
    expect(canEditInPlace("r2", schedule, "p1", "Lunes", [3])).toBe(false);
    expect(canEditInPlace("r9", schedule, "p1", "Lunes", [3])).toBe(false);
    expect(canEditInPlace("r8", schedule, "p1", "Lunes", [3])).toBe(false);
  });
});

describe("splitExtra", () => {
  const extra = { start_date: "2026-11-02", end_date: "2026-11-29", days: ["Lunes", "Miércoles"] };
  it("solo esta semana: antes igual, esta semana sin el día, después igual", () => {
    expect(splitExtra(extra, "2026-11-16", "Miércoles", "week")).toEqual([
      { start_date: "2026-11-02", end_date: "2026-11-15", days: ["Lunes", "Miércoles"] },
      { start_date: "2026-11-16", end_date: "2026-11-22", days: ["Lunes"] },
      { start_date: "2026-11-23", end_date: "2026-11-29", days: ["Lunes", "Miércoles"] },
    ]);
  });
  it("desde esta semana", () => {
    expect(splitExtra(extra, "2026-11-16", "Miércoles", "from")).toEqual([
      { start_date: "2026-11-02", end_date: "2026-11-15", days: ["Lunes", "Miércoles"] },
      { start_date: "2026-11-16", end_date: "2026-11-29", days: ["Lunes"] },
    ]);
  });
  it("un solo día y una sola semana: no queda nada", () => {
    expect(splitExtra({ start_date: "2026-11-16", end_date: "2026-11-22", days: ["Lunes"] }, "2026-11-16", "Lunes", "week")).toEqual([]);
  });
});

describe("addDaysISO y movedOrder", () => {
  it("cruza de mes", () => expect(addDaysISO("2026-11-30", 1)).toBe("2026-12-01"));
  it("hacia atrás", () => expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28"));
  it("mueve un bloque", () => expect(movedOrder([0, 1, 2, 3], 3, 1)).toEqual([0, 3, 1, 2]));
});
