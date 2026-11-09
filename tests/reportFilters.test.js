import { describe, it, expect } from "vitest";
import { REPORT_FACETS, REPORT_SORTS, checkinTags, lastTrainingBucket, pendingTags, trainingBucket } from "@/lib/reportFilters";
import { filterItems, sortItems } from "@/lib/filters";

const row = (over = {}) => ({
  id: over.name || "x",
  name: "Alumno",
  status: "ok",
  expected: 3,
  trainedDays: 3,
  daysSinceLast: 1,
  mealDays: 2,
  photosDue: false,
  unreadCount: 0,
  intakeAlert: false,
  checkin: null,
  accessUntil: "2027-01-01",
  accessBucket: "mas30",
  seniority: "m3",
  ...over,
});

describe("clasificadores del reporte", () => {
  it("entrenos de la semana", () => {
    expect(trainingBucket(row({ expected: 0, trainedDays: 2 }))).toBe("sinrutina");
    expect(trainingBucket(row({ expected: 3, trainedDays: 3 }))).toBe("completo");
    expect(trainingBucket(row({ expected: 3, trainedDays: 4 }))).toBe("completo");
    expect(trainingBucket(row({ expected: 3, trainedDays: 1 }))).toBe("parcial");
    expect(trainingBucket(row({ expected: 3, trainedDays: 0 }))).toBe("ninguno");
  });

  it("último entreno", () => {
    expect(lastTrainingBucket(row({ daysSinceLast: null }))).toBe("nunca");
    expect(lastTrainingBucket(row({ daysSinceLast: 0 }))).toBe("reciente");
    expect(lastTrainingBucket(row({ daysSinceLast: 1 }))).toBe("reciente");
    expect(lastTrainingBucket(row({ daysSinceLast: 4 }))).toBe("medio");
    expect(lastTrainingBucket(row({ daysSinceLast: 5 }))).toBe("lejos");
  });

  it("un check-in puede estar enviado, sin responder y con dolor a la vez", () => {
    expect(checkinTags(row({ checkin: null }))).toEqual(["sin"]);
    expect(checkinTags(row({ checkin: { coach_reply: null, pain: true, pain_level: 8 } }))).toEqual(["enviado", "sinresponder", "dolor"]);
    expect(checkinTags(row({ checkin: { coach_reply: "ok", pain: true, pain_level: 5 } }))).toEqual(["enviado"]);
  });

  it("pendientes, o 'ninguno' si no hay", () => {
    expect(pendingTags(row())).toEqual(["ninguno"]);
    expect(pendingTags(row({ photosDue: true, unreadCount: 2, mealDays: 0 }))).toEqual(["fotos", "mensajes", "comidas"]);
  });
});

describe("filtros y orden del reporte", () => {
  const ROWS = [
    row({ name: "Ana", status: "ok", daysSinceLast: 0 }),
    row({ name: "Beto", status: "attention", expected: 4, trainedDays: 1, daysSinceLast: 6, unreadCount: 3 }),
    row({ name: "Caro", status: "inactive", expected: 3, trainedDays: 0, daysSinceLast: null }),
    row({ name: "Dani", status: "ok", expected: 0, trainedDays: 0, daysSinceLast: 2, accessUntil: "2026-11-12", accessBucket: "vence7" }),
  ];

  it("filtra por estado y por entrenos combinados", () => {
    const { result } = filterItems({
      items: ROWS,
      facets: REPORT_FACETS,
      selected: { estado: ["attention", "inactive"], entrenos: ["ninguno"] },
    });
    expect(result.map((r) => r.name)).toEqual(["Caro"]);
  });

  it("orden por prioridad: sin actividad, atención y al día", () => {
    expect(sortItems(ROWS, REPORT_SORTS, "prioridad").map((r) => r.name)).toEqual(["Caro", "Beto", "Ana", "Dani"]);
  });

  it("menos entrenos primero; los sin rutina al final", () => {
    expect(sortItems(ROWS, REPORT_SORTS, "cumplimiento").map((r) => r.name)).toEqual(["Caro", "Beto", "Ana", "Dani"]);
  });

  it("más días sin entrenar: los que nunca entrenaron primero", () => {
    expect(sortItems(ROWS, REPORT_SORTS, "inactividad").map((r) => r.name)).toEqual(["Caro", "Beto", "Dani", "Ana"]);
  });

  it("vence primero y mensajes sin leer", () => {
    expect(sortItems(ROWS, REPORT_SORTS, "vence")[0].name).toBe("Dani");
    expect(sortItems(ROWS, REPORT_SORTS, "mensajes")[0].name).toBe("Beto");
  });
});
