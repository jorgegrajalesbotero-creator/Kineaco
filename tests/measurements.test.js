import { describe, it, expect } from "vitest";
import { col, delta, navyBodyFat, bodyFatRanges, bodyFatPercentile, computeResults } from "@/lib/measurements";

describe("col (nombre de columna)", () => {
  it("añade el lado cuando lo hay", () => {
    expect(col("arm", "r")).toBe("arm_r_cm");
    expect(col("waist")).toBe("waist_cm");
  });
});

describe("delta (diferencia contra la medición anterior)", () => {
  it("resta columnas numéricas", () => {
    expect(delta({ waist_cm: "80" }, { waist_cm: "83" }, "waist_cm")).toBe(-3);
  });
  it("devuelve null si falta algún valor", () => {
    expect(delta({ waist_cm: "80" }, {}, "waist_cm")).toBeNull();
  });
});

describe("navyBodyFat", () => {
  it("devuelve null sin estatura o cuello", () => {
    expect(navyBodyFat({ sex: "hombre" })).toBeNull();
    expect(navyBodyFat({ sex: "hombre", height_cm: 180 })).toBeNull();
  });
  it("devuelve null para sexo no reconocido", () => {
    expect(navyBodyFat({ sex: "otro", height_cm: 180, neck_cm: 40, abdomen_cm: 90 })).toBeNull();
  });
  it("calcula un % plausible para un hombre", () => {
    const bf = navyBodyFat({ sex: "hombre", height_cm: 180, neck_cm: 40, abdomen_cm: 90 });
    expect(bf).toBeGreaterThan(10);
    expect(bf).toBeLessThan(30);
    expect(bf).toBeCloseTo(18.4, 0); // caracterización de la fórmula actual
  });
});

describe("bodyFatRanges (Gallagher)", () => {
  it("elige la franja por edad y sexo", () => {
    expect(bodyFatRanges("hombre", 30)).toEqual({ low: 8, healthy: 20, high: 25 });
    expect(bodyFatRanges("mujer", 45)).toEqual({ low: 23, healthy: 35, high: 40 });
  });
  it("devuelve null para sexo desconocido", () => {
    expect(bodyFatRanges("x", 30)).toBeNull();
  });
});

describe("bodyFatPercentile (Cooper/ACSM)", () => {
  it("satura en los extremos", () => {
    expect(bodyFatPercentile(4, "hombre", 25)).toBe(99); // muy poca grasa
    expect(bodyFatPercentile(40, "hombre", 25)).toBe(1); // mucha grasa
  });
});

describe("computeResults", () => {
  it("devuelve objeto vacío sin datos", () => {
    expect(computeResults(null)).toEqual({});
  });
  it("calcula IMC normal para 180 cm / 80 kg", () => {
    const r = computeResults({ sex: "hombre", age: 30, height_cm: 180, weight_kg: 80 });
    expect(r.bmi.value).toBe(24.7);
    expect(r.bmi.tone).toBe("good");
  });
  it("detecta asimetría entre lados", () => {
    const r = computeResults({ sex: "hombre", age: 30, height_cm: 180, weight_kg: 80, arm_r_cm: 38, arm_l_cm: 36 });
    const arm = r.asymmetry.find((a) => a.key === "arm");
    expect(arm.diff).toBe(2);
    expect(arm.bigger).toBe("derecho");
  });
});
