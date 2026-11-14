import { describe, it, expect } from "vitest";
import { routinesForDate } from "@/lib/trainingPlan";
import { timersFor } from "@/lib/routineTimers";
import { timerLabel } from "@/lib/clock";

const extras = [{ id: "e1", days: ["Lunes", "Miércoles"], start_date: "2026-11-10", end_date: "2026-11-30", order_index: 0, routines: { id: "r9" } }];

describe("extras", () => {
  it("se suman al final del día, sin quitar lo que ya tenía", () => {
    const items = routinesForDate([], [{ day_label: "Miércoles", routines: { id: "r1" } }], new Date(2026, 10, 11), extras).items;
    expect(items.map((i) => i.routines.id)).toEqual(["r1", "r9"]);
    expect(items[1].isExtra).toBe(true);
  });
  it("respetan días y fechas", () => {
    expect(routinesForDate([], [], new Date(2026, 10, 9), extras).items).toHaveLength(0); // antes de empezar
    expect(routinesForDate([], [], new Date(2026, 10, 12), extras).items).toHaveLength(0); // jueves
    expect(routinesForDate([], [], new Date(2026, 10, 16), extras).items).toHaveLength(1);
    expect(routinesForDate([], [], new Date(2026, 11, 2), extras).items).toHaveLength(0); // ya terminó
  });
});

describe("reloj programado", () => {
  const rows = [
    { routine_id: "r1", block_index: 0, user_id: null, timer: { mode: "tabata" } },
    { routine_id: "r1", block_index: 0, user_id: "u1", timer: { mode: "amrap", minutes: 15 } },
    { routine_id: "r1", block_index: 1, user_id: "u2", timer: { mode: "rest" } },
  ];
  it("el del alumno manda sobre el de la rutina", () => {
    const t = timersFor(rows, "r1", "u1");
    expect(t[0].timer).toMatchObject({ mode: "amrap", minutes: 15 });
    expect(t[0].custom).toBe(true);
    expect(t[0].base.mode).toBe("tabata");
    expect(t[1]).toBeUndefined();
  });
  it("sin alumno, solo el de la rutina", () => {
    expect(timersFor(rows, "r1")[0].timer.mode).toBe("tabata");
  });
  it("texto corto", () => {
    expect(timerLabel({ mode: "tabata" })).toBe("Tabata 0:20 / 0:10 × 8");
    expect(timerLabel({ mode: "amrap", minutes: 12 })).toBe("AMRAP 12 min");
    expect(timerLabel({ mode: "nada" })).toBe("");
  });
});
