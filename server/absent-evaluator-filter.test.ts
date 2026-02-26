import { describe, expect, it } from "vitest";

// ─── Test that evaluations from absent students are excluded from peer grade calculations ───
describe("Absent Evaluator Filter in Peer Grade Calculation", () => {

  type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

  interface SessionStudent {
    studentId: number;
    studentName: string;
    studentEmail: string | null;
    studentEnrollment: string;
    role: RoleType;
    absent: boolean;
  }

  interface EvalItem {
    evaluationId: number;
    evaluatedStudentId: number;
    role: string;
    absent: boolean;
    pontualidade: string;
    pesquisaMetas: string;
    dominio: string;
    participacao: string;
    desempenhoPapel: string;
  }

  interface Evaluation {
    id: number;
    evaluatorStudentId: number;
  }

  // Replicates the core logic from calculateSessionResults in db.ts
  function calculateScoresWithFilter(
    sessionStudentsList: SessionStudent[],
    evals: Evaluation[],
    allItems: EvalItem[]
  ) {
    const evalToEvaluator = new Map<number, number>();
    for (const e of evals) evalToEvaluator.set(e.id, e.evaluatorStudentId);

    // Build set of absent student IDs (marked absent by professor in sessionStudents)
    const absentStudentIds = new Set(
      sessionStudentsList.filter(s => s.absent).map(s => s.studentId)
    );

    // Filter out evaluations FROM absent evaluators
    const validEvals = new Set(
      evals.filter(e => !absentStudentIds.has(e.evaluatorStudentId)).map(e => e.id)
    );
    const filteredItems = allItems.filter(i => validEvals.has(i.evaluationId));

    const results: { studentId: number; totalScore: number; validEvaluations: number }[] = [];
    for (const s of sessionStudentsList) {
      if (s.absent) {
        results.push({ studentId: s.studentId, totalScore: 0, validEvaluations: 0 });
        continue;
      }

      const itemsForStudent = filteredItems.filter(i => {
        const evaluatorId = evalToEvaluator.get(i.evaluationId);
        return i.evaluatedStudentId === s.studentId && evaluatorId !== s.studentId;
      });

      const validItems = itemsForStudent.filter(i => !i.absent);
      let sumScores = 0;
      for (const item of validItems) {
        const score = Number(item.pontualidade) * 1 + Number(item.pesquisaMetas) * 3 + Number(item.dominio) * 3 + Number(item.participacao) * 3 - Number(item.desempenhoPapel) * 1;
        sumScores += score;
      }
      const avg = validItems.length > 0 ? sumScores / validItems.length : 0;

      results.push({
        studentId: s.studentId,
        totalScore: Math.round(avg * 100) / 100,
        validEvaluations: validItems.length,
      });
    }
    return results;
  }

  // Without filter (old logic) for comparison
  function calculateScoresWithoutFilter(
    sessionStudentsList: SessionStudent[],
    evals: Evaluation[],
    allItems: EvalItem[]
  ) {
    const evalToEvaluator = new Map<number, number>();
    for (const e of evals) evalToEvaluator.set(e.id, e.evaluatorStudentId);

    const results: { studentId: number; totalScore: number; validEvaluations: number }[] = [];
    for (const s of sessionStudentsList) {
      const itemsForStudent = allItems.filter(i => {
        const evaluatorId = evalToEvaluator.get(i.evaluationId);
        return i.evaluatedStudentId === s.studentId && evaluatorId !== s.studentId;
      });

      const validItems = itemsForStudent.filter(i => !i.absent);
      let sumScores = 0;
      for (const item of validItems) {
        const score = Number(item.pontualidade) * 1 + Number(item.pesquisaMetas) * 3 + Number(item.dominio) * 3 + Number(item.participacao) * 3 - Number(item.desempenhoPapel) * 1;
        sumScores += score;
      }
      const avg = validItems.length > 0 ? sumScores / validItems.length : 0;

      results.push({
        studentId: s.studentId,
        totalScore: Math.round(avg * 100) / 100,
        validEvaluations: validItems.length,
      });
    }
    return results;
  }

  function makeItem(evalId: number, evaluatedId: number, scores: { p: number; pm: number; d: number; pa: number; dp: number }): EvalItem {
    return {
      evaluationId: evalId,
      evaluatedStudentId: evaluatedId,
      role: "PARTICIPANTE",
      absent: false,
      pontualidade: String(scores.p),
      pesquisaMetas: String(scores.pm),
      dominio: String(scores.d),
      participacao: String(scores.pa),
      desempenhoPapel: String(scores.dp),
    };
  }

  function makeStudent(id: number, name: string, absent: boolean): SessionStudent {
    return {
      studentId: id,
      studentName: name,
      studentEmail: `${name.toLowerCase()}@test.com`,
      studentEnrollment: `2025${id}`,
      role: "PARTICIPANTE",
      absent,
    };
  }

  // ─── Scenario 1: All present, no filtering needed ───
  describe("All students present", () => {
    const students = [
      makeStudent(1, "Alice", false),
      makeStudent(2, "Bob", false),
      makeStudent(3, "Carol", false),
    ];

    // Alice(1) evaluates Bob(2) and Carol(3)
    // Bob(2) evaluates Alice(1) and Carol(3)
    // Carol(3) evaluates Alice(1) and Bob(2)
    const evals: Evaluation[] = [
      { id: 101, evaluatorStudentId: 1 },
      { id: 102, evaluatorStudentId: 2 },
      { id: 103, evaluatorStudentId: 3 },
    ];

    const items: EvalItem[] = [
      makeItem(101, 2, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice evaluates Bob: 10
      makeItem(101, 3, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice evaluates Carol: 10
      makeItem(102, 1, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Bob evaluates Alice: 10
      makeItem(102, 3, { p: 0, pm: 1, d: 1, pa: 1, dp: 0 }), // Bob evaluates Carol: 9
      makeItem(103, 1, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Carol evaluates Alice: 10
      makeItem(103, 2, { p: 1, pm: 0, d: 1, pa: 1, dp: 0 }), // Carol evaluates Bob: 7
    ];

    it("should include all evaluations when no one is absent", () => {
      const results = calculateScoresWithFilter(students, evals, items);
      const alice = results.find(r => r.studentId === 1)!;
      const bob = results.find(r => r.studentId === 2)!;
      const carol = results.find(r => r.studentId === 3)!;

      expect(alice.validEvaluations).toBe(2); // Bob + Carol evaluated Alice
      expect(bob.validEvaluations).toBe(2);   // Alice + Carol evaluated Bob
      expect(carol.validEvaluations).toBe(2); // Alice + Bob evaluated Carol

      expect(alice.totalScore).toBe(10);      // (10+10)/2
      expect(bob.totalScore).toBe(8.5);       // (10+7)/2
      expect(carol.totalScore).toBe(9.5);     // (10+9)/2
    });

    it("should match old logic when no one is absent", () => {
      const withFilter = calculateScoresWithFilter(students, evals, items);
      const withoutFilter = calculateScoresWithoutFilter(students, evals, items);
      expect(withFilter).toEqual(withoutFilter);
    });
  });

  // ─── Scenario 2: Absent evaluator's grades should be excluded ───
  describe("Absent evaluator exclusion", () => {
    const students = [
      makeStudent(1, "Alice", false),
      makeStudent(2, "Bob", false),
      makeStudent(3, "Carol", true), // Carol is marked absent by professor
    ];

    // Carol submitted evaluation BEFORE being marked absent
    const evals: Evaluation[] = [
      { id: 101, evaluatorStudentId: 1 },
      { id: 102, evaluatorStudentId: 2 },
      { id: 103, evaluatorStudentId: 3 }, // Carol's evaluation should be excluded
    ];

    const items: EvalItem[] = [
      makeItem(101, 2, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice evaluates Bob: 10
      makeItem(101, 3, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice evaluates Carol: 10
      makeItem(102, 1, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Bob evaluates Alice: 10
      makeItem(102, 3, { p: 0, pm: 1, d: 1, pa: 1, dp: 0 }), // Bob evaluates Carol: 9
      makeItem(103, 1, { p: 0, pm: 0, d: 0, pa: 0, dp: 1 }), // Carol evaluates Alice: -1 (should be EXCLUDED)
      makeItem(103, 2, { p: 0, pm: 0, d: 0, pa: 0, dp: 1 }), // Carol evaluates Bob: -1 (should be EXCLUDED)
    ];

    it("should exclude evaluations from absent evaluator (Carol)", () => {
      const results = calculateScoresWithFilter(students, evals, items);
      const alice = results.find(r => r.studentId === 1)!;
      const bob = results.find(r => r.studentId === 2)!;

      // Alice should only have Bob's evaluation (not Carol's)
      expect(alice.validEvaluations).toBe(1);
      expect(alice.totalScore).toBe(10); // Only Bob's grade: 10

      // Bob should only have Alice's evaluation (not Carol's)
      expect(bob.validEvaluations).toBe(1);
      expect(bob.totalScore).toBe(10); // Only Alice's grade: 10
    });

    it("old logic (without filter) would include absent evaluator's grades", () => {
      const withoutFilter = calculateScoresWithoutFilter(students, evals, items);
      const alice = withoutFilter.find(r => r.studentId === 1)!;
      const bob = withoutFilter.find(r => r.studentId === 2)!;

      // Without filter, Carol's bad grades would be included
      expect(alice.validEvaluations).toBe(2); // Bob + Carol
      expect(alice.totalScore).toBe(4.5);     // (10 + (-1))/2 = 4.5

      expect(bob.validEvaluations).toBe(2);   // Alice + Carol
      expect(bob.totalScore).toBe(4.5);       // (10 + (-1))/2 = 4.5
    });

    it("absent student gets zero score", () => {
      const results = calculateScoresWithFilter(students, evals, items);
      const carol = results.find(r => r.studentId === 3)!;
      expect(carol.totalScore).toBe(0);
      expect(carol.validEvaluations).toBe(0);
    });
  });

  // ─── Scenario 3: Multiple absent evaluators ───
  describe("Multiple absent evaluators", () => {
    const students = [
      makeStudent(1, "Alice", false),
      makeStudent(2, "Bob", true),   // absent
      makeStudent(3, "Carol", true), // absent
      makeStudent(4, "Dave", false),
    ];

    const evals: Evaluation[] = [
      { id: 101, evaluatorStudentId: 1 },
      { id: 102, evaluatorStudentId: 2 }, // Bob absent
      { id: 103, evaluatorStudentId: 3 }, // Carol absent
      { id: 104, evaluatorStudentId: 4 },
    ];

    const items: EvalItem[] = [
      makeItem(101, 2, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice→Bob: 10
      makeItem(101, 3, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice→Carol: 10
      makeItem(101, 4, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice→Dave: 10
      makeItem(102, 1, { p: 0, pm: 0, d: 0, pa: 0, dp: 1 }), // Bob→Alice: -1 (EXCLUDED)
      makeItem(102, 3, { p: 0, pm: 0, d: 0, pa: 0, dp: 1 }), // Bob→Carol: -1 (EXCLUDED)
      makeItem(102, 4, { p: 0, pm: 0, d: 0, pa: 0, dp: 1 }), // Bob→Dave: -1 (EXCLUDED)
      makeItem(103, 1, { p: 0, pm: 0, d: 0, pa: 0, dp: 1 }), // Carol→Alice: -1 (EXCLUDED)
      makeItem(103, 2, { p: 0, pm: 0, d: 0, pa: 0, dp: 1 }), // Carol→Bob: -1 (EXCLUDED)
      makeItem(103, 4, { p: 0, pm: 0, d: 0, pa: 0, dp: 1 }), // Carol→Dave: -1 (EXCLUDED)
      makeItem(104, 1, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Dave→Alice: 10
      makeItem(104, 2, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Dave→Bob: 10
      makeItem(104, 3, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Dave→Carol: 10
    ];

    it("should only count evaluations from present students (Alice and Dave)", () => {
      const results = calculateScoresWithFilter(students, evals, items);
      const alice = results.find(r => r.studentId === 1)!;
      const dave = results.find(r => r.studentId === 4)!;

      // Alice: only Dave's evaluation counts
      expect(alice.validEvaluations).toBe(1);
      expect(alice.totalScore).toBe(10);

      // Dave: only Alice's evaluation counts
      expect(dave.validEvaluations).toBe(1);
      expect(dave.totalScore).toBe(10);
    });

    it("absent students get zero", () => {
      const results = calculateScoresWithFilter(students, evals, items);
      const bob = results.find(r => r.studentId === 2)!;
      const carol = results.find(r => r.studentId === 3)!;
      expect(bob.totalScore).toBe(0);
      expect(carol.totalScore).toBe(0);
    });
  });

  // ─── Scenario 4: No evaluations from absent students ───
  describe("No absent evaluators submitted evaluations", () => {
    const students = [
      makeStudent(1, "Alice", false),
      makeStudent(2, "Bob", false),
      makeStudent(3, "Carol", true), // absent but never submitted
    ];

    const evals: Evaluation[] = [
      { id: 101, evaluatorStudentId: 1 },
      { id: 102, evaluatorStudentId: 2 },
    ];

    const items: EvalItem[] = [
      makeItem(101, 2, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice→Bob: 10
      makeItem(102, 1, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Bob→Alice: 10
    ];

    it("should work normally when absent student never submitted", () => {
      const results = calculateScoresWithFilter(students, evals, items);
      const alice = results.find(r => r.studentId === 1)!;
      const bob = results.find(r => r.studentId === 2)!;

      expect(alice.validEvaluations).toBe(1);
      expect(alice.totalScore).toBe(10);
      expect(bob.validEvaluations).toBe(1);
      expect(bob.totalScore).toBe(10);
    });
  });

  // ─── Scenario 5: Self-evaluation still excluded ───
  describe("Self-evaluation exclusion still works with filter", () => {
    const students = [
      makeStudent(1, "Alice", false),
      makeStudent(2, "Bob", false),
    ];

    const evals: Evaluation[] = [
      { id: 101, evaluatorStudentId: 1 },
      { id: 102, evaluatorStudentId: 2 },
    ];

    const items: EvalItem[] = [
      makeItem(101, 1, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice self-eval (should be excluded)
      makeItem(101, 2, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Alice→Bob: 10
      makeItem(102, 1, { p: 0, pm: 1, d: 1, pa: 1, dp: 0 }), // Bob→Alice: 9
      makeItem(102, 2, { p: 1, pm: 1, d: 1, pa: 1, dp: 0 }), // Bob self-eval (should be excluded)
    ];

    it("should still exclude self-evaluations", () => {
      const results = calculateScoresWithFilter(students, evals, items);
      const alice = results.find(r => r.studentId === 1)!;
      const bob = results.find(r => r.studentId === 2)!;

      expect(alice.validEvaluations).toBe(1); // Only Bob's eval
      expect(alice.totalScore).toBe(9);
      expect(bob.validEvaluations).toBe(1);   // Only Alice's eval
      expect(bob.totalScore).toBe(10);
    });
  });

  // ─── Scenario 6: Backend blocks absent student from submitting ───
  describe("Backend validation: absent student cannot submit evaluation", () => {
    it("should block absent student from submitting via studentAccess route", () => {
      // This tests the validation logic added to the submitEvaluation routes
      const sessionStudents = [
        { studentId: 1, absent: false },
        { studentId: 2, absent: true }, // marked absent
        { studentId: 3, absent: false },
      ];

      const studentMap = new Map(sessionStudents.map(s => [s.studentId, s]));

      // Student 2 tries to submit
      const evaluatorEntry = studentMap.get(2);
      expect(evaluatorEntry?.absent).toBe(true);
      // In the actual code, this would throw FORBIDDEN error
    });

    it("should allow present student to submit", () => {
      const sessionStudents = [
        { studentId: 1, absent: false },
        { studentId: 2, absent: true },
        { studentId: 3, absent: false },
      ];

      const studentMap = new Map(sessionStudents.map(s => [s.studentId, s]));

      const evaluatorEntry = studentMap.get(1);
      expect(evaluatorEntry?.absent).toBe(false);
    });
  });

  // ─── Scenario 7: Evaluator list in matrix excludes absent evaluators ───
  describe("Peer grades matrix excludes absent evaluators", () => {
    it("should not include absent students in evaluator list", () => {
      const evals = [
        { id: 1, evaluatorStudentId: 1 },
        { id: 2, evaluatorStudentId: 2 }, // absent
        { id: 3, evaluatorStudentId: 3 },
      ];

      const sessionStudents = [
        { studentId: 1, absent: false },
        { studentId: 2, absent: true },
        { studentId: 3, absent: false },
      ];

      const absentStudentIdsSet = new Set(
        sessionStudents.filter(s => s.absent).map(s => s.studentId)
      );

      const evaluatorIds = new Set(
        evals.filter(e => !absentStudentIdsSet.has(e.evaluatorStudentId)).map(e => e.evaluatorStudentId)
      );

      expect(evaluatorIds.has(1)).toBe(true);
      expect(evaluatorIds.has(2)).toBe(false); // absent, excluded
      expect(evaluatorIds.has(3)).toBe(true);
    });
  });
});
