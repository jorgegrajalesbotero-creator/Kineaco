import { describe, it, expect } from "vitest";
import { exerciseKeyOf, nextGoal, volumeOf, markRecords, firstVsLast, spanText } from "@/lib/exerciseHistory";

describe("exerciseKeyOf", () => {
  it("usa el id si existe", () => {
    expect(exerciseKeyOf(5, "Press")).toBe("5");
  });
  it("sin id, normaliza el nombre (minúsculas y sin espacios al borde)", () => {
    expect(exerciseKeyOf(null, "  Press Banca  ")).toBe("name:press banca");
  });
});

describe("nextGoal", () => {
  it("suma 1 kg por debajo de 10 y 2,5 kg desde 10", () => {
    expect(nextGoal(8)).toBe(9);
    expect(nextGoal(100)).toBe(102.5);
  });
  it("devuelve null sin máximo", () => {
    expect(nextGoal(null)).toBeNull();
  });
});

describe("volumeOf", () => {
  it("multiplica peso × reps × series (1 por defecto)", () => {
    expect(volumeOf({ weight: 100, reps: 5, sets: 3 })).toBe(1500);
    expect(volumeOf({ weight: 100, reps: 5 })).toBe(500);
  });
  it("devuelve null si falta peso o reps", () => {
    expect(volumeOf({ weight: null, reps: 5 })).toBeNull();
    expect(volumeOf({ weight: 100 })).toBeNull();
  });
});

describe("markRecords (escalera de récords)", () => {
  const points = [
    { weight: 100, reps: 5 },
    { weight: 100, reps: 6 }, // mismo peso, más reps -> récord de reps
    { weight: 110, reps: 3 }, // más peso -> PR
    { weight: 90, reps: 10 }, // por debajo del máximo -> normal
  ];
  const { points: out, prCount, maxWeight } = markRecords(points);

  it("clasifica cada punto", () => {
    expect(out[0].kind).toBe("start");
    expect(out[1].kind).toBe("reps");
    expect(out[2].kind).toBe("pr");
    expect(out[3].kind).toBe("normal");
  });
  it("cuenta los récords y guarda el máximo", () => {
    expect(prCount).toBe(2);
    expect(maxWeight).toBe(110);
    expect(out[3].maxSoFar).toBe(110);
  });
});

describe("firstVsLast", () => {
  const points = [
    { weight: 100, reps: 5, sets: 3 },
    { weight: 110, reps: 4, sets: 2 },
  ];
  it("toma el primer y el último con dato", () => {
    const r = firstVsLast(points);
    expect(r.weight.from).toBe(100);
    expect(r.weight.to).toBe(110);
    expect(r.volume.from).toBe(1500);
    expect(r.volume.to).toBe(880);
  });
});

describe("spanText (tiempo en palabras)", () => {
  it("compone años y meses", () => {
    expect(spanText(new Date(2020, 0, 1), new Date(2023, 7, 1))).toBe("3 años y 7 meses");
  });
  it("un año exacto, sin meses", () => {
    expect(spanText(new Date(2022, 0, 1), new Date(2023, 0, 1))).toBe("1 año");
  });
  it("menos de un mes se expresa en días", () => {
    expect(spanText(new Date(2023, 0, 1), new Date(2023, 0, 15))).toBe("14 días");
  });
});
