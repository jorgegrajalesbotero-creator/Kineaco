import { describe, expect, it } from "vitest";
import { platformOf } from "@/lib/installApp";

describe("platformOf", () => {
  it("iPhone y iPad (también el iPad que dice ser Mac)", () => {
    expect(platformOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
  });
  it("Android", () => expect(platformOf("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android"));
  it("computador", () => {
    expect(platformOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("desktop");
  });
});
