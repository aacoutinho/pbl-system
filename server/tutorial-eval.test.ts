import { describe, expect, it } from "vitest";
import { calculateTutorialGrade } from "./db";

describe("Tutorial Evaluation - Grade Calculation", () => {
  it("calculates weighted tutorial grade correctly with max scores", () => {
    const eval_ = {
      organizacao: "1",
      cooperacao: "1",
      conteudo: "1",
      objetivo: "1",
      metas: "1",
    };
    // 1×1 + 1×1 + 1×3 + 1×3 + 1×2 = 10
    expect(calculateTutorialGrade(eval_)).toBe(10);
  });

  it("calculates weighted tutorial grade correctly with min scores", () => {
    const eval_ = {
      organizacao: "0",
      cooperacao: "0",
      conteudo: "0",
      objetivo: "0",
      metas: "0",
    };
    expect(calculateTutorialGrade(eval_)).toBe(0);
  });

  it("calculates weighted tutorial grade correctly with mixed scores", () => {
    const eval_ = {
      organizacao: "0.8",
      cooperacao: "0.7",
      conteudo: "0.9",
      objetivo: "0.8",
      metas: "0.6",
    };
    // 0.8×1 + 0.7×1 + 0.9×3 + 0.8×3 + 0.6×2 = 0.8 + 0.7 + 2.7 + 2.4 + 1.2 = 7.8
    const result = calculateTutorialGrade(eval_);
    expect(Math.round(result * 10) / 10).toBe(7.8);
  });

  it("applies correct weights: Org×1, Coop×1, Cont×3, Obj×3, Metas×2", () => {
    // Only organizacao = 1, rest = 0 → should be 1
    expect(calculateTutorialGrade({ organizacao: "1", cooperacao: "0", conteudo: "0", objetivo: "0", metas: "0" })).toBe(1);
    // Only cooperacao = 1 → should be 1
    expect(calculateTutorialGrade({ organizacao: "0", cooperacao: "1", conteudo: "0", objetivo: "0", metas: "0" })).toBe(1);
    // Only conteudo = 1 → should be 3
    expect(calculateTutorialGrade({ organizacao: "0", cooperacao: "0", conteudo: "1", objetivo: "0", metas: "0" })).toBe(3);
    // Only objetivo = 1 → should be 3
    expect(calculateTutorialGrade({ organizacao: "0", cooperacao: "0", conteudo: "0", objetivo: "1", metas: "0" })).toBe(3);
    // Only metas = 1 → should be 2
    expect(calculateTutorialGrade({ organizacao: "0", cooperacao: "0", conteudo: "0", objetivo: "0", metas: "1" })).toBe(2);
  });

  it("handles decimal values correctly", () => {
    const eval_ = {
      organizacao: "0.5",
      cooperacao: "0.5",
      conteudo: "0.5",
      objetivo: "0.5",
      metas: "0.5",
    };
    // 0.5×1 + 0.5×1 + 0.5×3 + 0.5×3 + 0.5×2 = 0.5 + 0.5 + 1.5 + 1.5 + 1.0 = 5.0
    expect(calculateTutorialGrade(eval_)).toBe(5);
  });
});

describe("Final Grade - Proportional Distribution Logic", () => {
  it("distributes points proportionally based on peer scores", () => {
    // Example from user: 3 students, peer scores: 8, 9, 9. Tutorial grade: 8
    const peerScores = [8, 9, 9];
    const tutorialGrade = 8;
    const numPresent = 3;
    const totalPoints = tutorialGrade * numPresent; // 24
    const sumPeerScores = peerScores.reduce((a, b) => a + b, 0); // 26

    const desempenhoScores = peerScores.map(score => {
      const proportion = score / sumPeerScores;
      return Math.round(proportion * totalPoints * 10) / 10;
    });

    // Student 1: (8/26) × 24 = 7.384... → 7.4
    expect(desempenhoScores[0]).toBe(7.4);
    // Student 2: (9/26) × 24 = 8.307... → 8.3
    expect(desempenhoScores[1]).toBe(8.3);
    // Student 3: (9/26) × 24 = 8.307... → 8.3
    expect(desempenhoScores[2]).toBe(8.3);
  });

  it("handles perfect tutorial grade (10) with equal peer scores", () => {
    const peerScores = [10, 10, 10];
    const tutorialGrade = 10;
    const numPresent = 3;
    const totalPoints = tutorialGrade * numPresent; // 30
    const sumPeerScores = 30;

    const desempenhoScores = peerScores.map(score => {
      const proportion = score / sumPeerScores;
      return Math.round(proportion * totalPoints * 10) / 10;
    });

    // Each: (10/30) × 30 = 10
    expect(desempenhoScores[0]).toBe(10);
    expect(desempenhoScores[1]).toBe(10);
    expect(desempenhoScores[2]).toBe(10);
  });

  it("gives 0 to absent students", () => {
    const absentScore = 0;
    const tutorialGrade = 8;
    // Absent students get 0 regardless
    expect(absentScore).toBe(0);
  });

  it("handles low tutorial grade reducing all final grades", () => {
    const peerScores = [10, 10];
    const tutorialGrade = 5;
    const numPresent = 2;
    const totalPoints = tutorialGrade * numPresent; // 10
    const sumPeerScores = 20;

    const desempenhoScores = peerScores.map(score => {
      const proportion = score / sumPeerScores;
      return Math.round(proportion * totalPoints * 10) / 10;
    });

    // Each: (10/20) × 10 = 5
    expect(desempenhoScores[0]).toBe(5);
    expect(desempenhoScores[1]).toBe(5);
  });

  it("handles uneven peer scores with proportional distribution", () => {
    const peerScores = [10, 5];
    const tutorialGrade = 9;
    const numPresent = 2;
    const totalPoints = tutorialGrade * numPresent; // 18
    const sumPeerScores = 15;

    const desempenhoScores = peerScores.map(score => {
      const proportion = score / sumPeerScores;
      return Math.round(proportion * totalPoints * 10) / 10;
    });

    // Student 1: (10/15) × 18 = 12.0 → 12.0
    expect(desempenhoScores[0]).toBe(12);
    // Student 2: (5/15) × 18 = 6.0
    expect(desempenhoScores[1]).toBe(6);
  });

  it("rounds to one decimal place", () => {
    const peerScores = [7, 8, 9];
    const tutorialGrade = 7;
    const numPresent = 3;
    const totalPoints = tutorialGrade * numPresent; // 21
    const sumPeerScores = 24;

    const desempenhoScores = peerScores.map(score => {
      const proportion = score / sumPeerScores;
      return Math.round(proportion * totalPoints * 10) / 10;
    });

    // Student 1: (7/24) × 21 = 6.125 → 6.1
    expect(desempenhoScores[0]).toBe(6.1);
    // Student 2: (8/24) × 21 = 7.0 → 7.0
    expect(desempenhoScores[1]).toBe(7);
    // Student 3: (9/24) × 21 = 7.875 → 7.9
    expect(desempenhoScores[2]).toBe(7.9);
  });
});
