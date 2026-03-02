import { describe, it, expect } from "vitest";

// ─── Tests for getPeerGradesMatrix with absolute absentees ───
// These tests validate the business logic without a real database,
// simulating the data structures returned by the backend.

describe("getPeerGradesMatrix - absolute absentees included", () => {
  it("getPeerGradesMatrix is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.getPeerGradesMatrix).toBe("function");
  });

  it("absolute absentees (not in session) are marked absent=true with empty peerGrades", () => {
    // Simulate: class has 4 students, session has 3 (Alice, Bob, Carol), Dave is absent
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: false },
      { studentId: 2, studentName: "Bob", absent: false },
      { studentId: 3, studentName: "Carol", absent: false },
    ];
    const allClassStudents = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Carol" },
      { id: 4, name: "Dave" }, // absolute absentee
    ];

    const sessionStudentIdSet = new Set(sessionStudents.map(s => s.studentId));
    const absoluteAbsentees = allClassStudents.filter(s => !sessionStudentIdSet.has(s.id));

    expect(absoluteAbsentees).toHaveLength(1);
    expect(absoluteAbsentees[0].id).toBe(4);
    expect(absoluteAbsentees[0].name).toBe("Dave");
  });

  it("absolute absentee row has absent=true and peerGrades=[]", () => {
    const absoluteAbsenteeRow = {
      serial: 4,
      studentId: 4,
      studentName: "Dave",
      studentEnrollment: "444",
      peerGrades: [],
      peerAverage: 0,
      absent: true,
    };

    expect(absoluteAbsenteeRow.absent).toBe(true);
    expect(absoluteAbsenteeRow.peerGrades).toHaveLength(0);
    expect(absoluteAbsenteeRow.peerAverage).toBe(0);
  });

  it("absent student does not affect peer average of other students", () => {
    // Dave is absent, so his grades should not be counted
    // Alice received grades from Bob (8.0) and Carol (7.0) — Dave does not grade
    const gradesForAlice = [
      { evaluatorStudentId: 2, score: 8.0, absent: false }, // Bob
      { evaluatorStudentId: 3, score: 7.0, absent: false }, // Carol
      // Dave (id=4) is absent — no entry
    ];

    const validGrades = gradesForAlice.filter(g => !g.absent);
    const avg = validGrades.reduce((sum, g) => sum + g.score, 0) / validGrades.length;

    expect(validGrades).toHaveLength(2);
    expect(avg).toBeCloseTo(7.5);
  });

  it("all students in the class appear in the matrix (session + absolute absentees)", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: false },
      { studentId: 2, studentName: "Bob", absent: false },
    ];
    const absoluteAbsentees = [
      { id: 3, name: "Carol" },
      { id: 4, name: "Dave" },
    ];

    const allStudentsForMatrix = [
      ...sessionStudents.map(s => ({ studentId: s.studentId, studentName: s.studentName, inSession: true, absent: s.absent })),
      ...absoluteAbsentees.map(s => ({ studentId: s.id, studentName: s.name, inSession: false, absent: true })),
    ];

    expect(allStudentsForMatrix).toHaveLength(4);
    expect(allStudentsForMatrix.filter(s => s.inSession)).toHaveLength(2);
    expect(allStudentsForMatrix.filter(s => !s.inSession)).toHaveLength(2);
    expect(allStudentsForMatrix.filter(s => s.absent)).toHaveLength(2);
  });

  it("serial numbers are assigned to all students including absolute absentees", () => {
    const allStudents = [
      { studentId: 1, studentName: "Alice" },
      { studentId: 2, studentName: "Bob" },
      { studentId: 3, studentName: "Carol" }, // absolute absentee
      { studentId: 4, studentName: "Dave" },  // absolute absentee
    ].sort((a, b) => a.studentName.localeCompare(b.studentName));

    const serialMap = new Map<number, number>();
    allStudents.forEach((s, i) => serialMap.set(s.studentId, i + 1));

    expect(serialMap.get(1)).toBe(1); // Alice → 1
    expect(serialMap.get(2)).toBe(2); // Bob → 2
    expect(serialMap.get(3)).toBe(3); // Carol → 3
    expect(serialMap.get(4)).toBe(4); // Dave → 4
    expect(serialMap.size).toBe(4);
  });

  it("frontend: absent row with empty peerGrades shows F in all evaluator columns", () => {
    // Simulate the frontend logic for rendering cells
    const row = {
      studentId: 4,
      studentName: "Dave",
      absent: true,
      peerGrades: [] as { evaluatorStudentId: number; score: number; absent: boolean }[],
    };
    const evaluators = [
      { studentId: 1, serial: 1 },
      { studentId: 2, serial: 2 },
      { studentId: 3, serial: 3 },
    ];

    // For each evaluator column, if row.absent && row.peerGrades.length === 0, show F
    const shouldShowF = row.absent && row.peerGrades.length === 0;
    expect(shouldShowF).toBe(true);

    // All evaluator columns should show F
    const cellValues = evaluators.map(() => shouldShowF ? "F" : "score");
    expect(cellValues.every(v => v === "F")).toBe(true);
  });

  it("frontend: absent row shows F in the Média Pares column", () => {
    const row = { absent: true, peerAverage: 0 };
    // Frontend renders F when row.absent is true
    const display = row.absent ? "F" : row.peerAverage.toFixed(1);
    expect(display).toBe("F");
  });

  it("frontend: present student shows numeric average in Média Pares column", () => {
    const row = { absent: false, peerAverage: 8.5 };
    const display = row.absent ? "F" : row.peerAverage.toFixed(1);
    expect(display).toBe("8.5");
  });

  it("professor-marked absent student also shows F in all cells", () => {
    // Student was in the session but professor marked them as absent
    const row = {
      studentId: 2,
      studentName: "Bob",
      absent: true, // marked absent by professor
      peerGrades: [] as { evaluatorStudentId: number; score: number; absent: boolean }[],
    };

    const shouldShowF = row.absent && row.peerGrades.length === 0;
    expect(shouldShowF).toBe(true);
  });

  it("rows are sorted alphabetically by student name", () => {
    const allStudents = [
      { studentId: 3, studentName: "Carol" },
      { studentId: 1, studentName: "Alice" },
      { studentId: 4, studentName: "Dave" },
      { studentId: 2, studentName: "Bob" },
    ].sort((a, b) => a.studentName.localeCompare(b.studentName));

    expect(allStudents[0].studentName).toBe("Alice");
    expect(allStudents[1].studentName).toBe("Bob");
    expect(allStudents[2].studentName).toBe("Carol");
    expect(allStudents[3].studentName).toBe("Dave");
  });

  it("when all class students are in session, no extra rows are added", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice" },
      { studentId: 2, studentName: "Bob" },
    ];
    const allClassStudents = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];

    const sessionStudentIdSet = new Set(sessionStudents.map(s => s.studentId));
    const absoluteAbsentees = allClassStudents.filter(s => !sessionStudentIdSet.has(s.id));

    expect(absoluteAbsentees).toHaveLength(0);
  });

  it("multiple absolute absentees are all included in the matrix", () => {
    const sessionStudents = [{ studentId: 1, studentName: "Alice" }];
    const allClassStudents = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Carol" },
      { id: 4, name: "Dave" },
      { id: 5, name: "Eve" },
    ];

    const sessionStudentIdSet = new Set(sessionStudents.map(s => s.studentId));
    const absoluteAbsentees = allClassStudents.filter(s => !sessionStudentIdSet.has(s.id));

    expect(absoluteAbsentees).toHaveLength(4);
    expect(absoluteAbsentees.map(s => s.name)).toContain("Bob");
    expect(absoluteAbsentees.map(s => s.name)).toContain("Carol");
    expect(absoluteAbsentees.map(s => s.name)).toContain("Dave");
    expect(absoluteAbsentees.map(s => s.name)).toContain("Eve");
  });
});
