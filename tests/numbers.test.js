import { describe, it, expect } from "vitest";
import { cleanDecimal, cleanInt, toNumber } from "@/lib/numbers";

describe("cleanDecimal", () => {
  it("convierte la coma en punto", () => {
    expect(cleanDecimal("35,5")).toBe("35.5");
  });
  it("recorta a los decimales indicados y deja un solo punto", () => {
    expect(cleanDecimal("35.567", 2)).toBe("35.56");
    expect(cleanDecimal("12.3.4", 2)).toBe("12.34");
  });
  it("elimina caracteres no numéricos", () => {
    expect(cleanDecimal("abc12,5kg")).toBe("12.5");
  });
  it("devuelve cadena vacía para null/undefined/''", () => {
    expect(cleanDecimal(null)).toBe("");
    expect(cleanDecimal(undefined)).toBe("");
    expect(cleanDecimal("")).toBe("");
  });
});

describe("cleanInt", () => {
  it("deja solo dígitos", () => {
    expect(cleanInt("a1b2c3")).toBe("123");
    expect(cleanInt("10,5")).toBe("105");
  });
  it("devuelve cadena vacía para null", () => {
    expect(cleanInt(null)).toBe("");
  });
});

describe("toNumber", () => {
  it("parsea número con coma o punto", () => {
    expect(toNumber("35,5")).toBe(35.5);
    expect(toNumber("10")).toBe(10);
  });
  it("devuelve null para vacío o no numérico", () => {
    expect(toNumber("")).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber("abc")).toBeNull();
  });
});
