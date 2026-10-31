import { describe, it, expect } from "vitest";
import { safeHttpUrl } from "@/lib/url";

describe("safeHttpUrl (defensa contra enlaces maliciosos)", () => {
  it("acepta http y https", () => {
    expect(safeHttpUrl("https://example.com/v")).toBe("https://example.com/v");
    expect(safeHttpUrl("http://example.com/v")).toBe("http://example.com/v");
  });
  it("rechaza javascript: y data: (vector XSS)", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });
  it("rechaza otros protocolos (ftp, file)", () => {
    expect(safeHttpUrl("ftp://host/x")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
  });
  it("rechaza valores vacíos o no parseables", () => {
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl("no es una url")).toBeNull();
  });
});
