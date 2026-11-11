import { describe, expect, it } from "vitest";
import { applyPlanChanges } from "../lib/planChanges.js";

const ex = (k, name, block = "b1") => ({ exercise_id: `ex-${name}`, block_id: block, item_key: k, sets: 3, reps: "10", target_weight_kg: 20, rest_minutes: 1, exercises: { name } });
const base = [ex("k1", "Sentadilla"), ex("k2", "Zancada"), ex("k3", "Plancha", "b2")];
const names = (list) => list.map((i) => i.exercises.name);

describe("applyPlanChanges", () => {
  it("sin cambios deja la rutina igual", () => {
    expect(applyPlanChanges(base, [], "r1", 3)).toBe(base);
  });

  it("sustituye desde una semana y conserva lugar, bloque e item_key", () => {
    const changes = [{ id: "c1", routine_id: "r1", from_week: 3, action: "replace", item_key: "k1", exercise_id: "ex-Prensa", exercises: { name: "Prensa" }, reps: "12" }];
    expect(names(applyPlanChanges(base, changes, "r1", 2))).toEqual(["Sentadilla", "Zancada", "Plancha"]);
    const w3 = applyPlanChanges(base, changes, "r1", 3);
    expect(names(w3)).toEqual(["Prensa", "Zancada", "Plancha"]);
    expect(w3[0]).toMatchObject({ item_key: "k1", block_id: "b1", reps: "12", target_weight_kg: null, planChange: "replace" });
  });

  it("quita un ejercicio y manda el cambio más reciente", () => {
    const changes = [
      { id: "a", routine_id: "r1", from_week: 1, action: "replace", item_key: "k2", exercise_id: "ex-X", exercises: { name: "X" } },
      { id: "b", routine_id: "r1", from_week: 4, action: "remove", item_key: "k2" },
    ];
    expect(names(applyPlanChanges(base, changes, "r1", 2))).toEqual(["Sentadilla", "X", "Plancha"]);
    expect(names(applyPlanChanges(base, changes, "r1", 5))).toEqual(["Sentadilla", "Plancha"]);
  });

  it("agrega después de un ejercicio (en su bloque), encadenado y al final", () => {
    const changes = [
      { id: "a", routine_id: "r1", from_week: 1, action: "add", after_item_key: "k1", exercise_id: "ex-A", exercises: { name: "A" }, new_item_key: "n1" },
      { id: "b", routine_id: "r1", from_week: 1, action: "add", after_item_key: "n1", exercise_id: "ex-B", exercises: { name: "B" }, new_item_key: "n2" },
      { id: "c", routine_id: "r1", from_week: 1, action: "add", after_item_key: null, exercise_id: "ex-C", exercises: { name: "C" }, new_item_key: "n3" },
      { id: "d", routine_id: "otra", from_week: 1, action: "add", exercise_id: "ex-D", exercises: { name: "D" }, new_item_key: "n4" },
    ];
    const out = applyPlanChanges(base, changes, "r1", 1);
    expect(names(out)).toEqual(["Sentadilla", "A", "B", "Zancada", "Plancha", "C"]);
    expect(out[1]).toMatchObject({ block_id: "b1", item_key: "n1", planChange: "add" });
    expect(out.map((i) => i.order_index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("si se quita el ejercicio de referencia, el agregado queda en su lugar", () => {
    const changes = [
      { id: "a", routine_id: "r1", from_week: 1, action: "remove", item_key: "k1" },
      { id: "b", routine_id: "r1", from_week: 1, action: "add", after_item_key: "k1", exercise_id: "ex-A", exercises: { name: "A" }, new_item_key: "n1" },
    ];
    const out = applyPlanChanges(base, changes, "r1", 1);
    expect(names(out)).toEqual(["A", "Zancada", "Plancha"]);
    expect(out[0].block_id).toBe("b1");
  });
});
