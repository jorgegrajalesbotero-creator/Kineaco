import { describe, it, expect } from "vitest";
import { PLAN_MODELS, defaultDayGoals, modelPhases, planModel } from "@/lib/planModels";
import { planWeeks } from "@/lib/loadCalc";

describe("tipos de planeación", () => {
  it("todos tienen fases de partida que dan semanas con datos", () => {
    PLAN_MODELS.forEach((m) => {
      const phases = modelPhases(m.key);
      expect(phases.length).toBeGreaterThan(0);
      const weeks = planWeeks(phases, 0);
      expect(weeks.length).toBeGreaterThan(0);
    });
  });
  it("la lineal sube el % y la inversa lo baja", () => {
    const up = planWeeks(modelPhases("lineal"), 0).filter((w) => w.phase.phase_type !== "descarga");
    expect(up[up.length - 1].pct).toBeGreaterThan(up[0].pct);
    const down = planWeeks(modelPhases("lineal_inversa"), 0);
    expect(down[down.length - 1].pct).toBeLessThan(down[0].pct);
  });
  it("la ondulante semanal alterna fuerza, hipertrofia y resistencia y sube cada vuelta", () => {
    const w = planWeeks(modelPhases("ondulante_semanal", { cycles: 2 }), 0);
    expect(w.map((x) => x.phase.phase_type)).toEqual(["fuerza", "hipertrofia", "resistencia", "fuerza", "hipertrofia", "resistencia"]);
    expect(w[3].pct).toBe(82.5);
  });
  it("la autorregulada saca el % del RIR", () => {
    const w = planWeeks(modelPhases("rir"), 0);
    expect(w[0].rir).toBe(3);
    expect(w[0].pct).not.toBeNull();
  });
  it("tipo desconocido = ATR", () => {
    expect(planModel("xx").key).toBe("atr");
  });
  it("objetivos de partida por día", () => {
    expect(defaultDayGoals(["Lunes", "Miércoles", "Viernes"])).toEqual({ Lunes: "fuerza", "Miércoles": "hipertrofia", Viernes: "resistencia" });
  });
});
