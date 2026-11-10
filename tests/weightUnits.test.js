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
