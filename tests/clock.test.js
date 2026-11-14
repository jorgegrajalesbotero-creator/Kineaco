import { describe, it, expect } from "vitest";
import { buildPhases, stateAt, totalSeconds, formatClock, formatStopwatch, normalizeConfig } from "@/lib/clock";

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
    expect(normalizeConfig("tabata", { rounds: 500, work: 1 })).toMatchObject({ rounds: 99, work: 5 });
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
