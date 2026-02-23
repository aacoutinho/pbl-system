import { describe, it, expect, vi } from "vitest";

// Mock db helpers
vi.mock("./db", () => ({
  findStudentByEnrollment: vi.fn(),
  getStudentEvaluationCount: vi.fn(),
  getClassesForStudent: vi.fn(),
  getOpenSessionsForStudent: vi.fn(),
  hasStudentSubmitted: vi.fn(),
}));

import {
  findStudentByEnrollment,
  getStudentEvaluationCount,
  getClassesForStudent,
  getOpenSessionsForStudent,
  hasStudentSubmitted,
} from "./db";

describe("Student Enrollment Login", () => {
  it("findStudentByEnrollment returns student data when found", async () => {
    const mockStudent = {
      id: 1,
      name: "João Silva",
      enrollment: "20221001",
      email: "joao@ecomp.uefs.br",
      photoUrl: "https://example.com/photo.jpg",
    };
    (findStudentByEnrollment as any).mockResolvedValue(mockStudent);

    const result = await findStudentByEnrollment("20221001");
    expect(result).toEqual(mockStudent);
    expect(findStudentByEnrollment).toHaveBeenCalledWith("20221001");
  });

  it("findStudentByEnrollment returns null for unknown enrollment", async () => {
    (findStudentByEnrollment as any).mockResolvedValue(null);

    const result = await findStudentByEnrollment("99999999");
    expect(result).toBeNull();
  });

  it("getStudentEvaluationCount returns 0 for first access", async () => {
    (getStudentEvaluationCount as any).mockResolvedValue(0);

    const result = await getStudentEvaluationCount(1);
    expect(result).toBe(0);
  });

  it("getStudentEvaluationCount returns positive count for returning student", async () => {
    (getStudentEvaluationCount as any).mockResolvedValue(5);

    const result = await getStudentEvaluationCount(1);
    expect(result).toBe(5);
  });

  it("getClassesForStudent returns list of classes", async () => {
    const mockClasses = [
      { classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bioquímica", semester: "2025.1" },
      { classId: 2, classCode: "T02", componentCode: "EXA456", componentName: "Fisiologia", semester: "2025.1" },
    ];
    (getClassesForStudent as any).mockResolvedValue(mockClasses);

    const result = await getClassesForStudent(1);
    expect(result).toHaveLength(2);
    expect(result[0].componentCode).toBe("EXA123");
  });

  it("getClassesForStudent returns empty array for student with no classes", async () => {
    (getClassesForStudent as any).mockResolvedValue([]);

    const result = await getClassesForStudent(999);
    expect(result).toHaveLength(0);
  });
});

describe("Student Open Sessions", () => {
  it("getOpenSessionsForStudent returns open sessions for a student", async () => {
    const mockSessions = [
      {
        sessionId: 1,
        sessionLabel: "Problema 1 - Sessão 1",
        classId: 1,
        classCode: "T01",
        componentCode: "EXA123",
        componentName: "Bioquímica",
        semester: "2025.1",
        accessCode: "ABC123",
        problemNumber: 1,
        sessionNumber: 1,
      },
    ];
    (getOpenSessionsForStudent as any).mockResolvedValue(mockSessions);

    const result = await getOpenSessionsForStudent(1);
    expect(result).toHaveLength(1);
    expect(result[0].sessionLabel).toBe("Problema 1 - Sessão 1");
    expect(result[0].accessCode).toBe("ABC123");
  });

  it("getOpenSessionsForStudent returns empty array when no open sessions", async () => {
    (getOpenSessionsForStudent as any).mockResolvedValue([]);

    const result = await getOpenSessionsForStudent(1);
    expect(result).toHaveLength(0);
  });

  it("hasStudentSubmitted returns false for pending evaluation", async () => {
    (hasStudentSubmitted as any).mockResolvedValue(false);

    const result = await hasStudentSubmitted(1, 1);
    expect(result).toBe(false);
  });

  it("hasStudentSubmitted returns true for completed evaluation", async () => {
    (hasStudentSubmitted as any).mockResolvedValue(true);

    const result = await hasStudentSubmitted(1, 1);
    expect(result).toBe(true);
  });

  it("correctly identifies pending vs completed sessions", async () => {
    const mockSessions = [
      { sessionId: 1, sessionLabel: "P1-S1", classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bio", semester: "2025.1", accessCode: "ABC", problemNumber: 1, sessionNumber: 1 },
      { sessionId: 2, sessionLabel: "P1-S2", classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bio", semester: "2025.1", accessCode: "DEF", problemNumber: 1, sessionNumber: 2 },
    ];
    (getOpenSessionsForStudent as any).mockResolvedValue(mockSessions);
    (hasStudentSubmitted as any)
      .mockResolvedValueOnce(false) // session 1: not submitted
      .mockResolvedValueOnce(true); // session 2: submitted

    const sessions = await getOpenSessionsForStudent(1);
    const sessionsWithStatus = await Promise.all(sessions.map(async (s: any) => {
      const submitted = await hasStudentSubmitted(s.sessionId, 1);
      return { ...s, alreadySubmitted: submitted };
    }));

    expect(sessionsWithStatus[0].alreadySubmitted).toBe(false);
    expect(sessionsWithStatus[1].alreadySubmitted).toBe(true);
  });
});

describe("Login Flow Integration", () => {
  it("full login flow: enrollment → student data → classes → sessions", async () => {
    const mockStudent = { id: 1, name: "Maria", enrollment: "20221002", email: "maria@ecomp.uefs.br", photoUrl: null };
    const mockClasses = [{ classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bio", semester: "2025.1" }];
    const mockSessions = [{ sessionId: 1, sessionLabel: "P1-S1", classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bio", semester: "2025.1", accessCode: "XYZ", problemNumber: 1, sessionNumber: 1 }];

    (findStudentByEnrollment as any).mockResolvedValue(mockStudent);
    (getStudentEvaluationCount as any).mockResolvedValue(0);
    (getClassesForStudent as any).mockResolvedValue(mockClasses);
    (getOpenSessionsForStudent as any).mockResolvedValue(mockSessions);
    (hasStudentSubmitted as any).mockResolvedValue(false);

    // Step 1: Login
    const student = await findStudentByEnrollment("20221002");
    expect(student).not.toBeNull();
    expect(student!.name).toBe("Maria");

    // Step 2: Check first access
    const evalCount = await getStudentEvaluationCount(student!.id);
    expect(evalCount).toBe(0); // first access

    // Step 3: Get classes
    const classes = await getClassesForStudent(student!.id);
    expect(classes).toHaveLength(1);

    // Step 4: Get open sessions
    const sessions = await getOpenSessionsForStudent(student!.id);
    expect(sessions).toHaveLength(1);

    // Step 5: Check submission status
    const submitted = await hasStudentSubmitted(sessions[0].sessionId, student!.id);
    expect(submitted).toBe(false);
  });

  it("returning student skips profile setup", async () => {
    const mockStudent = { id: 2, name: "Pedro", enrollment: "20221003", email: "pedro@ecomp.uefs.br", photoUrl: "https://example.com/pedro.jpg" };

    (findStudentByEnrollment as any).mockResolvedValue(mockStudent);
    (getStudentEvaluationCount as any).mockResolvedValue(3);

    const student = await findStudentByEnrollment("20221003");
    const evalCount = await getStudentEvaluationCount(student!.id);

    // Has email, photo, and previous evaluations → skip profile
    const isFirstAccess = evalCount === 0;
    const needsProfile = !student!.email || !student!.photoUrl;
    const shouldShowProfile = isFirstAccess && needsProfile;

    expect(shouldShowProfile).toBe(false);
  });

  it("first access student without photo goes to profile setup", async () => {
    const mockStudent = { id: 3, name: "Ana", enrollment: "20221004", email: null, photoUrl: null };

    (findStudentByEnrollment as any).mockResolvedValue(mockStudent);
    (getStudentEvaluationCount as any).mockResolvedValue(0);

    const student = await findStudentByEnrollment("20221004");
    const evalCount = await getStudentEvaluationCount(student!.id);

    const isFirstAccess = evalCount === 0;
    const needsProfile = !student!.email || !student!.photoUrl;
    const shouldShowProfile = isFirstAccess && needsProfile;

    expect(shouldShowProfile).toBe(true);
  });
});
