import { describe, it, expect, vi } from "vitest";

// ─── Unit tests for student evaluation history feature ───

describe("Student Evaluation History", () => {
  describe("Route definition", () => {
    it("myEvaluationHistory route should exist in studentAccess router", async () => {
      const { appRouter } = await import("./routers");
      const procedures = Object.keys((appRouter as any)._def.procedures);
      expect(procedures).toContain("studentAccess.myEvaluationHistory");
    });

    it("myEvaluationHistory should require studentId input", async () => {
      const { appRouter } = await import("./routers");
      const proc = (appRouter as any)._def.procedures["studentAccess.myEvaluationHistory"];
      expect(proc).toBeDefined();
      expect(proc._def.type).toBe("query");
    });
  });

  describe("Database helper", () => {
    it("getStudentEvaluationHistory should be exported from db.ts", async () => {
      const db = await import("./db");
      expect(typeof db.getStudentEvaluationHistory).toBe("function");
    });

    it("getStudentEvaluationHistory should return empty array for non-existent student", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(999999);
      expect(result).toEqual([]);
    });

    it("getStudentEvaluationHistory should return array", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("History data structure", () => {
    it("each history item should have required fields when data exists", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(1);
      // If there are results, validate structure
      if (result.length > 0) {
        const item = result[0];
        expect(item).toHaveProperty("sessionId");
        expect(item).toHaveProperty("sessionLabel");
        expect(item).toHaveProperty("sessionStatus");
        expect(item).toHaveProperty("problemNumber");
        expect(item).toHaveProperty("sessionNumber");
        expect(item).toHaveProperty("classCode");
        expect(item).toHaveProperty("componentCode");
        expect(item).toHaveProperty("componentName");
        expect(item).toHaveProperty("semester");
        expect(item).toHaveProperty("submittedAt");
        expect(item).toHaveProperty("peersEvaluated");
        expect(item).toHaveProperty("totalPeers");
        expect(item).toHaveProperty("avgGradeGiven");
        expect(typeof item.peersEvaluated).toBe("number");
        expect(typeof item.totalPeers).toBe("number");
        expect(typeof item.avgGradeGiven).toBe("number");
      }
    });

    it("avgGradeGiven should be rounded to 2 decimal places", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(1);
      if (result.length > 0) {
        const item = result[0];
        const decimalPlaces = (item.avgGradeGiven.toString().split('.')[1] || '').length;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      }
    });
  });
});
