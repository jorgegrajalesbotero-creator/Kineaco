import { describe, expect, it } from "vitest";
import { chatWhen, firstName } from "@/lib/chatMeta";

describe("chatWhen", () => {
  const now = new Date(2026, 10, 26, 23, 0);
  it("hoy, ayer y otros días", () => {
    expect(chatWhen(new Date(2026, 10, 26, 9, 5).toISOString(), { now })).toMatch(/^Hoy /);
    expect(chatWhen(new Date(2026, 10, 25, 9, 5).toISOString(), { now })).toMatch(/^Ayer /);
    expect(chatWhen(new Date(2026, 10, 20, 9, 5).toISOString(), { now })).toMatch(/20/);
  });
  it("fecha dañada", () => expect(chatWhen("nada", { now })).toBe(""));
});

describe("firstName", () => {
  it("toma el primer nombre", () => expect(firstName("Jorge Grajales Coach")).toBe("Jorge"));
  it("vacío", () => expect(firstName(null)).toBe(""));
});
