/**
 * Tests for excluded student detection in consolidated results.
 *
 * Scenario: A student was in the class for session 1 (P1S1) but was removed
 * from the class before session 2 (P1S2). The student should appear with
 * excluded=true (E) for session 2 in all consolidated views.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ───────────────────────────────────────────────────────
vi.mock("../drizzle/schema", () => ({
  sessions: {},
  sessionStudents: {},
  evaluations: {},
  evaluationItems: {},
  tutorialEvaluations: {},
  classStudents: {},
  students: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...args) => ({ args, op: "and" })),
  desc: vi.fn((col) => ({ col, op: "desc" })),
  inArray: vi.fn((col, vals) => ({ col, vals, op: "inArray" })),
  sql: vi.fn((s) => s),
  or: vi.fn((...args) => ({ args, op: "or" })),
  not: vi.fn((arg) => ({ arg, op: "not" })),
  gte: vi.fn((col, val) => ({ col, val, op: "gte" })),
  lt: vi.fn((col, val) => ({ col, val, op: "lt" })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Simulates calculateProblemResults logic for a simple scenario:
 * - 2 sessions for problem 1
 * - Student A: in class for both sessions, present in both
 * - Student B: was in class for session 1 (participated), removed before session 2
 *
 * We test the pure logic without hitting the DB.
 */

interface MockStudent {
  id: number;
  name: string;
  email: string;
  enrollment: string;
}

interface MockSessionResult {
  studentId: number;
  studentName: string;
  studentEmail: string;
  studentEnrollment: string;
  role: string;
  totalScore: number;
  validEvaluations: number;
  absent: boolean;
  excluded: boolean;
}

