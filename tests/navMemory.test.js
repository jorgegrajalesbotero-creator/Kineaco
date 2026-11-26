import { describe, expect, it } from "vitest";
import { NAV_MAX_AGE_MS, freshValue } from "@/lib/navMemory";

describe("freshValue", () => {
  const now = 1_700_000_000_000;
  it("devuelve lo guardado si es reciente", () => {
    expect(freshValue({ v: "rutinas", at: now - 60_000 }, now)).toBe("rutinas");
    expect(freshValue({ v: { id: "a", panel: "plan" }, at: now }, now)).toEqual({ id: "a", panel: "plan" });
  });
  it("lo descarta si pasó demasiado tiempo", () => {
    expect(freshValue({ v: "rutinas", at: now - NAV_MAX_AGE_MS - 1 }, now)).toBeNull();
  });
  it("descarta datos dañados o del futuro", () => {
    expect(freshValue(null, now)).toBeNull();
    expect(freshValue("rutinas", now)).toBeNull();
    expect(freshValue({ v: "x" }, now)).toBeNull();
    expect(freshValue({ v: "x", at: "nada" }, now)).toBeNull();
    expect(freshValue({ v: "x", at: now + 10 * 60_000 }, now)).toBeNull();
  });
});
