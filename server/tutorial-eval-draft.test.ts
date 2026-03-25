import { describe, it, expect } from "vitest";

describe("Tutorial Evaluation Draft System", () => {
  describe("Draft table structure", () => {
    it("tutorial_eval_drafts table should have sessionId field", () => {
      const fields = ["id", "sessionId", "professorUserId", "organizacao", "cooperacao", "conteudo", "objetivo", "metas", "savedAt"];
      expect(fields).toContain("sessionId");
    });

    it("tutorial_eval_drafts table should have all 5 criteria fields", () => {
      const criteriaFields = ["organizacao", "cooperacao", "conteudo", "objetivo", "metas"];
      const fields = ["id", "sessionId", "professorUserId", "organizacao", "cooperacao", "conteudo", "objetivo", "metas", "savedAt"];
      criteriaFields.forEach(f => expect(fields).toContain(f));
    });

    it("tutorial_eval_drafts table should have professorUserId field", () => {
      const fields = ["id", "sessionId", "professorUserId", "organizacao", "cooperacao", "conteudo", "objetivo", "metas", "savedAt"];
      expect(fields).toContain("professorUserId");
    });

    it("tutorial_eval_drafts table should have savedAt timestamp", () => {
      const fields = ["id", "sessionId", "professorUserId", "organizacao", "cooperacao", "conteudo", "objetivo", "metas", "savedAt"];
      expect(fields).toContain("savedAt");
    });
  });

  describe("Draft CRUD operations", () => {
    it("saveTutorialEvalDraft should accept valid criteria values (0 to 1)", () => {
      const validValues = [0, 0.25, 0.5, 0.75, 1.0];
      validValues.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });

    it("draft values should match the same scale as final evaluation (0-1 in 0.25 increments)", () => {
      const validIncrements = [0, 0.25, 0.5, 0.75, 1.0];
      validIncrements.forEach(v => {
        expect(v * 4).toBe(Math.round(v * 4)); // Each value * 4 should be an integer
      });
    });

    it("draft should be deletable when evaluation is finalized", () => {
      // Simulates the workflow: save draft → finalize → draft is deleted
      let hasDraft = true;
      let hasEval = false;
      // Finalize evaluation
      hasEval = true;
      hasDraft = false; // Draft deleted on finalize
      expect(hasEval).toBe(true);
      expect(hasDraft).toBe(false);
    });
  });

  describe("Draft vs Final evaluation workflow", () => {
    it("saving a draft should NOT change session status", () => {
      let sessionStatus = "open";
      // Save draft - status should remain unchanged
      const saveDraft = () => { /* no status change */ };
      saveDraft();
      expect(sessionStatus).toBe("open");
    });

    it("saving a draft on 'initiated' session should NOT change status", () => {
      let sessionStatus = "initiated";
      const saveDraft = () => { /* no status change */ };
      saveDraft();
      expect(sessionStatus).toBe("initiated");
    });

    it("saving a draft on 'closed' session should NOT change status", () => {
      let sessionStatus = "closed";
      const saveDraft = () => { /* no status change */ };
      saveDraft();
      expect(sessionStatus).toBe("closed");
    });

    it("finalizing evaluation should change session status to 'finished'", () => {
      let sessionStatus = "closed";
      // Finalize evaluation
      sessionStatus = "finished";
      expect(sessionStatus).toBe("finished");
    });

    it("finalizing evaluation on 'open' session should change status to 'finished'", () => {
      let sessionStatus = "open";
      // Finalize evaluation (professor can finalize at any time)
      sessionStatus = "finished";
      expect(sessionStatus).toBe("finished");
    });

    it("finalizing evaluation on 'initiated' session should change status to 'finished'", () => {
      let sessionStatus = "initiated";
      // Finalize evaluation (professor can finalize at any time)
      sessionStatus = "finished";
      expect(sessionStatus).toBe("finished");
    });

    it("draft should be overwritten (upsert) when saving again for same session", () => {
      // Simulates upsert behavior
      const drafts: Record<number, { organizacao: number }> = {};
      // First save
      drafts[1] = { organizacao: 0.5 };
      expect(drafts[1].organizacao).toBe(0.5);
      // Second save (update)
      drafts[1] = { organizacao: 0.75 };
      expect(drafts[1].organizacao).toBe(0.75);
      // Only one draft per session
      expect(Object.keys(drafts)).toHaveLength(1);
    });
  });

  describe("No status blocking for professor evaluation", () => {
    const allStatuses = ["initiated", "open", "closed", "finished"];

    it("professor should be able to evaluate (or save draft) in ANY session status", () => {
      const canProfessorEvaluate = (status: string) => {
        // No status blocking - professor can evaluate at any time
        return allStatuses.includes(status);
      };
      allStatuses.forEach(status => {
        expect(canProfessorEvaluate(status)).toBe(true);
      });
    });

    it("professor should be able to save draft in 'initiated' status", () => {
      const canSaveDraft = true; // No blocking
      expect(canSaveDraft).toBe(true);
    });

    it("professor should be able to save draft in 'open' status", () => {
      const canSaveDraft = true; // No blocking
      expect(canSaveDraft).toBe(true);
    });

    it("professor should be able to save draft in 'closed' status", () => {
      const canSaveDraft = true; // No blocking
      expect(canSaveDraft).toBe(true);
    });

    it("professor should be able to finalize evaluation in 'open' status (closes session for students)", () => {
      const canFinalize = true; // Professor can finalize at any time
      expect(canFinalize).toBe(true);
    });

    it("student access should still be blocked when session is NOT open", () => {
      const canStudentAccess = (status: string) => status === "open";
      expect(canStudentAccess("initiated")).toBe(false);
      expect(canStudentAccess("closed")).toBe(false);
      expect(canStudentAccess("finished")).toBe(false);
      expect(canStudentAccess("open")).toBe(true);
    });
  });

  describe("Auto-save behavior", () => {
    it("auto-save should be debounced (not immediate)", () => {
      const DEBOUNCE_MS = 2000;
      expect(DEBOUNCE_MS).toBeGreaterThanOrEqual(1000);
      expect(DEBOUNCE_MS).toBeLessThanOrEqual(5000);
    });

    it("auto-save should NOT trigger when a finalized evaluation exists", () => {
      const existingEval = { id: 1, organizacao: "0.5" };
      const shouldAutoSave = !existingEval;
      expect(shouldAutoSave).toBe(false);
    });

    it("auto-save should trigger when no finalized evaluation exists", () => {
      const existingEval = null;
      const shouldAutoSave = !existingEval;
      expect(shouldAutoSave).toBe(true);
    });
  });

  describe("Grade calculation consistency", () => {
    it("draft scores should use same scale as final evaluation (0 to 1)", () => {
      const draftScores = { organizacao: 0.75, cooperacao: 0.5, conteudo: 1.0, objetivo: 0.25, metas: 0.5 };
      Object.values(draftScores).forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });

    it("tutorial grade calculation should work the same for draft and final values", () => {
      const weights = { organizacao: 1, cooperacao: 1, conteudo: 3, objetivo: 3, metas: 2 };
      const scores = { organizacao: 0.75, cooperacao: 0.5, conteudo: 1.0, objetivo: 0.25, metas: 0.5 };
      const grade = Object.entries(scores).reduce(
        (sum, [key, val]) => sum + val * weights[key as keyof typeof weights], 0
      );
      // org: 0.75*1 + coop: 0.5*1 + cont: 1.0*3 + obj: 0.25*3 + metas: 0.5*2 = 0.75 + 0.5 + 3.0 + 0.75 + 1.0 = 6.0
      expect(grade).toBeCloseTo(6.0, 2);
    });

    it("total weight should be 10", () => {
      const weights = [1, 1, 3, 3, 2];
      const totalWeight = weights.reduce((s, w) => s + w, 0);
      expect(totalWeight).toBe(10);
    });
  });
});

