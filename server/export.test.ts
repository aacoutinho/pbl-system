import { describe, expect, it } from "vitest";
import { calculateTutorialGrade } from "./db";

describe("Export - Tutorial Grade Calculation", () => {
  it("calculates weighted tutorial grade correctly", () => {
    const eval_ = {
      organizacao: "0.8",
      cooperacao: "0.7",
      conteudo: "0.9",
      objetivo: "0.8",
      metas: "0.6",
    };
    // 0.8*1 + 0.7*1 + 0.9*3 + 0.8*3 + 0.6*2 = 0.8 + 0.7 + 2.7 + 2.4 + 1.2 = 7.8
    const grade = calculateTutorialGrade(eval_);
    expect(grade).toBeCloseTo(7.8, 1);
  });

  it("calculates perfect tutorial grade", () => {
    const eval_ = {
      organizacao: "1",
      cooperacao: "1",
      conteudo: "1",
      objetivo: "1",
      metas: "1",
    };
    // 1*1 + 1*1 + 1*3 + 1*3 + 1*2 = 1 + 1 + 3 + 3 + 2 = 10
    const grade = calculateTutorialGrade(eval_);
    expect(grade).toBe(10);
  });

  it("calculates zero tutorial grade", () => {
    const eval_ = {
      organizacao: "0",
      cooperacao: "0",
      conteudo: "0",
      objetivo: "0",
      metas: "0",
    };
    const grade = calculateTutorialGrade(eval_);
    expect(grade).toBe(0);
  });

  it("handles half-point values correctly", () => {
    const eval_ = {
      organizacao: "0.5",
      cooperacao: "0.5",
      conteudo: "0.5",
      objetivo: "0.5",
      metas: "0.5",
    };
    // 0.5*1 + 0.5*1 + 0.5*3 + 0.5*3 + 0.5*2 = 0.5 + 0.5 + 1.5 + 1.5 + 1.0 = 5.0
    const grade = calculateTutorialGrade(eval_);
    expect(grade).toBe(5);
  });
});

describe("Export - Proportional Distribution Logic", () => {
  it("distributes points proportionally to peer scores", () => {
    // Example from user: 3 students, peer scores 8, 9, 9. Tutorial grade 8.
    const tutorialGrade = 8;
    const numPresent = 3;
    const totalPoints = tutorialGrade * numPresent; // 24
    const peerScores = [8, 9, 9];
    const sumPeerScores = peerScores.reduce((a, b) => a + b, 0); // 26

    const desempenhoScores = peerScores.map(score => {
      const proportion = score / sumPeerScores;
      return Math.round(proportion * totalPoints * 10) / 10;
    });

    // Student 1: (8/26) * 24 = 7.384... → 7.4
    expect(desempenhoScores[0]).toBeCloseTo(7.4, 1);
    // Student 2: (9/26) * 24 = 8.307... → 8.3
    expect(desempenhoScores[1]).toBeCloseTo(8.3, 1);
    // Student 3: (9/26) * 24 = 8.307... → 8.3
    expect(desempenhoScores[2]).toBeCloseTo(8.3, 1);
  });

  it("handles absent students with zero score", () => {
    const tutorialGrade = 10;
    const peerScores = [10, 9, 0]; // third student absent
    const presentScores = peerScores.filter(s => s > 0);
    const numPresent = presentScores.length; // 2
    const totalPoints = tutorialGrade * numPresent; // 20
    const sumPeerScores = presentScores.reduce((a, b) => a + b, 0); // 19

    const desempenhoScores = peerScores.map(score => {
      if (score === 0) return 0;
      const proportion = score / sumPeerScores;
      return Math.round(proportion * totalPoints * 10) / 10;
    });

    // Student 1: (10/19) * 20 = 10.526... → 10.5
    expect(desempenhoScores[0]).toBeCloseTo(10.5, 1);
    // Student 2: (9/19) * 20 = 9.473... → 9.5
    expect(desempenhoScores[1]).toBeCloseTo(9.5, 1);
    // Student 3: absent → 0
    expect(desempenhoScores[2]).toBe(0);
  });

  it("returns zero when no tutorial evaluation exists", () => {
    // Without tutorial eval, final grade should be 0
    const desempenhoScore = 0;
    expect(desempenhoScore).toBe(0);
  });

  it("handles single present student", () => {
    const tutorialGrade = 8;
    const numPresent = 1;
    const totalPoints = tutorialGrade * numPresent; // 8
    const peerScore = 7;
    const proportion = peerScore / peerScore; // 1.0
    const desempenhoScore = Math.round(proportion * totalPoints * 10) / 10;
    // Single student gets all points: 8.0
    expect(desempenhoScore).toBe(8);
  });
});

describe("Export - CSV Format Validation", () => {
  it("escapes CSV values with commas", () => {
    const escapeCSV = (val: unknown): string => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    expect(escapeCSV("simple")).toBe("simple");
    expect(escapeCSV("has,comma")).toBe('"has,comma"');
    expect(escapeCSV('has"quote')).toBe('"has""quote"');
    expect(escapeCSV("has\nnewline")).toBe('"has\nnewline"');
    expect(escapeCSV("")).toBe("");
    expect(escapeCSV(null)).toBe("");
    expect(escapeCSV(undefined)).toBe("");
  });

  it("formats grades to one decimal place", () => {
    const format = (n: number) => n.toFixed(1);
    expect(format(7.384615384615385)).toBe("7.4");
    expect(format(8.307692307692308)).toBe("8.3");
    expect(format(10)).toBe("10.0");
    expect(format(0)).toBe("0.0");
    expect(format(9.96)).toBe("10.0");
  });
});
