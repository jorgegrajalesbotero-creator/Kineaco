import { describe, it, expect } from "vitest";
import { WEEK_DAYS, localDateString, todayDayLabel, daysSince } from "@/lib/dates";

describe("WEEK_DAYS", () => {
  it("empieza en lunes y termina en domingo", () => {
    expect(WEEK_DAYS).toHaveLength(7);
    expect(WEEK_DAYS[0]).toBe("Lunes");
    expect(WEEK_DAYS[6]).toBe("Domingo");
  });
});

describe("localDateString", () => {
  it("formatea como YYYY-MM-DD con ceros a la izquierda", () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateString(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("todayDayLabel", () => {
  it("devuelve un día válido de la semana", () => {
    expect(WEEK_DAYS).toContain(todayDayLabel());
  });
});

describe("daysSince", () => {
  it("devuelve 0 para la fecha de hoy", () => {
    expect(daysSince(localDateString())).toBe(0);
  });
});
