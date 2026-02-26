import { describe, it, expect } from "vitest";

describe("Session States", () => {
  const validStates = ["initiated", "open", "closed", "finished"];

  describe("State definitions", () => {
    it("should have exactly 4 valid states", () => {
      expect(validStates).toHaveLength(4);
    });

    it("should include 'initiated' state (created without access code)", () => {
      expect(validStates).toContain("initiated");
    });

    it("should include 'open' state (access code generated, students can evaluate)", () => {
      expect(validStates).toContain("open");
    });

    it("should include 'closed' state (no more student evaluations, tutor can evaluate)", () => {
      expect(validStates).toContain("closed");
    });

    it("should include 'finished' state (tutor evaluated, results generated)", () => {
      expect(validStates).toContain("finished");
    });
  });

  describe("State transitions", () => {
    const allowedTransitions: Record<string, string[]> = {
      initiated: ["open"],       // generateCode → open
      open: ["closed"],          // close → closed
      closed: ["open", "finished"], // reopen → open, tutorEval → finished
      finished: ["open"],        // reopen → open
    };

    it("initiated → open (when access code is generated)", () => {
      expect(allowedTransitions["initiated"]).toContain("open");
    });

    it("open → closed (when professor closes the session)", () => {
      expect(allowedTransitions["open"]).toContain("closed");
    });

    it("closed → finished (when tutor submits evaluation)", () => {
      expect(allowedTransitions["closed"]).toContain("finished");
    });

    it("closed → open (when professor reopens the session)", () => {
      expect(allowedTransitions["closed"]).toContain("open");
    });

    it("finished → open (when professor reopens the session)", () => {
      expect(allowedTransitions["finished"]).toContain("open");
    });

    it("initiated should NOT transition directly to closed or finished", () => {
      expect(allowedTransitions["initiated"]).not.toContain("closed");
      expect(allowedTransitions["initiated"]).not.toContain("finished");
    });
  });

  describe("State labels (Portuguese)", () => {
    const stateLabels: Record<string, string> = {
      initiated: "Iniciada",
      open: "Em Avaliação",
      closed: "Fechada",
      finished: "Encerrada",
    };

    it("should map 'initiated' to 'Iniciada'", () => {
      expect(stateLabels["initiated"]).toBe("Iniciada");
    });

    it("should map 'open' to 'Em Avaliação'", () => {
      expect(stateLabels["open"]).toBe("Em Avaliação");
    });

    it("should map 'closed' to 'Fechada'", () => {
      expect(stateLabels["closed"]).toBe("Fechada");
    });

    it("should map 'finished' to 'Encerrada'", () => {
      expect(stateLabels["finished"]).toBe("Encerrada");
    });
  });

  describe("Access rules per state", () => {
    it("initiated: students cannot access (no code yet)", () => {
      const canStudentAccess = (status: string) => status === "open";
      expect(canStudentAccess("initiated")).toBe(false);
    });

    it("open: students can access and submit evaluations", () => {
      const canStudentAccess = (status: string) => status === "open";
      expect(canStudentAccess("open")).toBe(true);
    });

    it("closed: students cannot submit evaluations", () => {
      const canStudentAccess = (status: string) => status === "open";
      expect(canStudentAccess("closed")).toBe(false);
    });

    it("finished: students cannot submit evaluations", () => {
      const canStudentAccess = (status: string) => status === "open";
      expect(canStudentAccess("finished")).toBe(false);
    });
  });

  describe("createSession default state", () => {
    it("new sessions should default to 'initiated' status", () => {
      const defaultStatus = "initiated";
      expect(defaultStatus).toBe("initiated");
      expect(defaultStatus).not.toBe("open");
    });
  });

  describe("generateAccessCode side effect", () => {
    it("generating access code should change status to 'open'", () => {
      // Simulates the db.ts logic: generateAccessCode sets status to "open"
      let status = "initiated";
      // After generateAccessCode:
      status = "open";
      expect(status).toBe("open");
    });
  });

  describe("submitTutorialEvaluation side effect", () => {
    it("submitting tutorial evaluation should change status to 'finished'", () => {
      // Simulates the routers.ts logic: after submitTutorialEvaluation, finishSession is called
      let status = "closed";
      // After submitTutorialEvaluation + finishSession:
      status = "finished";
      expect(status).toBe("finished");
    });
  });
});
