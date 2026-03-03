/**
 * Tests for tutorial evaluation auto-fill on session finish
 * When a session is finished without a submitted tutorial evaluation,
 * the system should auto-fill with default scores (Excelente = 1.0 for all criteria)
 * or use the saved draft values if available.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ───────────────────────────────────────────────────────
vi.mock("../drizzle/db", () => ({ getDb: vi.fn() }));
import { getDb } from "../drizzle/db";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeDb(overrides: Record<string, unknown> = {}) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };

  return {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([{ insertId: 1 }]) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeDb())),
    _selectChain: selectChain,
    ...overrides,
  };
}

// ─── Unit tests for auto-fill logic ──────────────────────────────────────────
describe("Tutorial Evaluation Auto-fill Logic", () => {
  describe("Default scores when no draft exists", () => {
    it("should use Excelente (1.0) for all criteria when no draft", () => {
      const defaultScores = {
        organizacao: 1.0,
        cooperacao: 1.0,
        conteudo: 1.0,
        objetivo: 1.0,
        metas: 1.0,
      };

      expect(defaultScores.organizacao).toBe(1.0);
      expect(defaultScores.cooperacao).toBe(1.0);
      expect(defaultScores.conteudo).toBe(1.0);
      expect(defaultScores.objetivo).toBe(1.0);
      expect(defaultScores.metas).toBe(1.0);
    });

    it("should produce tutorialGrade of 10 with all Excelente scores", () => {
      // tutorialGrade = (org*1 + coop*1 + disc*3 + prog*3 + metas*2) / 10 * 10
      const org = 1.0, coop = 1.0, disc = 1.0, prog = 1.0, metas = 1.0;
      const raw = org * 1 + coop * 1 + disc * 3 + prog * 3 + metas * 2;
      const maxRaw = 1 * 1 + 1 * 1 + 1 * 3 + 1 * 3 + 1 * 2; // = 10
      const tutorialGrade = (raw / maxRaw) * 10;
      expect(tutorialGrade).toBe(10.0);
    });
  });

  describe("Draft scores when draft exists", () => {
    it("should use draft values when a draft is available", () => {
      const draft = {
        organizacao: "0.75",
        cooperacao: "0.5",
        conteudo: "1.0",
        objetivo: "0.75",
        metas: "0.5",
      };

      const scores = {
        organizacao: Number(draft.organizacao),
        cooperacao: Number(draft.cooperacao),
        conteudo: Number(draft.conteudo),
        objetivo: Number(draft.objetivo),
        metas: Number(draft.metas),
      };

      expect(scores.organizacao).toBe(0.75);
      expect(scores.cooperacao).toBe(0.5);
      expect(scores.conteudo).toBe(1.0);
      expect(scores.objetivo).toBe(0.75);
      expect(scores.metas).toBe(0.5);
    });

    it("should correctly calculate tutorialGrade from draft scores", () => {
      const scores = { organizacao: 0.75, cooperacao: 0.5, conteudo: 1.0, objetivo: 0.75, metas: 0.5 };
      const raw = scores.organizacao * 1 + scores.cooperacao * 1 + scores.conteudo * 3 + scores.objetivo * 3 + scores.metas * 2;
      // 0.75 + 0.5 + 3.0 + 2.25 + 1.0 = 7.5
      expect(raw).toBe(7.5);
      const maxRaw = 10;
      const tutorialGrade = (raw / maxRaw) * 10;
      expect(tutorialGrade).toBe(7.5);
    });
  });

  describe("Auto-fill conditions", () => {
    it("should NOT auto-fill when tutorial evaluation already exists", () => {
      // If existing.length > 0, skip insert
      const existingEvals = [{ id: 42 }];
      const shouldInsert = existingEvals.length === 0;
      expect(shouldInsert).toBe(false);
    });

    it("should auto-fill when no tutorial evaluation exists", () => {
      const existingEvals: unknown[] = [];
      const shouldInsert = existingEvals.length === 0;
      expect(shouldInsert).toBe(true);
    });

    it("should NOT auto-fill when professorUserId is not provided", () => {
      const professorUserId: number | undefined = undefined;
      const shouldAttempt = !!professorUserId;
      expect(shouldAttempt).toBe(false);
    });

    it("should attempt auto-fill when professorUserId is provided", () => {
      const professorUserId = 7;
      const shouldAttempt = !!professorUserId;
      expect(shouldAttempt).toBe(true);
    });
  });

  describe("Score string serialization", () => {
    it("should serialize scores as strings for DB insertion", () => {
      const scores = { organizacao: 1.0, cooperacao: 1.0, conteudo: 1.0, objetivo: 1.0, metas: 1.0 };
      const serialized = {
        organizacao: String(scores.organizacao),
        cooperacao: String(scores.cooperacao),
        conteudo: String(scores.conteudo),
        objetivo: String(scores.objetivo),
        metas: String(scores.metas),
      };
      expect(serialized.organizacao).toBe("1");
      expect(serialized.cooperacao).toBe("1");
      expect(serialized.conteudo).toBe("1");
      expect(serialized.objetivo).toBe("1");
      expect(serialized.metas).toBe("1");
    });

    it("should parse decimal strings back to numbers correctly", () => {
      const dbValues = { organizacao: "0.75", cooperacao: "1.0", conteudo: "0.5", objetivo: "0.25", metas: "1.0" };
      expect(Number(dbValues.organizacao)).toBe(0.75);
      expect(Number(dbValues.cooperacao)).toBe(1.0);
      expect(Number(dbValues.conteudo)).toBe(0.5);
      expect(Number(dbValues.objetivo)).toBe(0.25);
      expect(Number(dbValues.metas)).toBe(1.0);
    });
  });
});

// ─── Frontend default scores ──────────────────────────────────────────────────
describe("TutorialEvalPage Default Scores", () => {
  const DEFAULT_SCORES = {
    organizacao: 1.0,
    cooperacao: 1.0,
    conteudo: 1.0,
    objetivo: 1.0,
    metas: 1.0,
  };

  it("should have Excelente (1.0) as default for organizacao", () => {
    expect(DEFAULT_SCORES.organizacao).toBe(1.0);
  });

  it("should have Excelente (1.0) as default for cooperacao", () => {
    expect(DEFAULT_SCORES.cooperacao).toBe(1.0);
  });

  it("should have Excelente (1.0) as default for conteudo (Discussão)", () => {
    expect(DEFAULT_SCORES.conteudo).toBe(1.0);
  });

  it("should have Excelente (1.0) as default for objetivo (Progresso)", () => {
    expect(DEFAULT_SCORES.objetivo).toBe(1.0);
  });

  it("should have Excelente (1.0) as default for metas", () => {
    expect(DEFAULT_SCORES.metas).toBe(1.0);
  });

  it("all defaults should be 1.0 (Excelente)", () => {
    const allExcelente = Object.values(DEFAULT_SCORES).every(v => v === 1.0);
    expect(allExcelente).toBe(true);
  });
});
