import { describe, it, expect } from "vitest";
import { describeIssue, isStrongIssue } from "@/lib/checkout";
import { commentKey } from "@/lib/exerciseComments";

describe("check-out", () => {
  it("describe una molestia en una línea", () => {
    expect(describeIssue({ name: "Sentadilla", zone: "rodilla", side: "derecho", kind: "punzante", intensity: 6, when: "durante" }))
      .toBe("Sentadilla · Rodilla (lado derecho) · Dolor punzante 6/10 · durante el ejercicio");
  });
  it("omite lo que no se llenó", () => {
    expect(describeIssue({ name: "Press", zone: "hombro" })).toBe("Press · Hombro");
  });
  it("7 o más es molestia fuerte", () => {
    expect(isStrongIssue({ intensity: 7 })).toBe(true);
    expect(isStrongIssue({ intensity: 6 })).toBe(false);
  });
  it("clave del comentario por rutina, lugar y ejercicio", () => {
    expect(commentKey("r", null, "e")).toBe("r||e");
  });
});
