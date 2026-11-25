import { describe, it, expect } from "vitest";
import { PET_ITEMS, branchLevel, cleanOutfit, computeUnlocks, progressText } from "@/lib/petItems";

describe("accesorios del camaleón", () => {
  it("de entrada solo trae el fondo selva", () => {
    expect(computeUnlocks({})).toEqual(["selva"]);
  });

  it("con 10 entrenamientos y 2 semanas cumpliendo ya tiene varias cosas", () => {
    const u = computeUnlocks({ trainings: 10, streak_best: 2 });
    ["banda", "gafas", "gorra", "tenis", "montana", "playa"].forEach((k) => expect(u).toContain(k));
    expect(u).not.toContain("sombrero");
  });

  it("hay exactamente 5 especiales y son los más difíciles de su camino", () => {
    const sp = PET_ITEMS.filter((i) => i.special);
    expect(sp).toHaveLength(5);
    sp.forEach((s) => {
      const same = PET_ITEMS.filter((i) => i.metric === s.metric && !i.special);
      same.forEach((i) => {
        if (s.metric !== "streak_best") expect(s.need).toBeGreaterThan(i.need);
      });
    });
  });

  it("solo deja puesto lo desbloqueado y en su lugar", () => {
    expect(cleanOutfit({ head: "gorra", eyes: "gafas", feet: "corona" }, ["gorra"])).toEqual({ head: "gorra" });
  });

  it("dice cuánto falta", () => {
    const gorra = PET_ITEMS.find((i) => i.key === "gorra");
    expect(progressText(gorra, { trainings: 4 })).toBe("4 de 6 entrenamientos");
  });

  it("la rama sube con 10 entrenamientos o 2 semanas", () => {
    expect(branchLevel({ trainings: 9 })).toBe(0);
    expect(branchLevel({ trainings: 10 })).toBe(1);
    expect(branchLevel({ streak_best: 6 })).toBe(2);
    expect(branchLevel({ trainings: 80 })).toBe(3);
  });
});
