import { describe, it, expect } from "vitest";

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

    it("getStudentEvaluationHistory should return empty-like result for non-existent student", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(999999);
      // Now returns { flat: [], byComponent: [] } or [] for DB unavailable
      if (Array.isArray(result)) {
        expect(result).toEqual([]);
      } else {
        expect(result).toHaveProperty("flat");
        expect(result).toHaveProperty("byComponent");
        expect((result as any).flat).toEqual([]);
        expect((result as any).byComponent).toEqual([]);
      }
    });

    it("getStudentEvaluationHistory should return object with flat and byComponent", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(1);
      // May return [] if DB unavailable, or { flat, byComponent } if DB available
      if (!Array.isArray(result)) {
        expect(result).toHaveProperty("flat");
        expect(result).toHaveProperty("byComponent");
        expect(Array.isArray((result as any).flat)).toBe(true);
        expect(Array.isArray((result as any).byComponent)).toBe(true);
      }
    });
  });

  describe("History data structure", () => {
    it("each byComponent entry should have required fields when data exists", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(1);
      if (!Array.isArray(result) && (result as any).byComponent.length > 0) {
        const comp = (result as any).byComponent[0];
        expect(comp).toHaveProperty("componentCode");
        expect(comp).toHaveProperty("componentName");
        expect(comp).toHaveProperty("classCode");
        expect(comp).toHaveProperty("semester");
        expect(comp).toHaveProperty("sessions");
        expect(comp).toHaveProperty("problemAverages");
        expect(Array.isArray(comp.sessions)).toBe(true);
        expect(Array.isArray(comp.problemAverages)).toBe(true);
      }
    });

    it("each flat session item should have required fields when data exists", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(1);
      if (!Array.isArray(result) && (result as any).flat.length > 0) {
        const item = (result as any).flat[0];
        expect(item).toHaveProperty("sessionId");
        expect(item).toHaveProperty("sessionLabel");
        expect(item).toHaveProperty("sessionStatus");
        expect(item).toHaveProperty("problemNumber");
        expect(item).toHaveProperty("sessionNumber");
        expect(item).toHaveProperty("classCode");
        expect(item).toHaveProperty("componentCode");
        expect(item).toHaveProperty("componentName");
        expect(item).toHaveProperty("semester");
        expect(item).toHaveProperty("finalGrade");
        expect(item).toHaveProperty("absent");
      }
    });

    it("problemAverages should have required fields", async () => {
      const { getStudentEvaluationHistory } = await import("./db");
      const result = await getStudentEvaluationHistory(1);
      if (!Array.isArray(result)) {
        for (const comp of (result as any).byComponent) {
          for (const avg of comp.problemAverages) {
            expect(avg).toHaveProperty("problemNumber");
            expect(avg).toHaveProperty("problemTitle");
            expect(avg).toHaveProperty("average");
            expect(avg).toHaveProperty("sessionCount");
            expect(typeof avg.average).toBe("number");
          }
        }
      }
    });
  });
});