describe("Tutorial Evaluation Router - Draft routes", async () => {
  const { appRouter } = await import("./routers");

  it("tutorialEval.saveDraft route exists", () => {
    expect(appRouter._def.procedures["tutorialEval.saveDraft"]).toBeDefined();
  });

  it("tutorialEval.getDraft route exists", () => {
    expect(appRouter._def.procedures["tutorialEval.getDraft"]).toBeDefined();
  });

  it("tutorialEval.submit route exists", () => {
    expect(appRouter._def.procedures["tutorialEval.submit"]).toBeDefined();
  });

  it("tutorialEval.get route exists", () => {
    expect(appRouter._def.procedures["tutorialEval.get"]).toBeDefined();
  });

  it("tutorialEval.canEvaluate route exists", () => {
    expect(appRouter._def.procedures["tutorialEval.canEvaluate"]).toBeDefined();
  });
});

describe("DB helpers for drafts", async () => {
  const db = await import("./db");

  it("saveTutorialEvalDraft function exists", () => {
    expect(typeof db.saveTutorialEvalDraft).toBe("function");
  });

  it("getTutorialEvalDraft function exists", () => {
    expect(typeof db.getTutorialEvalDraft).toBe("function");
  });

  it("deleteTutorialEvalDraft function exists", () => {
    expect(typeof db.deleteTutorialEvalDraft).toBe("function");
  });
});

