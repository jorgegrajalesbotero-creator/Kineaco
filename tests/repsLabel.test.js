import { describe, expect, it } from "vitest";
import { repsLabel } from "@/lib/repsLabel";

describe("repsLabel", () => {
  it("solo números: agrega reps", () => {
    expect(repsLabel("12")).toBe("12 reps");
    expect(repsLabel("8-10")).toBe("8-10 reps");
    expect(repsLabel(15)).toBe("15 reps");
  });
  it("con unidad ya escrita: no la repite", () => {
    expect(repsLabel("30 reps")).toBe("30 reps");
    expect(repsLabel("20 seg")).toBe("20 seg");
    expect(repsLabel('40"')).toBe('40"');
    expect(repsLabel("al fallo")).toBe("al fallo");
  });
  it("vacío", () => expect(repsLabel("")).toBe(""));
});
