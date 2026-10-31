import { describe, it, expect } from "vitest";
import { normalizeText, matchesSearch } from "@/lib/search";
import { phaseType, phaseDisplayName } from "@/lib/planning";
import { intakeLabel, intakeHasAlert, INTAKE_GOALS } from "@/lib/intake";

describe("normalizeText / matchesSearch", () => {
  it("ignora mayúsculas y acentos", () => {
    expect(normalizeText("PÉLOTÓN ÁÉÍ")).toBe("peloton aei");
  });
  it("coincide cuando todas las palabras están presentes", () => {
    expect(matchesSearch("press banca", "Press de Banca Plano")).toBe(true);
    expect(matchesSearch("sentadilla", "Press de Banca")).toBe(false);
  });
  it("busca en varios campos y una búsqueda vacía acepta todo", () => {
    expect(matchesSearch("maria", "Juan", "María Pérez")).toBe(true);
    expect(matchesSearch("", "lo que sea")).toBe(true);
  });
});

describe("phaseType / phaseDisplayName", () => {
  it("devuelve la fase conocida", () => {
    expect(phaseType("acumulacion").label).toBe("Acumulación");
  });
  it("cae en 'Otro' para una clave desconocida", () => {
    expect(phaseType("xyz").key).toBe("otro");
  });
  it("prioriza el nombre personalizado de la fase", () => {
    expect(phaseDisplayName({ phase_type: "acumulacion", name: "Base" })).toBe("Base");
    expect(phaseDisplayName({ phase_type: "realizacion" })).toBe("Realización");
  });
});

describe("intakeLabel / intakeHasAlert", () => {
  it("traduce la clave o devuelve guion", () => {
    expect(intakeLabel(INTAKE_GOALS, "fuerza")).toBe("Ganar fuerza");
    expect(intakeLabel(INTAKE_GOALS, "desconocida")).toBe("desconocida");
    expect(intakeLabel(INTAKE_GOALS, null)).toBe("—");
  });
  it("alerta solo con lesión actual o restricción médica", () => {
    expect(intakeHasAlert({ current_injury: "rodilla" })).toBe(true);
    expect(intakeHasAlert({ medical_restriction: "hernia" })).toBe(true);
    expect(intakeHasAlert({ past_injury: "tobillo" })).toBe(false);
    expect(intakeHasAlert(null)).toBe(false);
  });
});