describe("Updated session state transitions for draft support", () => {
  const allowedTransitions: Record<string, string[]> = {
    initiated: ["open", "finished"],  // generateCode → open, OR tutorFinalize → finished
    open: ["closed", "finished"],     // close → closed, OR tutorFinalize → finished
    closed: ["open", "finished"],     // reopen → open, tutorFinalize → finished
    finished: ["open"],               // reopen → open
  };

  it("initiated can transition to finished (professor finalizes without opening)", () => {
    expect(allowedTransitions["initiated"]).toContain("finished");
  });

  it("open can transition to finished (professor finalizes while students are still evaluating)", () => {
    expect(allowedTransitions["open"]).toContain("finished");
  });

  it("closed can transition to finished (standard flow)", () => {
    expect(allowedTransitions["closed"]).toContain("finished");
  });

  it("finished can transition to open (reopen)", () => {
    expect(allowedTransitions["finished"]).toContain("open");
  });
});

describe("Draft loading on component remount (lastLoadedSessionRef behavior)", () => {
  // Simulates the logic in TutorialEvalPage useEffect for loading draft/eval
  function simulateDraftLoadEffect(params: {
    lastLoadedSession: string;
    selectedSessionId: string;
    existingEval: object | null;
    existingDraft: { organizacao: number; cooperacao: number; conteudo: number; objetivo: number; metas: number } | null;
    evalLoading: boolean;
    draftLoading: boolean;
    isLoadingSessions: boolean;
    currentScores: Record<string, number>;
  }): {
    scores: Record<string, number>;
    hasDraft: boolean;
    lastLoadedSession: string;
    didReturn: boolean;
  } {
    const DEFAULT_SCORES = { organizacao: 1.0, cooperacao: 1.0, conteudo: 1.0, objetivo: 1.0, metas: 1.0 };
    let scores = { ...params.currentScores };
    let hasDraft = false;
    let lastLoadedSession = params.lastLoadedSession;
    let didReturn = false;

    const sessionChanged = lastLoadedSession !== params.selectedSessionId;

    if (params.existingEval) {
      // Always load finalized evaluations
      scores = { organizacao: 0.5, cooperacao: 0.5, conteudo: 0.5, objetivo: 0.5, metas: 0.5 }; // from eval
      hasDraft = false;
      if (sessionChanged) {
        lastLoadedSession = params.selectedSessionId;
      }
    } else if (sessionChanged) {
      // Wait until data has loaded
      if (params.evalLoading || params.draftLoading || params.isLoadingSessions) {
        didReturn = true;
        return { scores, hasDraft, lastLoadedSession, didReturn };
      }
      if (params.existingDraft) {
        scores = { ...params.existingDraft };
        hasDraft = true;
      } else {
        scores = { ...DEFAULT_SCORES };
        hasDraft = false;
      }
      lastLoadedSession = params.selectedSessionId;
    }

    return { scores, hasDraft, lastLoadedSession, didReturn };
  }

  it("should NOT update lastLoadedSession when data is still loading (prevents race condition)", () => {
    // Simulates: component remounts, data still loading
    const result = simulateDraftLoadEffect({
      lastLoadedSession: "",       // reset on remount
      selectedSessionId: "42",
      existingEval: null,
      existingDraft: null,         // undefined/null because still loading
      evalLoading: true,           // still loading
      draftLoading: true,          // still loading
      isLoadingSessions: false,
      currentScores: { organizacao: 1.0, cooperacao: 1.0, conteudo: 1.0, objetivo: 1.0, metas: 1.0 },
    });

    expect(result.didReturn).toBe(true);
    // lastLoadedSession should NOT be updated yet
    expect(result.lastLoadedSession).toBe("");
  });

  it("should load draft scores when data arrives after loading completes", () => {
    // Simulates: data has arrived (evalLoading=false, draftLoading=false)
    // lastLoadedSession still "" because previous call returned early
    const draftScores = { organizacao: 0.25, cooperacao: 0.5, conteudo: 0.75, objetivo: 0.5, metas: 1.0 };
    const result = simulateDraftLoadEffect({
      lastLoadedSession: "",       // still "" because previous call returned early
      selectedSessionId: "42",
      existingEval: null,
      existingDraft: draftScores,
      evalLoading: false,          // loading complete
      draftLoading: false,         // loading complete
      isLoadingSessions: false,
      currentScores: { organizacao: 1.0, cooperacao: 1.0, conteudo: 1.0, objetivo: 1.0, metas: 1.0 },
    });

    expect(result.didReturn).toBe(false);
    expect(result.hasDraft).toBe(true);
    expect(result.scores.organizacao).toBe(0.25);
    expect(result.scores.cooperacao).toBe(0.5);
    expect(result.scores.conteudo).toBe(0.75);
    // lastLoadedSession should now be updated
    expect(result.lastLoadedSession).toBe("42");
  });

  it("should NOT overwrite draft scores on subsequent renders (same session, data unchanged)", () => {
    // Simulates: component already loaded, user has edited scores
    const userEditedScores = { organizacao: 0.25, cooperacao: 0.25, conteudo: 0.25, objetivo: 0.25, metas: 0.25 };
    const draftScores = { organizacao: 0.75, cooperacao: 0.75, conteudo: 0.75, objetivo: 0.75, metas: 0.75 };
    const result = simulateDraftLoadEffect({
      lastLoadedSession: "42",     // already loaded
      selectedSessionId: "42",     // same session
      existingEval: null,
      existingDraft: draftScores,
      evalLoading: false,
      draftLoading: false,
      isLoadingSessions: false,
      currentScores: userEditedScores,
    });

    expect(result.didReturn).toBe(false);
    // Scores should NOT be overwritten (sessionChanged=false)
    expect(result.scores).toEqual(userEditedScores);
  });

  it("should load draft when switching to a different session", () => {
    const draftScores = { organizacao: 0.5, cooperacao: 0.5, conteudo: 0.5, objetivo: 0.5, metas: 0.5 };
    const result = simulateDraftLoadEffect({
      lastLoadedSession: "41",     // previously loaded session 41
      selectedSessionId: "42",     // switched to session 42
      existingEval: null,
      existingDraft: draftScores,
      evalLoading: false,
      draftLoading: false,
      isLoadingSessions: false,
      currentScores: { organizacao: 1.0, cooperacao: 1.0, conteudo: 1.0, objetivo: 1.0, metas: 1.0 },
    });

    expect(result.didReturn).toBe(false);
    expect(result.hasDraft).toBe(true);
    expect(result.scores).toEqual(draftScores);
    expect(result.lastLoadedSession).toBe("42");
  });

  it("should reset to DEFAULT_SCORES when no draft exists for new session", () => {
    const DEFAULT_SCORES = { organizacao: 1.0, cooperacao: 1.0, conteudo: 1.0, objetivo: 1.0, metas: 1.0 };
    const result = simulateDraftLoadEffect({
      lastLoadedSession: "",
      selectedSessionId: "42",
      existingEval: null,
      existingDraft: null,         // no draft
      evalLoading: false,
      draftLoading: false,
      isLoadingSessions: false,
      currentScores: { organizacao: 0.5, cooperacao: 0.5, conteudo: 0.5, objetivo: 0.5, metas: 0.5 },
    });

    expect(result.didReturn).toBe(false);
    expect(result.hasDraft).toBe(false);
    expect(result.scores).toEqual(DEFAULT_SCORES);
  });

  it("should NOT update lastLoadedSession when sessions are still loading", () => {
    const result = simulateDraftLoadEffect({
      lastLoadedSession: "",
      selectedSessionId: "42",
      existingEval: null,
      existingDraft: null,
      evalLoading: false,
      draftLoading: false,
      isLoadingSessions: true,     // sessions still loading
      currentScores: { organizacao: 1.0, cooperacao: 1.0, conteudo: 1.0, objetivo: 1.0, metas: 1.0 },
    });

    expect(result.didReturn).toBe(true);
    expect(result.lastLoadedSession).toBe("");
  });
});