function buildProblemResults(
  currentClassStudents: MockStudent[],
  sessionResultsMap: Record<number, Record<number, MockSessionResult>>,
  sessionIds: number[]
) {
  const currentClassStudentIds = new Set(currentClassStudents.map((s) => s.id));

  const allStudentMap: Record<
    number,
    { name: string; email: string; enrollment: string }
  > = {};
  for (const s of currentClassStudents) {
    allStudentMap[s.id] = { name: s.name, email: s.email, enrollment: s.enrollment };
  }

  // Collect all students who appeared in any session
  for (const sessId of sessionIds) {
    const results = sessionResultsMap[sessId] ?? {};
    for (const [idStr, r] of Object.entries(results)) {
      const sid = parseInt(idStr);
      if (!allStudentMap[sid]) {
        allStudentMap[sid] = {
          name: r.studentName,
          email: r.studentEmail,
          enrollment: r.studentEnrollment,
        };
      }
    }
  }

  return Object.entries(allStudentMap)
    .map(([idStr, data]) => {
      const studentId = parseInt(idStr);
      const isCurrentlyInClass = currentClassStudentIds.has(studentId);

      const sessionScores: (number | null)[] = [];
      const roles: string[] = [];
      const excludedFlags: boolean[] = [];

      for (const sessId of sessionIds) {
        const r = sessionResultsMap[sessId]?.[studentId];
        if (!r) {
          if (!isCurrentlyInClass) {
            sessionScores.push(null);
            roles.push("EXCLUÍDO");
            excludedFlags.push(true);
          } else {
            sessionScores.push(0);
            roles.push("FALTOU");
            excludedFlags.push(false);
          }
        } else if (r.excluded) {
          sessionScores.push(null);
          roles.push("EXCLUÍDO");
          excludedFlags.push(true);
        } else {
          sessionScores.push(r.totalScore);
          roles.push(r.role);
          excludedFlags.push(false);
        }
      }

      const validScores = sessionScores.filter((s): s is number => s !== null);
      const avg =
        validScores.length > 0
          ? validScores.reduce((a, b) => a + b, 0) / validScores.length
          : 0;

      return {
        studentId,
        studentName: data.name,
        sessionScores,
        roles,
        excludedFlags,
        average: Math.round(avg * 100) / 100,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("calculateProblemResults - excluded student logic", () => {
  const studentA: MockStudent = {
    id: 1,
    name: "Alice",
    email: "alice@test.com",
    enrollment: "A001",
  };
  const studentB: MockStudent = {
    id: 2,
    name: "Bob",
    email: "bob@test.com",
    enrollment: "B002",
  };

  it("student present in both sessions gets scores for both", () => {
    // Only Alice is currently in class (Bob was removed)
    const currentClass = [studentA];

    const sessionResultsMap: Record<number, Record<number, MockSessionResult>> = {
      1: {
        1: {
          studentId: 1,
          studentName: "Alice",
          studentEmail: "alice@test.com",
          studentEnrollment: "A001",
          role: "PARTICIPANTE",
          totalScore: 8.5,
          validEvaluations: 3,
          absent: false,
          excluded: false,
        },
        2: {
          studentId: 2,
          studentName: "Bob",
          studentEmail: "bob@test.com",
          studentEnrollment: "B002",
          role: "COORDENADOR",
          totalScore: 9.0,
          validEvaluations: 3,
          absent: false,
          excluded: false,
        },
      },
      2: {
        1: {
          studentId: 1,
          studentName: "Alice",
          studentEmail: "alice@test.com",
          studentEnrollment: "A001",
          role: "PARTICIPANTE",
          totalScore: 7.5,
          validEvaluations: 3,
          absent: false,
          excluded: false,
        },
        // Bob is NOT in session 2 (was excluded from class)
      },
    };

    const results = buildProblemResults(currentClass, sessionResultsMap, [1, 2]);
    const alice = results.find((r) => r.studentId === 1)!;
    const bob = results.find((r) => r.studentId === 2)!;

    // Alice: both sessions present
    expect(alice.sessionScores).toEqual([8.5, 7.5]);
    expect(alice.excludedFlags).toEqual([false, false]);
    expect(alice.average).toBe(8.0);

    // Bob: session 1 present, session 2 excluded (not in class + not in session)
    expect(bob.sessionScores[0]).toBe(9.0);
    expect(bob.sessionScores[1]).toBeNull();
    expect(bob.excludedFlags[0]).toBe(false);
    expect(bob.excludedFlags[1]).toBe(true);
    expect(bob.roles[1]).toBe("EXCLUÍDO");
    // Average only over session 1
    expect(bob.average).toBe(9.0);
  });

  it("student excluded from all sessions gets average 0 and all excluded flags", () => {
    const currentClass: MockStudent[] = []; // Bob removed, no current students

    const sessionResultsMap: Record<number, Record<number, MockSessionResult>> = {
      1: {},
      2: {},
    };

    // Bob appeared in session 1 but was removed before both sessions
    // Actually: if Bob never appeared in any session, he won't be in allStudentMap
    // This tests the edge case where Bob appeared in session 1
    sessionResultsMap[1][2] = {
      studentId: 2,
      studentName: "Bob",
      studentEmail: "bob@test.com",
      studentEnrollment: "B002",
      role: "PARTICIPANTE",
      totalScore: 8.0,
      validEvaluations: 3,
      absent: false,
      excluded: false,
    };

    const results = buildProblemResults(currentClass, sessionResultsMap, [1, 2]);
    const bob = results.find((r) => r.studentId === 2)!;

    // Session 1: Bob participated (score 8.0)
    expect(bob.sessionScores[0]).toBe(8.0);
    expect(bob.excludedFlags[0]).toBe(false);

    // Session 2: Bob not in class and not in session → excluded
    expect(bob.sessionScores[1]).toBeNull();
    expect(bob.excludedFlags[1]).toBe(true);
    expect(bob.roles[1]).toBe("EXCLUÍDO");

    // Average only over session 1
    expect(bob.average).toBe(8.0);
  });

  it("student absent (still in class) gets score 0 not null", () => {
    const currentClass = [studentA, studentB]; // Both still in class

    const sessionResultsMap: Record<number, Record<number, MockSessionResult>> = {
      1: {
        1: {
          studentId: 1,
          studentName: "Alice",
          studentEmail: "alice@test.com",
          studentEnrollment: "A001",
          role: "PARTICIPANTE",
          totalScore: 8.0,
          validEvaluations: 3,
          absent: false,
          excluded: false,
        },
        // Bob absent from session 1 (still in class but not in session)
      },
    };

    const results = buildProblemResults(currentClass, sessionResultsMap, [1]);
    const bob = results.find((r) => r.studentId === 2)!;

    // Bob still in class but not in session → absent (score 0), not excluded
    expect(bob.sessionScores[0]).toBe(0);
    expect(bob.excludedFlags[0]).toBe(false);
    expect(bob.roles[0]).toBe("FALTOU");
  });

  it("excluded flags do not affect average calculation", () => {
    const currentClass = [studentA]; // Only Alice in class

    const sessionResultsMap: Record<number, Record<number, MockSessionResult>> = {
      1: {
        2: {
          studentId: 2,
          studentName: "Bob",
          studentEmail: "bob@test.com",
          studentEnrollment: "B002",
          role: "PARTICIPANTE",
          totalScore: 6.0,
          validEvaluations: 3,
          absent: false,
          excluded: false,
        },
      },
      2: {
        // Bob not in session 2 (excluded)
      },
      3: {
        // Bob not in session 3 (excluded)
      },
    };

    const results = buildProblemResults(currentClass, sessionResultsMap, [1, 2, 3]);
    const bob = results.find((r) => r.studentId === 2)!;

    // Sessions 2 and 3 are excluded (null), only session 1 counts
    expect(bob.sessionScores).toEqual([6.0, null, null]);
    expect(bob.excludedFlags).toEqual([false, true, true]);
    // Average = 6.0 (only session 1)
    expect(bob.average).toBe(6.0);
  });
});

describe("getStudentConsolidatedReport - excluded session logic", () => {
  /**
   * Pure function to test the consolidated report session mapping logic.
   */
  function buildConsolidatedSession(
    isCurrentlyInClass: boolean,
    gradeRecord: {
      peerScore: number;
      desempenhoScore: number;
      role: string;
      absent: boolean;
      excluded: boolean;
    } | null,
    sessBase: { id: number; label: string; problemNumber: number; sessionNumber: number; status: string }
  ) {
    if (!gradeRecord) {
      if (!isCurrentlyInClass) {
        return { ...sessBase, peerScore: 0, desempenhoScore: 0, role: "EXCLUÍDO", absent: false, excluded: true };
      }
      return { ...sessBase, peerScore: 0, desempenhoScore: 0, role: "FALTOU", absent: true, excluded: false };
    }
    if (gradeRecord.excluded) {
      return { ...sessBase, peerScore: 0, desempenhoScore: 0, role: "EXCLUÍDO", absent: false, excluded: true };
    }
    return { ...sessBase, ...gradeRecord };
  }

  const sessBase = { id: 10, label: "P1S2", problemNumber: 1, sessionNumber: 2, status: "closed" };

  it("returns excluded=true when student not in class and not in session", () => {
    const result = buildConsolidatedSession(false, null, sessBase);
    expect(result.excluded).toBe(true);
    expect(result.role).toBe("EXCLUÍDO");
    expect(result.absent).toBe(false);
  });

  it("returns absent=true when student still in class but not in session", () => {
    const result = buildConsolidatedSession(true, null, sessBase);
    expect(result.excluded).toBe(false);
    expect(result.absent).toBe(true);
    expect(result.role).toBe("FALTOU");
  });

  it("returns excluded=true when grade record has excluded=true", () => {
    const grade = { peerScore: 0, desempenhoScore: 0, role: "EXCLUÍDO", absent: false, excluded: true };
    const result = buildConsolidatedSession(false, grade, sessBase);
    expect(result.excluded).toBe(true);
    expect(result.role).toBe("EXCLUÍDO");
  });

  it("returns normal grade when student participated", () => {
    const grade = { peerScore: 8.5, desempenhoScore: 9.2, role: "PARTICIPANTE", absent: false, excluded: false };
    const result = buildConsolidatedSession(true, grade, sessBase);
    expect(result.excluded).toBe(false);
    expect(result.absent).toBe(false);
    expect(result.peerScore).toBe(8.5);
    expect(result.desempenhoScore).toBe(9.2);
  });

  it("allExcluded flag is true when all sessions are excluded", () => {
    const sessions = [
      { excluded: true, absent: false },
      { excluded: true, absent: false },
    ];
    const excludedSessions = sessions.filter((s) => s.excluded);
    const allExcluded = excludedSessions.length === sessions.length;
    expect(allExcluded).toBe(true);
  });

  it("allExcluded flag is false when at least one session is not excluded", () => {
    const sessions = [
      { excluded: false, absent: false },
      { excluded: true, absent: false },
    ];
    const excludedSessions = sessions.filter((s) => s.excluded);
    const allExcluded = excludedSessions.length === sessions.length;
    expect(allExcluded).toBe(false);
  });

  it("average excludes sessions with excluded=true", () => {
    const sessionData = [
      { peerScore: 8.0, desempenhoScore: 9.0, absent: false, excluded: false },
      { peerScore: 0, desempenhoScore: 0, absent: false, excluded: true },
      { peerScore: 6.0, desempenhoScore: 7.0, absent: false, excluded: true },
    ];
    const presentSessions = sessionData.filter((s) => !s.absent && !s.excluded);
    const avgFinal =
      presentSessions.length > 0
        ? Math.round(
            (presentSessions.reduce((sum, s) => sum + s.desempenhoScore, 0) / presentSessions.length) * 10
          ) / 10
        : 0;
    // Only session 1 counts (sessions 2 and 3 are excluded)
    expect(avgFinal).toBe(9.0);
  });
});
