import { describe, it, expect } from "vitest";

// ─── Replica das funções auxiliares do CriteriaSlider (StudentAccessPage) ───

const CS_SNAP_POINTS = [0, 0.25, 0.5, 0.75, 1.0];

const CS_LABELS_FEM = [
  { label: "Nenhuma", value: 0 },
  { label: "Fraca", value: 0.25 },
  { label: "Razoável", value: 0.5 },
  { label: "Boa", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

const CS_LABELS_MASC = [
  { label: "Nenhum", value: 0 },
  { label: "Fraco", value: 0.25 },
  { label: "Razoável", value: 0.5 },
  { label: "Bom", value: 0.75 },
  { label: "Excelente", value: 1.0 },
] as const;

const CS_LABELS_PENALTY = [
  { label: "Nenhum", value: 1.0 },
  { label: "Fraco", value: 0.75 },
  { label: "Razoável", value: 0.5 },
  { label: "Bom", value: 0.25 },
  { label: "Excelente", value: 0.0 },
] as const;

function csGetTrackColor(v: number): string {
  if (v <= 0) return "#ef4444";
  if (v <= 0.25) return "#f97316";
  if (v <= 0.5) return "#f59e0b";
  if (v <= 0.75) return "#65a30d";
  return "#059669";
}

function csPenaltyTrackColor(v: number): string {
  if (v >= 1) return "#ef4444";
  if (v >= 0.75) return "#f97316";
  if (v >= 0.5) return "#f59e0b";
  if (v >= 0.25) return "#65a30d";
  return "#059669";
}

function csGetLabel(value: number, gender: "fem" | "masc", penalty?: boolean): string {
  if (penalty) {
    const match = CS_LABELS_PENALTY.find(l => Math.abs(l.value - value) < 0.01);
    return match?.label ?? value.toFixed(2);
  }
  const labels = gender === "masc" ? CS_LABELS_MASC : CS_LABELS_FEM;
  const match = labels.find(l => Math.abs(l.value - value) < 0.01);
  return match?.label ?? value.toFixed(2);
}

function csFractionToDisplay(v: number): string {
  return (Math.round(v * 100) / 10).toFixed(1);
}

function csDisplayToFraction(s: string): number | null {
  const n = parseFloat(s);
  if (isNaN(n) || n < 0 || n > 10) return null;
  return Math.round((n / 10) * 100) / 100;
}

// ─── Testes ───

describe("CriteriaSlider - csFractionToDisplay", () => {
  it("converts 0 to '0.0'", () => {
    expect(csFractionToDisplay(0)).toBe("0.0");
  });
  it("converts 0.25 to '2.5'", () => {
    expect(csFractionToDisplay(0.25)).toBe("2.5");
  });
  it("converts 0.5 to '5.0'", () => {
    expect(csFractionToDisplay(0.5)).toBe("5.0");
  });
  it("converts 0.75 to '7.5'", () => {
    expect(csFractionToDisplay(0.75)).toBe("7.5");
  });
  it("converts 1.0 to '10.0'", () => {
    expect(csFractionToDisplay(1.0)).toBe("10.0");
  });
  it("converts 0.1 to '1.0'", () => {
    expect(csFractionToDisplay(0.1)).toBe("1.0");
  });
});

describe("CriteriaSlider - csDisplayToFraction", () => {
  it("converts '0.0' to 0", () => {
    expect(csDisplayToFraction("0.0")).toBe(0);
  });
  it("converts '2.5' to 0.25", () => {
    expect(csDisplayToFraction("2.5")).toBe(0.25);
  });
  it("converts '5.0' to 0.5", () => {
    expect(csDisplayToFraction("5.0")).toBe(0.5);
  });
  it("converts '7.5' to 0.75", () => {
    expect(csDisplayToFraction("7.5")).toBe(0.75);
  });
  it("converts '10.0' to 1.0", () => {
    expect(csDisplayToFraction("10.0")).toBe(1.0);
  });
  it("returns null for invalid string", () => {
    expect(csDisplayToFraction("abc")).toBeNull();
  });
  it("returns null for negative value", () => {
    expect(csDisplayToFraction("-1")).toBeNull();
  });
  it("returns null for value > 10", () => {
    expect(csDisplayToFraction("11")).toBeNull();
  });
  it("converts '10' (no decimal) to 1.0", () => {
    expect(csDisplayToFraction("10")).toBe(1.0);
  });
});

describe("CriteriaSlider - csGetTrackColor", () => {
  it("returns red for 0 (Nenhuma)", () => {
    expect(csGetTrackColor(0)).toBe("#ef4444");
  });
  it("returns orange for 0.25 (Fraca)", () => {
    expect(csGetTrackColor(0.25)).toBe("#f97316");
  });
  it("returns amber for 0.5 (Razoável)", () => {
    expect(csGetTrackColor(0.5)).toBe("#f59e0b");
  });
  it("returns lime for 0.75 (Boa)", () => {
    expect(csGetTrackColor(0.75)).toBe("#65a30d");
  });
  it("returns emerald for 1.0 (Excelente)", () => {
    expect(csGetTrackColor(1.0)).toBe("#059669");
  });
});

describe("CriteriaSlider - csPenaltyTrackColor", () => {
  it("returns emerald for 0 (sem penalidade = Excelente)", () => {
    expect(csPenaltyTrackColor(0)).toBe("#059669");
  });
  it("returns lime for 0.25 (penalidade leve = Bom)", () => {
    expect(csPenaltyTrackColor(0.25)).toBe("#65a30d");
  });
  it("returns amber for 0.5 (penalidade média = Razoável)", () => {
    expect(csPenaltyTrackColor(0.5)).toBe("#f59e0b");
  });
  it("returns orange for 0.75 (penalidade alta = Fraco)", () => {
    expect(csPenaltyTrackColor(0.75)).toBe("#f97316");
  });
  it("returns red for 1.0 (penalidade máxima = Nenhum)", () => {
    expect(csPenaltyTrackColor(1.0)).toBe("#ef4444");
  });
});

describe("CriteriaSlider - csGetLabel", () => {
  it("returns 'Nenhuma' for 0 (fem)", () => {
    expect(csGetLabel(0, "fem")).toBe("Nenhuma");
  });
  it("returns 'Fraca' for 0.25 (fem)", () => {
    expect(csGetLabel(0.25, "fem")).toBe("Fraca");
  });
  it("returns 'Boa' for 0.75 (fem)", () => {
    expect(csGetLabel(0.75, "fem")).toBe("Boa");
  });
  it("returns 'Nenhum' for 0 (masc)", () => {
    expect(csGetLabel(0, "masc")).toBe("Nenhum");
  });
  it("returns 'Fraco' for 0.25 (masc)", () => {
    expect(csGetLabel(0.25, "masc")).toBe("Fraco");
  });
  it("returns 'Bom' for 0.75 (masc)", () => {
    expect(csGetLabel(0.75, "masc")).toBe("Bom");
  });
  it("returns 'Excelente' for 1.0 (both genders)", () => {
    expect(csGetLabel(1.0, "fem")).toBe("Excelente");
    expect(csGetLabel(1.0, "masc")).toBe("Excelente");
  });
  // Penalty labels
  it("returns 'Excelente' for 0 (penalty = sem penalidade)", () => {
    expect(csGetLabel(0, "masc", true)).toBe("Excelente");
  });
  it("returns 'Nenhum' for 1.0 (penalty = penalidade máxima)", () => {
    expect(csGetLabel(1.0, "masc", true)).toBe("Nenhum");
  });
  it("returns 'Razoável' for 0.5 (penalty)", () => {
    expect(csGetLabel(0.5, "masc", true)).toBe("Razoável");
  });
  it("returns numeric string for unknown value", () => {
    expect(csGetLabel(0.33, "fem")).toBe("0.33");
  });
});

describe("CriteriaSlider - penalty slider inversion logic", () => {
  // The slider position (sliderFrac) for penalty is: 1 - value
  // So value=0 (Excelente, no penalty) → sliderFrac=1 (right side)
  // value=1 (Nenhum, max penalty) → sliderFrac=0 (left side)
  it("value=0 (Excelente) maps to sliderFrac=1 (right)", () => {
    const value = 0;
    const sliderFrac = 1 - value;
    expect(sliderFrac).toBe(1);
  });
  it("value=1 (Nenhum) maps to sliderFrac=0 (left)", () => {
    const value = 1;
    const sliderFrac = 1 - value;
    expect(sliderFrac).toBe(0);
  });
  it("value=0.5 (Razoável) maps to sliderFrac=0.5 (center)", () => {
    const value = 0.5;
    const sliderFrac = 1 - value;
    expect(sliderFrac).toBe(0.5);
  });
  // Clicking at position 0.8 on penalty slider → sliderFrac=0.8 → value=0.2
  it("clicking at 0.8 on penalty slider gives value=0.2", () => {
    const clickPos = 0.8;
    const snapped = Math.round(clickPos * 10) / 10; // 0.8
    const newValue = 1 - snapped; // 0.2
    expect(newValue).toBeCloseTo(0.2);
  });
});

describe("CriteriaSlider - snap points", () => {
  it("has exactly 5 snap points", () => {
    expect(CS_SNAP_POINTS).toHaveLength(5);
  });
  it("snap points are at 0, 0.25, 0.5, 0.75, 1.0", () => {
    expect(CS_SNAP_POINTS).toEqual([0, 0.25, 0.5, 0.75, 1.0]);
  });
  it("snap points correspond to concept labels in fem", () => {
    CS_SNAP_POINTS.forEach(snap => {
      const label = csGetLabel(snap, "fem");
      expect(label).not.toMatch(/^\d/); // should be a word, not a number
    });
  });
});
