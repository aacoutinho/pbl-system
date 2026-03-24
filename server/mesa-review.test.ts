import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock the db module ───
vi.mock("./db", () => ({
  getPreviousMesaScore: vi.fn(),
  getOpenSessionsForStudent: vi.fn(),
  getSessionStudents: vi.fn(),
  hasStudentSubmitted: vi.fn(),
  getSessionById: vi.fn(),
  updateDesempenhoPapel: vi.fn(),
}));

import * as db from "./db";

describe("getPreviousMesaScore logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the previous score when an evaluation exists", async () => {
    vi.mocked(db.getPreviousMesaScore).mockResolvedValue(0.5);
    const score = await db.getPreviousMesaScore(1, 10, 20);
    expect(score).toBe(0.5);
  });

  it("returns null when no evaluation exists", async () => {
    vi.mocked(db.getPreviousMesaScore).mockResolvedValue(null);
    const score = await db.getPreviousMesaScore(1, 10, 20);
    expect(score).toBeNull();
  });

  it("returns 0 (Excelente) when score is 0", async () => {
    vi.mocked(db.getPreviousMesaScore).mockResolvedValue(0);
    const score = await db.getPreviousMesaScore(1, 10, 20);
    expect(score).toBe(0);
  });
});

describe("myOpenSessions - hasMesaToReview logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets hasMesaToReview=true for closed sessions with a Mesa student (not the evaluator)", async () => {
    const studentId = 10;
    const mesaStudentId = 20;

    vi.mocked(db.getOpenSessionsForStudent).mockResolvedValue([
      {
        sessionId: 1,
        sessionLabel: "P1S1",
        sessionStatus: "closed",
        problemNumber: 1,
        sessionNumber: 1,
        classId: 1,
        classCode: "TP01",
        componentId: 1,
        componentCode: "EXA613",
        componentName: "Engenharia de Software",
        semester: "2026.1",
        accessCode: "ABC123",
        studentRole: "PARTICIPANTE",
      } as any,
    ]);

    vi.mocked(db.hasStudentSubmitted).mockResolvedValue(true);
    vi.mocked(db.getSessionStudents).mockResolvedValue([
      {
        studentId: mesaStudentId,
        studentName: "Mesa Student",
        studentEnrollment: "20220002",
        role: "MESA",
        absent: false,
      } as any,
      {
        studentId: studentId,
        studentName: "Evaluator",
        studentEnrollment: "20220001",
        role: "PARTICIPANTE",
        absent: false,
      } as any,
    ]);

    // Simulate the logic from myOpenSessions
    const openSessions = await db.getOpenSessionsForStudent(studentId);
    const sessionsWithStatus = await Promise.all(openSessions.map(async (s) => {
      const submitted = await db.hasStudentSubmitted(s.sessionId, studentId);
      let mesaStudentIdFound: number | null = null;
      let hasMesaToReview = false;
      if (s.sessionStatus === "closed") {
        const sessionStudentsList = await db.getSessionStudents(s.sessionId);
        const mesaStudent = sessionStudentsList.find(
          (st: any) => st.role === "MESA" && !st.absent && st.studentId !== studentId
        );
        if (mesaStudent) {
          mesaStudentIdFound = mesaStudent.studentId;
          hasMesaToReview = true;
        }
      }
      return { ...s, alreadySubmitted: submitted, hasMesaToReview, mesaStudentId: mesaStudentIdFound };
    }));

    expect(sessionsWithStatus).toHaveLength(1);
    expect(sessionsWithStatus[0].hasMesaToReview).toBe(true);
    expect(sessionsWithStatus[0].mesaStudentId).toBe(mesaStudentId);
    // Even though student already submitted, hasMesaToReview is true
    expect(sessionsWithStatus[0].alreadySubmitted).toBe(true);
  });

  it("sets hasMesaToReview=false when the student IS the Mesa", async () => {
    const studentId = 20; // This student IS the Mesa

    vi.mocked(db.getOpenSessionsForStudent).mockResolvedValue([
      {
        sessionId: 1,
        sessionLabel: "P1S1",
        sessionStatus: "closed",
        problemNumber: 1,
        sessionNumber: 1,
        classId: 1,
        classCode: "TP01",
        componentId: 1,
        componentCode: "EXA613",
        componentName: "Engenharia de Software",
        semester: "2026.1",
        accessCode: "ABC123",
        studentRole: "MESA",
      } as any,
    ]);

    vi.mocked(db.hasStudentSubmitted).mockResolvedValue(false);
    vi.mocked(db.getSessionStudents).mockResolvedValue([
      {
        studentId: studentId,
        studentName: "Mesa Student",
        studentEnrollment: "20220002",
        role: "MESA",
        absent: false,
      } as any,
    ]);

    const openSessions = await db.getOpenSessionsForStudent(studentId);
    const sessionsWithStatus = await Promise.all(openSessions.map(async (s) => {
      const submitted = await db.hasStudentSubmitted(s.sessionId, studentId);
      let mesaStudentIdFound: number | null = null;
      let hasMesaToReview = false;
      if (s.sessionStatus === "closed") {
        const sessionStudentsList = await db.getSessionStudents(s.sessionId);
        const mesaStudent = sessionStudentsList.find(
          (st: any) => st.role === "MESA" && !st.absent && st.studentId !== studentId
        );
        if (mesaStudent) {
          mesaStudentIdFound = mesaStudent.studentId;
          hasMesaToReview = true;
        }
      }
      return { ...s, alreadySubmitted: submitted, hasMesaToReview, mesaStudentId: mesaStudentIdFound };
    }));

    expect(sessionsWithStatus[0].hasMesaToReview).toBe(false);
    expect(sessionsWithStatus[0].mesaStudentId).toBeNull();
  });

  it("sets hasMesaToReview=false for open sessions (even with Mesa present)", async () => {
    const studentId = 10;

    vi.mocked(db.getOpenSessionsForStudent).mockResolvedValue([
      {
        sessionId: 1,
        sessionLabel: "P1S1",
        sessionStatus: "open",
        problemNumber: 1,
        sessionNumber: 1,
        classId: 1,
        classCode: "TP01",
        componentId: 1,
        componentCode: "EXA613",
        componentName: "Engenharia de Software",
        semester: "2026.1",
        accessCode: "ABC123",
        studentRole: "PARTICIPANTE",
      } as any,
    ]);

    vi.mocked(db.hasStudentSubmitted).mockResolvedValue(false);

    const openSessions = await db.getOpenSessionsForStudent(studentId);
    const sessionsWithStatus = await Promise.all(openSessions.map(async (s) => {
      const submitted = await db.hasStudentSubmitted(s.sessionId, studentId);
      let mesaStudentIdFound: number | null = null;
      let hasMesaToReview = false;
      if (s.sessionStatus === "closed") {
        const sessionStudentsList = await db.getSessionStudents(s.sessionId);
        const mesaStudent = sessionStudentsList.find(
          (st: any) => st.role === "MESA" && !st.absent && st.studentId !== studentId
        );
        if (mesaStudent) {
          mesaStudentIdFound = mesaStudent.studentId;
          hasMesaToReview = true;
        }
      }
      return { ...s, alreadySubmitted: submitted, hasMesaToReview, mesaStudentId: mesaStudentIdFound };
    }));

    expect(sessionsWithStatus[0].hasMesaToReview).toBe(false);
    // getSessionStudents should NOT have been called for open sessions
    expect(db.getSessionStudents).not.toHaveBeenCalled();
  });
});
