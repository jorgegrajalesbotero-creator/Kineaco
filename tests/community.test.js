import { describe, it, expect } from "vitest";
import { PET_LEVELS, REACTIONS, challengePct } from "@/lib/community";

describe("comunidad", () => {
  it("avance del reto entre 0 y 100", () => {
    expect(challengePct({ progress: 150, target: 300 })).toBe(50);
    expect(challengePct({ progress: 400, target: 300 })).toBe(100);
    expect(challengePct({ progress: 0, target: 0 })).toBe(0);
  });
  it("las reacciones coinciden con las de la base", () => {
    expect(REACTIONS.map((r) => r.key)).toEqual(["fuerza", "fuego", "aplauso"]);
  });
  it("4 niveles de rama", () => {
    expect(PET_LEVELS.map((l) => l.level)).toEqual([0, 1, 2, 3]);
  });
});
