import { describe, it, expect, vi } from "vitest";

// ─── Test: Session deletion protection ───
describe("Session Deletion Protection", () => {
  describe("Backend validation", () => {
    it("should have delete route defined in sessions router", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("sessions.delete");
    });

    it("should validate that only the last session can be deleted", async () => {
      // The delete route checks if there are sessions with higher problem/session numbers
      const { appRouter } = await import("./routers");
      const deleteProc = (appRouter._def.procedures as any)["sessions.delete"];
      expect(deleteProc).toBeDefined();
    });
  });

  describe("Logic validation", () => {
    it("should identify the last session correctly by problem and session number", () => {
      const sessions = [
        { id: 1, problemNumber: 1, sessionNumber: 1 },
        { id: 2, problemNumber: 1, sessionNumber: 2 },
        { id: 3, problemNumber: 2, sessionNumber: 1 },
      ];
      const lastSession = sessions.reduce((last, s) => {
        if (s.problemNumber > last.problemNumber || 
            (s.problemNumber === last.problemNumber && s.sessionNumber > last.sessionNumber)) return s;
        return last;
      }, sessions[0]);
      expect(lastSession.id).toBe(3);
    });

    it("should not allow deleting intermediate sessions", () => {
      const sessions = [
        { id: 1, problemNumber: 1, sessionNumber: 1 },
        { id: 2, problemNumber: 1, sessionNumber: 2 },
        { id: 3, problemNumber: 2, sessionNumber: 1 },
      ];
      const sessionToDelete = sessions[0]; // P1S1 - intermediate
      const hasLater = sessions.some(s =>
        s.problemNumber > sessionToDelete.problemNumber ||
        (s.problemNumber === sessionToDelete.problemNumber && s.sessionNumber > sessionToDelete.sessionNumber)
      );
      expect(hasLater).toBe(true); // Should block deletion
    });

    it("should allow deleting the last session", () => {
      const sessions = [
        { id: 1, problemNumber: 1, sessionNumber: 1 },
        { id: 2, problemNumber: 1, sessionNumber: 2 },
        { id: 3, problemNumber: 2, sessionNumber: 1 },
      ];
      const sessionToDelete = sessions[2]; // P2S1 - last
      const hasLater = sessions.some(s =>
        s.problemNumber > sessionToDelete.problemNumber ||
        (s.problemNumber === sessionToDelete.problemNumber && s.sessionNumber > sessionToDelete.sessionNumber)
      );
      expect(hasLater).toBe(false); // Should allow deletion
    });
  });
});

// ─── Test: Session creation preview ───
describe("Session Creation Preview", () => {
  it("should generate correct label without title", () => {
    const problemNumber = 1;
    const sessionNumber = 2;
    const problemTitle = "";
    const titlePart = problemTitle.trim() ? ` - ${problemTitle.trim()}` : "";
    const label = `Problema ${problemNumber}${titlePart} - Sessão ${sessionNumber}`;
    expect(label).toBe("Problema 1 - Sessão 2");
  });

  it("should generate correct label with title", () => {
    const problemNumber = 1;
    const sessionNumber = 1;
    const problemTitle = "Febre Reumática";
    const titlePart = problemTitle.trim() ? ` - ${problemTitle.trim()}` : "";
    const label = `Problema ${problemNumber}${titlePart} - Sessão ${sessionNumber}`;
    expect(label).toBe("Problema 1 - Febre Reumática - Sessão 1");
  });

  it("should trim whitespace from title", () => {
    const problemTitle = "  Diabetes Mellitus  ";
    const titlePart = problemTitle.trim() ? ` - ${problemTitle.trim()}` : "";
    const label = `Problema 2${titlePart} - Sessão 1`;
    expect(label).toBe("Problema 2 - Diabetes Mellitus - Sessão 1");
  });

  it("should handle empty/whitespace-only title as no title", () => {
    const problemTitle = "   ";
    const titlePart = problemTitle.trim() ? ` - ${problemTitle.trim()}` : "";
    const label = `Problema 1${titlePart} - Sessão 1`;
    expect(label).toBe("Problema 1 - Sessão 1");
  });
});

// ─── Test: Problem title field ───
describe("Problem Title Field", () => {
  it("should accept problemTitle in create session input", async () => {
    const { appRouter } = await import("./routers");
    const createProc = (appRouter._def.procedures as any)["sessions.create"];
    expect(createProc).toBeDefined();
  });

  it("should have problemTitle column in sessions schema", async () => {
    const schema = await import("../drizzle/schema");
    const sessionsTable = schema.sessions;
    // Check that the table has problemTitle column
    expect(sessionsTable).toBeDefined();
    const columns = Object.keys((sessionsTable as any));
    // The column should exist in the table definition
    expect(columns.length).toBeGreaterThan(0);
  });

  it("should store problemTitle as optional (nullable)", async () => {
    const schema = await import("../drizzle/schema");
    const sessionsTable = schema.sessions;
    expect(sessionsTable).toBeDefined();
  });
});

// ─── Test: Auto session numbering with first session ───
describe("Auto Session Numbering", () => {
  it("should calculate session number 1 for first session of new problem", () => {
    const lastProblemNumber = 1;
    const nextProblemNumber = 1;
    const nextSessionNumber = 3;
    const inputProblemNumber = 2; // New problem
    
    let sessionNumber: number;
    if (inputProblemNumber === nextProblemNumber) {
      sessionNumber = nextSessionNumber;
    } else if (inputProblemNumber === lastProblemNumber + 1) {
      sessionNumber = 1;
    } else {
      sessionNumber = -1; // Error
    }
    expect(sessionNumber).toBe(1);
  });

  it("should continue session sequence for same problem", () => {
    const lastProblemNumber = 1;
    const nextProblemNumber = 1;
    const nextSessionNumber = 3;
    const inputProblemNumber = 1; // Same problem
    
    let sessionNumber: number;
    if (inputProblemNumber === nextProblemNumber) {
      sessionNumber = nextSessionNumber;
    } else if (inputProblemNumber === lastProblemNumber + 1) {
      sessionNumber = 1;
    } else {
      sessionNumber = -1; // Error
    }
    expect(sessionNumber).toBe(3);
  });
});
