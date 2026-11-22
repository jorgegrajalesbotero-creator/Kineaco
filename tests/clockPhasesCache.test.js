import { describe, it, expect } from "vitest";
import { clockPhases } from "@/lib/clockStore";
import { CLOCK_DEFAULTS, totalSeconds } from "@/lib/clock";

// Las fases se guardan en caché para no rearmarlas muchas veces por segundo. Si esa caché
// devolviera las de antes, el reloj correría con los tiempos viejos sin avisar de nada.
const estado = (cfg, extra = 0) => ({
  mode: "tabata",
  configs: { tabata: { ...CLOCK_DEFAULTS.tabata, ...cfg } },
  run: extra ? { extra } : null,
});

describe("clockPhases en caché", () => {
  it("reusa la misma lista mientras el reloj no cambia", () => {
    const s = estado({ rounds: 4 });
    expect(clockPhases(s)).toBe(clockPhases(s)); // la misma, no una copia
  });

  it("rearma las fases al cambiar la configuración", () => {
    const corto = clockPhases(estado({ rounds: 2, work: 20, rest: 10 }));
    const largo = clockPhases(estado({ rounds: 8, work: 20, rest: 10 }));
    expect(largo.length).toBeGreaterThan(corto.length);
    expect(totalSeconds(largo)).toBeGreaterThan(totalSeconds(corto));
  });

  it("rearma las fases al cambiar de modo", () => {
    const tabata = clockPhases(estado({ rounds: 4 }));
    const descanso = clockPhases({ mode: "rest", configs: { rest: { seconds: 90 } }, run: null });
    expect(descanso).toHaveLength(1);
    expect(descanso[0].type).toBe("rest");
    expect(tabata.length).toBeGreaterThan(1);
  });

  it("tiene en cuenta los segundos que el alumno suma al descanso", () => {
    const base = { mode: "rest", configs: { rest: { seconds: 60 } }, run: null };
    expect(totalSeconds(clockPhases(base))).toBe(60);
    expect(totalSeconds(clockPhases({ ...base, run: { extra: 15 } }))).toBe(75);
  });
});
