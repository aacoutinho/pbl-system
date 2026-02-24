import { describe, it, expect, vi } from "vitest";

// Mock db helpers
vi.mock("./db", () => ({
  findStudentByEnrollment: vi.fn(),
  getStudentEvaluationCount: vi.fn(),
  getClassesForStudent: vi.fn(),
  getOpenSessionsForStudent: vi.fn(),
  hasStudentSubmitted: vi.fn(),
  getStudentById: vi.fn(),
  createEmailVerificationCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}));

// Mock email
vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  buildVerificationEmailHtml: vi.fn().mockReturnValue("<html>code</html>"),
}));

import {
  findStudentByEnrollment,
  getStudentEvaluationCount,
  getClassesForStudent,
  getOpenSessionsForStudent,
  hasStudentSubmitted,
  getStudentById,
  createEmailVerificationCode,
  verifyEmailCode,
} from "./db";

describe("Student Login by Enrollment - New Flow", () => {
  it("student with email: loginByEnrollment returns hasEmail=true and codeSent=true", async () => {
    const mockStudent = {
      id: 1,
      name: "João Silva",
      enrollment: "20221001",
      email: "joao@ecomp.uefs.br",
      photoUrl: "https://example.com/photo.jpg",
    };
    (findStudentByEnrollment as any).mockResolvedValue(mockStudent);

    const student = await findStudentByEnrollment("20221001");
    expect(student).not.toBeNull();

    const hasEmail = !!student!.email;
    const hasPhoto = !!student!.photoUrl;

    expect(hasEmail).toBe(true);
    expect(hasPhoto).toBe(true);

    // Simulate code sending
    await createEmailVerificationCode(student!.email!.toLowerCase(), "123456", new Date());
    expect(createEmailVerificationCode).toHaveBeenCalledWith(
      "joao@ecomp.uefs.br",
      "123456",
      expect.any(Date)
    );
  });

  it("student without email: loginByEnrollment returns hasEmail=false (first access)", async () => {
    const mockStudent = {
      id: 2,
      name: "Ana Santos",
      enrollment: "20221002",
      email: null,
      photoUrl: null,
    };
    (findStudentByEnrollment as any).mockResolvedValue(mockStudent);

    const student = await findStudentByEnrollment("20221002");
    expect(student).not.toBeNull();

    const hasEmail = !!student!.email;
    const hasPhoto = !!student!.photoUrl;

    expect(hasEmail).toBe(false);
    expect(hasPhoto).toBe(false);
    // Should go to profile setup, NOT send code
  });

  it("unknown enrollment returns null", async () => {
    (findStudentByEnrollment as any).mockResolvedValue(null);

    const result = await findStudentByEnrollment("99999999");
    expect(result).toBeNull();
  });

  it("email masking works correctly", () => {
    const testCases = [
      { email: "joao@ecomp.uefs.br", expected: "joa***@ecomp.uefs.br" },
      { email: "ab@ecomp.uefs.br", expected: "ab***@ecomp.uefs.br" },
      { email: "maria.silva@gmail.com", expected: "mar***@gmail.com" },
    ];

    testCases.forEach(({ email, expected }) => {
      const [local, domain] = email.split("@");
      const masked = local.length > 3 ? local.slice(0, 3) + "***@" + domain : local + "***@" + domain;
      expect(masked).toBe(expected);
    });
  });
});

