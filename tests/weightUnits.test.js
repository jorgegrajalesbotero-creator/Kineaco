import { describe, it, expect } from "vitest";
import { formatWeight, fromKg, kgToText, textToKg, toKg } from "@/lib/weightUnits";

describe("toKg / fromKg", () => {
  it("en kg no cambia el valor", () => {
    expect(toKg("20", "kg")).toBe(20);
    expect(fromKg(20, "kg")).toBe(20);
    expect(toKg("35,5", "kg")).toBe(35.5);
  });
  it("convierte libras a kilogramos", () => {
    expect(toKg("45", "lb")).toBe(20.412);
    expect(toKg("100", "lb")).toBe(45.359);
  });
  it("convierte kilogramos a libras", () => {
    expect(fromKg(20, "lb")).toBe(44.09);
    expect(fromKg("100", "lb")).toBe(220.46);
  });
  it("devuelve null si está vacío o no es un número", () => {
    expect(toKg("", "lb")).toBeNull();
    expect(toKg(null, "kg")).toBeNull();
    expect(toKg("abc", "lb")).toBeNull();
    expect(fromKg(undefined, "lb")).toBeNull();
  });
});

describe("ida y vuelta en libras", () => {
  it("un peso escrito en lb vuelve a mostrarse igual", () => {
    for (const lb of ["2.5", "5", "12.5", "45", "135", "225", "17.25", "402.5"]) {
      expect(kgToText(textToKg(lb, "lb"), "lb")).toBe(lb);
    }
  });
});

describe("textos", () => {
  it("textToKg entrega kg como texto, o vacío", () => {
    expect(textToKg("45", "lb")).toBe("20.412");
    expect(textToKg("20.", "kg")).toBe("20");
    expect(textToKg("", "lb")).toBe("");
  });
  it("formatWeight incluye la unidad", () => {
    expect(formatWeight(20, "kg")).toBe("20 kg");
    expect(formatWeight("20.412", "lb")).toBe("45 lb");
    expect(formatWeight(null, "lb")).toBe("");
    expect(formatWeight("", "kg")).toBe("");
  });
});

import { roundWeight, roundingStep, weightLabel, weightNumber, weightStep } from "@/lib/weightUnits";
import { loadFor, planWeeks } from "@/lib/loadCalc";
import { nextGoal } from "@/lib/exerciseHistory";

describe("mostrar pesos", () => {
  it("weightNumber y weightLabel usan 1 decimal", () => {
    expect(weightNumber(64.52, "kg")).toBe("64.5");
    expect(weightNumber(64.5, "lb")).toBe("142.2");
    expect(weightLabel(70, "lb")).toBe("154.3 lb");
    expect(weightLabel(null, "kg")).toBe("");
  });
  it("convierte diferencias negativas", () => {
    expect(weightNumber(-1.5, "lb")).toBe("-3.3");
  });
});

describe("cálculo en la unidad elegida", () => {
  it("los saltos cambian con la unidad", () => {
    expect(weightStep("kg")).toBe(2.5);
    expect(weightStep("lb")).toBe(5);
    expect(roundingStep(2.5, "lb")).toBe(5);
    expect(roundingStep(1, "lb")).toBe(2.5);
    expect(roundingStep(1, "kg")).toBe(1);
  });
  it("roundWeight redondea en kg o en lb y devuelve kg", () => {
    expect(roundWeight(61, 2.5, "kg")).toBe(60);
    // 61 kg = 134,48 lb → 135 lb → 61,235 kg
    expect(roundWeight(61, 2.5, "lb")).toBe(61.235);
  });
  it("loadFor: en kg sale redondo en kg y en lb sale redondo en lb", () => {
    const weeks = planWeeks([{ weeks: 1, pct_start: 70, order_index: 0 }], 1);
    const loads = [{ exercise_id: "a", from_week: 1, base_type: "rm", weight_kg: 100, rounding: 2.5 }];
    expect(loadFor({ weeks, loads, exerciseId: "a", week: 1 }).kg).toBe(70);
    // 70 kg = 154,32 lb → 155 lb
    const lb = loadFor({ weeks, loads, exerciseId: "a", week: 1, unit: "lb" }).kg;
    expect(Math.round((lb / 0.45359237) * 100) / 100).toBe(155);
  });
  it("nextGoal sube 2,5 kg o 5 lb", () => {
    expect(nextGoal(60)).toBe(62.5);
    expect(nextGoal(135, "lb")).toBe(140);
    expect(nextGoal(20, "lb")).toBe(22.5);
  });
});
