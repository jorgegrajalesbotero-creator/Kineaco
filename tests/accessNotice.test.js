import { describe, expect, it } from "vitest";
import { accessDaysLeft, accessReminderRow, accessStage, weeklyExpiring } from "@/lib/accessNotice";

// 26 nov 2026, 9:00 a. m. en Colombia
const now = new Date("2026-11-26T14:00:00Z");
// Lo que guarda el coach: el final del día en Colombia
const endOf = (iso) => new Date(`${iso}T23:59:59-05:00`).toISOString();

describe("accessDaysLeft", () => {
  it("cuenta días de calendario en Colombia", () => {
    expect(accessDaysLeft(endOf("2026-11-26"), now)).toBe(0);
    expect(accessDaysLeft(endOf("2026-11-29"), now)).toBe(3);
    expect(accessDaysLeft(endOf("2026-11-25"), now)).toBe(-1);
  });
  it("de noche en Colombia todavía es el mismo día (aunque en UTC ya sea mañana)", () => {
    expect(accessDaysLeft(endOf("2026-11-26"), new Date("2026-11-27T03:30:00Z"))).toBe(0);
  });
  it("sin fecha", () => expect(accessDaysLeft(null, now)).toBeNull());
});

describe("accessStage", () => {
  it("solo los últimos 7 días", () => {
    expect(accessStage(8)).toBeNull();
    expect(accessStage(7)).toBe("soon");
    expect(accessStage(3)).toBe("soon");
    expect(accessStage(2)).toBe("urgent");
    expect(accessStage(0)).toBe("today");
    expect(accessStage(-1)).toBeNull();
  });
});

describe("accessReminderRow", () => {
  it("3 días antes y el mismo día, cada uno con su propia clave", () => {
    const tres = accessReminderRow("u1", endOf("2026-11-29"), now);
    expect(tres.dedupe_key).toBe("access:2026-11-29:3");
    expect(tres.title).toBe("Su acceso vence pronto");
    const hoy = accessReminderRow("u1", endOf("2026-11-26"), now);
    expect(hoy.dedupe_key).toBe("access:2026-11-26:0");
    expect(hoy.title).toBe("Su acceso vence hoy");
  });
  it("los otros días no avisa", () => {
    expect(accessReminderRow("u1", endOf("2026-11-28"), now)).toBeNull();
    expect(accessReminderRow("u1", endOf("2026-12-03"), now)).toBeNull();
  });
});

describe("weeklyExpiring", () => {
  it("los que vencen en 7 días o menos, del más cercano al más lejano", () => {
    const list = weeklyExpiring([
      { id: "a", full_name: "Ana", access_until: endOf("2026-12-02") },
      { id: "b", full_name: "Beto", access_until: endOf("2026-12-10") },
      { id: "c", full_name: "Caro", access_until: endOf("2026-11-27") },
      { id: "d", full_name: "Dani", access_until: endOf("2026-11-20") },
    ], now);
    expect(list.map((s) => s.id)).toEqual(["c", "a"]);
  });
});