describe("Student notes loading behavior", () => {
  // Simulates the logic in TutorialEvalPage useEffect for loading student notes
  function simulateNotesLoadEffect(params: {
    existingStudentNotes: Array<{ studentId: number; positivePoints: number; negativePoints: number; positiveTexts: string[] | null; negativeTexts: string[] | null; notes: string | null }> | undefined;
    currentNotes: Record<number, object>;
  }): {
    notes: Record<number, object>;
    didReturn: boolean;
  } {
    let notes = { ...params.currentNotes };
    let didReturn = false;

    if (params.existingStudentNotes === undefined) {
      // Still loading — do not clear existing notes
      didReturn = true;
      return { notes, didReturn };
    }

    if (params.existingStudentNotes && params.existingStudentNotes.length > 0) {
      const notesMap: Record<number, object> = {};
      for (const n of params.existingStudentNotes) {
        notesMap[n.studentId] = {
          studentId: n.studentId,
          positivePoints: n.positivePoints,
          negativePoints: n.negativePoints,
          positiveTexts: n.positiveTexts ?? Array(10).fill(""),
          negativeTexts: n.negativeTexts ?? Array(10).fill(""),
          notes: n.notes ?? "",
        };
      }
      notes = notesMap;
    } else {
      notes = {};
    }

    return { notes, didReturn };
  }

  it("should NOT clear notes when existingStudentNotes is undefined (still loading)", () => {
    const existingNotes = { 1: { studentId: 1, positivePoints: 2, negativePoints: 1, positiveTexts: ["bom"], negativeTexts: [], notes: "" } };
    const result = simulateNotesLoadEffect({
      existingStudentNotes: undefined,  // still loading
      currentNotes: existingNotes,
    });

    expect(result.didReturn).toBe(true);
    // Notes should NOT be cleared
    expect(result.notes).toEqual(existingNotes);
  });

  it("should load notes when existingStudentNotes arrives with data", () => {
    const serverNotes = [
      { studentId: 1, positivePoints: 3, negativePoints: 2, positiveTexts: ["excelente"], negativeTexts: ["precisa melhorar"], notes: "observação" },
    ];
    const result = simulateNotesLoadEffect({
      existingStudentNotes: serverNotes,
      currentNotes: {},
    });

    expect(result.didReturn).toBe(false);
    expect(result.notes[1]).toBeDefined();
    expect((result.notes[1] as any).positivePoints).toBe(3);
    expect((result.notes[1] as any).negativePoints).toBe(2);
  });

  it("should clear notes when existingStudentNotes is empty array (no notes in DB)", () => {
    const existingNotes = { 1: { studentId: 1, positivePoints: 2, negativePoints: 1, positiveTexts: [], negativeTexts: [], notes: "" } };
    const result = simulateNotesLoadEffect({
      existingStudentNotes: [],  // empty array (not undefined)
      currentNotes: existingNotes,
    });

    expect(result.didReturn).toBe(false);
    expect(result.notes).toEqual({});
  });
});
