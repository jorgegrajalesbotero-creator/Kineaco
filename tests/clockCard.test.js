import { describe, it, expect } from "vitest";
import { buildPhases, clockCardText, stateAt } from "@/lib/clock";

const ex = [{ name: "Burpees" }, { name: "Sentadilla" }, { name: "Plancha" }];
const cfg = { prep: 10, work: 20, rest: 10, rounds: 4, sets: 2, setRest: 60, cooldown: 30 };
const phases = buildPhases("tabata", cfg);
const card = (ms, exercises = ex) => clockCardText({ mode: "tabata", phases, st: stateAt(phases, ms), exercises });

describe("clockCardText", () => {
  it("en trabajo, el título es el ejercicio y debajo va la fase y la serie", () => {
    const c = card(12000); // ciclo 1 de la serie 1
    expect(c.title).toBe("Burpees");
    expect(c.artist).toBe("Trabajo · Serie 1 de 2");
    expect(c.album).toContain("Ciclo 1 de 4");
    expect(c.album).toContain("min");
  });

  it("sin ejercicios, el título es la fase", () => {
    expect(card(12000, []).title).toBe("Trabajo");
  });

  it("en el descanso del ciclo no hay ejercicio actual", () => {
    const c = card(32000);
    expect(c.title).toBe("Descanso");
    expect(c.phase).toBe("rest");
  });

  it("reconoce la preparación, el descanso entre series y el enfriamiento", () => {
    expect(card(2000).title).toBe("Prepárese");
    expect(card(2000).album).not.toContain("Ciclo"); // en preparación todavía no hay ciclo
    const entreSeries = card(135000);
    expect(entreSeries.title).toBe("Descanso entre series");
    expect(card(10_000_000 - 1).phase).toBeDefined();
  });

  it("con una sola serie no dice 'Serie 1 de 1'", () => {
    const unaSerie = buildPhases("tabata", { ...cfg, sets: 1 });
    const c = clockCardText({ mode: "tabata", phases: unaSerie, st: stateAt(unaSerie, 12000), exercises: ex });
    expect(c.artist).toBe("Trabajo");
  });

  it("el texto NO cambia entre dos segundos del mismo ciclo", () => {
    // Es lo que evita que la pantalla de bloqueo parpadee: si el texto cambiara cada segundo,
    // el celular borraría y recargaría la carátula todo el tiempo.
    const a = card(12000);
    const b = card(13000);
    expect(b).toEqual(a);
  });

  it("al terminar y en cronómetro no se rompe", () => {
    expect(card(10_000_000).title).toBe("¡Terminado!");
    expect(clockCardText({ mode: "stopwatch", st: null }).title).toBe("Cronómetro");
    expect(clockCardText({ mode: "tabata", phases, st: null }).title).toBe("¡Terminado!");
  });

  it("entrega los datos que necesita la carátula", () => {
    const c = card(12000);
    expect(c).toMatchObject({ phase: "work", cycle: 1, cycles: 4, set: 1, sets: 2 });
  });
});
