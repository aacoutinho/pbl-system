import { describe, it, expect } from "vitest";
import { normalizeSemester } from "./routers";

describe("normalizeSemester", () => {
  it("accepts ANO.SEMESTRE format (2026.1)", () => {
    expect(normalizeSemester("2026.1")).toBe("2026.1");
    expect(normalizeSemester("2026.2")).toBe("2026.2");
  });

  it("converts compact format (20261 → 2026.1)", () => {
    expect(normalizeSemester("20261")).toBe("2026.1");
    expect(normalizeSemester("20262")).toBe("2026.2");
  });

  it("converts slash format (2026/1 → 2026.1)", () => {
    expect(normalizeSemester("2026/1")).toBe("2026.1");
    expect(normalizeSemester("2026/2")).toBe("2026.2");
  });

  it("converts dash format (2026-1 → 2026.1)", () => {
    expect(normalizeSemester("2026-1")).toBe("2026.1");
    expect(normalizeSemester("2026-2")).toBe("2026.2");
  });

  it("converts space format (2026 1 → 2026.1)", () => {
    expect(normalizeSemester("2026 1")).toBe("2026.1");
    expect(normalizeSemester("2026 2")).toBe("2026.2");
  });

  it("trims whitespace", () => {
    expect(normalizeSemester("  2026.1  ")).toBe("2026.1");
    expect(normalizeSemester(" 20261 ")).toBe("2026.1");
  });

  it("rejects invalid semester number (not 1 or 2)", () => {
    expect(normalizeSemester("20263")).toBeNull();
    expect(normalizeSemester("2026.3")).toBeNull();
    expect(normalizeSemester("2026.0")).toBeNull();
  });

  it("rejects invalid year (less than 4 digits)", () => {
    expect(normalizeSemester("261")).toBeNull();
    expect(normalizeSemester("26.1")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(normalizeSemester("")).toBeNull();
    expect(normalizeSemester("   ")).toBeNull();
  });

  it("rejects random text", () => {
    expect(normalizeSemester("abc")).toBeNull();
    expect(normalizeSemester("primeiro semestre")).toBeNull();
  });

  it("works with different years", () => {
    expect(normalizeSemester("2025.1")).toBe("2025.1");
    expect(normalizeSemester("20252")).toBe("2025.2");
    expect(normalizeSemester("2024/1")).toBe("2024.1");
    expect(normalizeSemester("2030-2")).toBe("2030.2");
  });
});
