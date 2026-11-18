import { describe, it, expect } from "vitest";
import { buildPhases, stateAt, totalSeconds, formatClock, formatStopwatch, normalizeConfig, parseClockInput, stepFor, CLOCK_FIELDS } from "@/lib/clock";

describe("buildPhases", () => {
  it("tabata por defecto: preparación + 8 de trabajo y 7 descansos", () => {
    const p = buildPhases("tabata", {});
    expect(p[0].type).toBe("prep");
    expect(p.filter((x) => x.type === "work")).toHaveLength(8);
    expect(p.filter((x) => x.type === "rest")).toHaveLength(7);
    expect(totalSeconds(p)).toBe(10 + 8 * 20 + 7 * 10);
  });
  it("intervalos sin descanso", () => {
    const p = buildPhases("intervals", { work: 30, rest: 0, rounds: 3 });
    expect(p.map((x) => x.type)).toEqual(["prep", "work", "work", "work"]);
  });
  it("descanso con segundos extra", () => {
    expect(buildPhases("rest", { seconds: 60 }, 15)[0].dur).toBe(75);
    expect(buildPhases("rest", { seconds: 15 }, -60)[0].dur).toBe(1);
  });
  it("AMRAP en minutos", () => {
    expect(totalSeconds(buildPhases("amrap", { minutes: 12 }))).toBe(10 + 720);
  });
  it("respeta los límites", () => {
    expect(normalizeConfig("tabata", { rounds: 500, work: 0 })).toMatchObject({ rounds: 99, work: 1 });
    expect(normalizeConfig("intervals", { work: 7, rest: 8 })).toMatchObject({ work: 7, rest: 8 });
  });
});

describe("stateAt", () => {
  const p = buildPhases("tabata", { work: 20, rest: 10, rounds: 2 });
  it("arranca en preparación", () => {
    expect(stateAt(p, 0)).toMatchObject({ index: 0, remaining: 10, done: false });
  });
  it("pasa a trabajo y luego a descanso", () => {
    expect(stateAt(p, 10000).phase.type).toBe("work");
    expect(stateAt(p, 10000).remaining).toBe(20);
    expect(stateAt(p, 29500).remaining).toBe(1);
    expect(stateAt(p, 30000).phase.type).toBe("rest");
  });
  it("termina", () => {
    expect(stateAt(p, (10 + 20 + 10 + 20) * 1000).done).toBe(true);
  });
});

describe("formatos", () => {
  it("formatClock", () => {
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3725)).toBe("1:02:05");
  });
  it("formatStopwatch", () => {
    expect(formatStopwatch(65400)).toBe("1:05.4");
  });
});

describe("tiempos exactos", () => {
  const work = CLOCK_FIELDS.tabata[0];
  it("lee lo que se escribe", () => {
    expect(parseClockInput("8")).toBe(8);
    expect(parseClockInput("0:07")).toBe(7);
    expect(parseClockInput("1:30")).toBe(90);
    expect(parseClockInput("1,30")).toBe(90);
    expect(parseClockInput("45s")).toBe(45);
    expect(parseClockInput("2m")).toBe(120);
    expect(parseClockInput("abc")).toBe(null);
    expect(parseClockInput("")).toBe(null);
  });
  it("los botones van de a 1 s bajo el minuto y luego más rápido", () => {
    expect(stepFor(work, 7, 1)).toBe(8);
    expect(stepFor(work, 8, -1)).toBe(7);
    expect(stepFor(work, 59, 1)).toBe(60);
    expect(stepFor(work, 60, 1)).toBe(65);
    expect(stepFor(work, 60, -1)).toBe(59);
    expect(stepFor(work, 62, 1)).toBe(65);
    expect(stepFor(work, 300, 1)).toBe(315);
    expect(stepFor(work, 1, -1)).toBe(1);
  });
});

describe("series, descanso entre series y enfriamiento", () => {
  it("arma preparación, ciclos por serie, descanso entre series y enfriamiento", () => {
    const p = buildPhases("intervals", { prep: 5, work: 30, rest: 15, rounds: 3, sets: 2, setRest: 60, cooldown: 120 });
    expect(p.map((x) => x.type)).toEqual([
      "prep", "work", "rest", "work", "rest", "work", "setrest", "work", "rest", "work", "rest", "work", "cooldown",
    ]);
    expect(totalSeconds(p)).toBe(5 + 2 * (3 * 30 + 2 * 15) + 60 + 120);
    expect(p[7]).toMatchObject({ type: "work", set: 2, round: 1, sets: 2 });
  });
  it("sin preparación arranca en trabajo", () => {
    expect(buildPhases("tabata", { prep: 0, rounds: 2 })[0].type).toBe("work");
  });
});