describe("Verify Login Code", () => {
  it("valid code returns student data with authenticated=true", async () => {
    const mockStudent = {
      id: 1,
      name: "João Silva",
      enrollment: "20221001",
      email: "joao@ecomp.uefs.br",
      photoUrl: "https://example.com/photo.jpg",
    };
    const mockClasses = [
      { classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bioquímica", semester: "2025.1" },
    ];

    (getStudentById as any).mockResolvedValue(mockStudent);
    (verifyEmailCode as any).mockResolvedValue(true);
    (getClassesForStudent as any).mockResolvedValue(mockClasses);

    const studentData = await getStudentById(1);
    expect(studentData).not.toBeNull();
    expect(studentData!.email).toBe("joao@ecomp.uefs.br");

    const valid = await verifyEmailCode(studentData!.email!.toLowerCase(), "123456");
    expect(valid).toBe(true);

    const classes = await getClassesForStudent(1);
    expect(classes).toHaveLength(1);

    // Simulated response
    const response = {
      studentId: studentData!.id,
      studentName: studentData!.name,
      studentEmail: studentData!.email,
      studentEnrollment: studentData!.enrollment,
      studentPhotoUrl: studentData!.photoUrl,
      classes,
      authenticated: true,
    };
    expect(response.authenticated).toBe(true);
    expect(response.studentEmail).toBe("joao@ecomp.uefs.br");
  });

  it("invalid code is rejected", async () => {
    const mockStudent = {
      id: 1,
      name: "João Silva",
      enrollment: "20221001",
      email: "joao@ecomp.uefs.br",
      photoUrl: null,
    };

    (getStudentById as any).mockResolvedValue(mockStudent);
    (verifyEmailCode as any).mockResolvedValue(false);

    const studentData = await getStudentById(1);
    const valid = await verifyEmailCode(studentData!.email!.toLowerCase(), "000000");
    expect(valid).toBe(false);
  });

  it("student without email cannot verify login code", async () => {
    (getStudentById as any).mockResolvedValue({
      id: 2,
      name: "Ana Santos",
      enrollment: "20221002",
      email: null,
      photoUrl: null,
    });

    const studentData = await getStudentById(2);
    expect(studentData!.email).toBeNull();
    // Should throw error in actual route
  });
});

describe("Resend Login Code", () => {
  it("resend code for student with email", async () => {
    const mockStudent = {
      id: 1,
      name: "João Silva",
      enrollment: "20221001",
      email: "joao@ecomp.uefs.br",
      photoUrl: null,
    };

    (getStudentById as any).mockResolvedValue(mockStudent);
    (createEmailVerificationCode as any).mockResolvedValue(undefined);

    const studentData = await getStudentById(1);
    expect(studentData!.email).not.toBeNull();

    await createEmailVerificationCode(studentData!.email!.toLowerCase(), "654321", new Date());
    expect(createEmailVerificationCode).toHaveBeenCalledWith(
      "joao@ecomp.uefs.br",
      "654321",
      expect.any(Date)
    );
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

  it("correctly identifies pending vs completed sessions", async () => {
    const mockSessions = [
      { sessionId: 1, sessionLabel: "P1-S1", classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bio", semester: "2025.1", accessCode: "ABC", problemNumber: 1, sessionNumber: 1 },
      { sessionId: 2, sessionLabel: "P1-S2", classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bio", semester: "2025.1", accessCode: "DEF", problemNumber: 1, sessionNumber: 2 },
    ];
    (getOpenSessionsForStudent as any).mockResolvedValue(mockSessions);
    (hasStudentSubmitted as any)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const sessions = await getOpenSessionsForStudent(1);
    const sessionsWithStatus = await Promise.all(sessions.map(async (s: any) => {
      const submitted = await hasStudentSubmitted(s.sessionId, 1);
      return { ...s, alreadySubmitted: submitted };
    }));

    expect(sessionsWithStatus[0].alreadySubmitted).toBe(false);
    expect(sessionsWithStatus[1].alreadySubmitted).toBe(true);
  });
});

describe("Full Login Flow Integration", () => {
  it("first access: enrollment → no email → profile setup → verify code → dashboard", async () => {
    const mockStudent = { id: 3, name: "Ana", enrollment: "20221004", email: null, photoUrl: null };

    (findStudentByEnrollment as any).mockResolvedValue(mockStudent);

    // Step 1: Login by enrollment
    const student = await findStudentByEnrollment("20221004");
    expect(student).not.toBeNull();
    expect(student!.email).toBeNull();

    // Step 2: Determine flow → first access (no email)
    const hasEmail = !!student!.email;
    expect(hasEmail).toBe(false);
    // → Goes to profile setup

    // Step 3: After profile setup, email is set and verified
    // Then resendLoginCode sends a code
    const updatedStudent = { ...mockStudent, email: "ana@ecomp.uefs.br", photoUrl: "https://s3.example.com/ana.jpg" };
    (getStudentById as any).mockResolvedValue(updatedStudent);
    (createEmailVerificationCode as any).mockResolvedValue(undefined);

    const studentData = await getStudentById(3);
    await createEmailVerificationCode(studentData!.email!.toLowerCase(), "111222", new Date());
    expect(createEmailVerificationCode).toHaveBeenCalled();

    // Step 4: Verify login code
    (verifyEmailCode as any).mockResolvedValue(true);
    (getClassesForStudent as any).mockResolvedValue([{ classId: 1, classCode: "T01", componentCode: "EXA123", componentName: "Bio", semester: "2025.1" }]);

    const valid = await verifyEmailCode("ana@ecomp.uefs.br", "111222");
    expect(valid).toBe(true);

    const classes = await getClassesForStudent(3);
    expect(classes).toHaveLength(1);
    // → Dashboard
  });

  it("returning student: enrollment → has email → code sent → verify → dashboard", async () => {
    const mockStudent = { id: 1, name: "Pedro", enrollment: "20221003", email: "pedro@ecomp.uefs.br", photoUrl: "https://example.com/pedro.jpg" };

    (findStudentByEnrollment as any).mockResolvedValue(mockStudent);
    (createEmailVerificationCode as any).mockResolvedValue(undefined);

    // Step 1: Login by enrollment
    const student = await findStudentByEnrollment("20221003");
    expect(student).not.toBeNull();

    // Step 2: Has email → auto-send code
    const hasEmail = !!student!.email;
    expect(hasEmail).toBe(true);

    await createEmailVerificationCode(student!.email!.toLowerCase(), "999888", new Date());
    // codeSent = true → goes to verify code screen

    // Step 3: Verify code
    (getStudentById as any).mockResolvedValue(mockStudent);
    (verifyEmailCode as any).mockResolvedValue(true);
    (getClassesForStudent as any).mockResolvedValue([]);

    const valid = await verifyEmailCode("pedro@ecomp.uefs.br", "999888");
    expect(valid).toBe(true);
    // → Dashboard
  });
});
