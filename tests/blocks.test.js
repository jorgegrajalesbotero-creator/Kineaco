import { describe, it, expect } from "vitest";
import { blockTypeLabel, blockUsesProgression } from "@/lib/blocks";

describe("blockTypeLabel", () => {
  it("traduce la clave conocida", () => {
    expect(blockTypeLabel("principal")).toBe("Trabajo principal");
  });
  it("devuelve la clave tal cual si no la conoce", () => {
    expect(blockTypeLabel("desconocido")).toBe("desconocido");
  });
});

describe("blockUsesProgression", () => {
  it("aplica progresión sin bloque o en el bloque principal", () => {
    expect(blockUsesProgression(null)).toBe(true);
    expect(blockUsesProgression("principal")).toBe(true);
  });
  it("no aplica en otros bloques", () => {
    expect(blockUsesProgression("calentamiento")).toBe(false);
    expect(blockUsesProgression("remate")).toBe(false);
  });
});
