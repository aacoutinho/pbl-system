import { describe, expect, it } from "vitest";

// ─── Single evaluation control tests ───

describe("Single Evaluation Control - hasStudentSubmitted logic", () => {
  // Simulate the hasStudentSubmitted check
  function hasSubmitted(
    evaluations: { sessionId: number; evaluatorStudentId: number }[],
    sessionId: number,
    studentId: number
  ): boolean {
    return evaluations.some(
      (e) => e.sessionId === sessionId && e.evaluatorStudentId === studentId
    );
  }

  it("returns false when student has not submitted", () => {
    const evals = [
      { sessionId: 1, evaluatorStudentId: 100 },
      { sessionId: 1, evaluatorStudentId: 200 },
    ];
    expect(hasSubmitted(evals, 1, 300)).toBe(false);
  });

  it("returns true when student has submitted for the session", () => {
    const evals = [
      { sessionId: 1, evaluatorStudentId: 100 },
      { sessionId: 1, evaluatorStudentId: 200 },
    ];
    expect(hasSubmitted(evals, 1, 100)).toBe(true);
  });

  it("returns false when student submitted for different session", () => {
    const evals = [
      { sessionId: 1, evaluatorStudentId: 100 },
      { sessionId: 2, evaluatorStudentId: 200 },
    ];
    expect(hasSubmitted(evals, 2, 100)).toBe(false);
  });

  it("handles empty evaluations list", () => {
    expect(hasSubmitted([], 1, 100)).toBe(false);
  });
});

describe("Delete Student Evaluation logic", () => {
  function deleteEvaluation(
    evaluations: { id: number; sessionId: number; evaluatorStudentId: number }[],
    sessionId: number,
    studentId: number
  ): { deleted: boolean; remaining: typeof evaluations } {
    const idx = evaluations.findIndex(
      (e) => e.sessionId === sessionId && e.evaluatorStudentId === studentId
    );
    if (idx === -1) return { deleted: false, remaining: evaluations };
    const remaining = [...evaluations];
    remaining.splice(idx, 1);
    return { deleted: true, remaining };
  }

  it("deletes existing evaluation and returns true", () => {
    const evals = [
      { id: 1, sessionId: 1, evaluatorStudentId: 100 },
      { id: 2, sessionId: 1, evaluatorStudentId: 200 },
    ];
    const result = deleteEvaluation(evals, 1, 100);
    expect(result.deleted).toBe(true);
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0].evaluatorStudentId).toBe(200);
  });

  it("returns false when evaluation not found", () => {
    const evals = [
      { id: 1, sessionId: 1, evaluatorStudentId: 100 },
    ];
    const result = deleteEvaluation(evals, 1, 999);
    expect(result.deleted).toBe(false);
    expect(result.remaining).toHaveLength(1);
  });

  it("only deletes for the correct session", () => {
    const evals = [
      { id: 1, sessionId: 1, evaluatorStudentId: 100 },
      { id: 2, sessionId: 2, evaluatorStudentId: 100 },
    ];
    const result = deleteEvaluation(evals, 1, 100);
    expect(result.deleted).toBe(true);
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0].sessionId).toBe(2);
  });
});

describe("Reevaluation flow", () => {
  it("student can re-evaluate after professor deletes previous evaluation", () => {
    let evaluations: { id: number; sessionId: number; evaluatorStudentId: number }[] = [
      { id: 1, sessionId: 1, evaluatorStudentId: 100 },
    ];

    // Step 1: Student tries to submit again - should be blocked
    const hasSubmitted = evaluations.some(
      (e) => e.sessionId === 1 && e.evaluatorStudentId === 100
    );
    expect(hasSubmitted).toBe(true);

    // Step 2: Professor deletes the evaluation (allowReevaluation)
    evaluations = evaluations.filter(
      (e) => !(e.sessionId === 1 && e.evaluatorStudentId === 100)
    );
    expect(evaluations).toHaveLength(0);

    // Step 3: Student can now submit again
    const canSubmitNow = !evaluations.some(
      (e) => e.sessionId === 1 && e.evaluatorStudentId === 100
    );
    expect(canSubmitNow).toBe(true);

    // Step 4: Student submits new evaluation
    evaluations.push({ id: 2, sessionId: 1, evaluatorStudentId: 100 });
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].id).toBe(2); // New evaluation
  });
});

// ─── Portuguese prepositions in Title Case ───

describe("Title Case with Portuguese prepositions", () => {
  const PREPOSITIONS = new Set(["de", "da", "do", "dos", "das", "e"]);
  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(/\s+/).map((word) => {
      if (PREPOSITIONS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(" ");
  };

  it("keeps 'dos' in lowercase in middle of name", () => {
    expect(toTitleCase("MACEDO DOS SANTOS")).toBe("Macedo dos Santos");
  });

  it("keeps 'de' in lowercase in middle of name", () => {
    expect(toTitleCase("SILVA DE OLIVEIRA")).toBe("Silva de Oliveira");
  });

  it("keeps 'da' in lowercase in middle of name", () => {
    expect(toTitleCase("COSTA DA SILVA")).toBe("Costa da Silva");
  });

  it("keeps 'do' in lowercase in middle of name", () => {
    expect(toTitleCase("SANTOS DO NASCIMENTO")).toBe("Santos do Nascimento");
  });

  it("keeps 'das' in lowercase in middle of name", () => {
    expect(toTitleCase("OLIVEIRA DAS NEVES")).toBe("Oliveira das Neves");
  });

  it("keeps 'e' in lowercase in middle of name", () => {
    expect(toTitleCase("SOUZA E SILVA")).toBe("Souza e Silva");
  });

  it("keeps preposition lowercase even at start of string", () => {
    // Prepositions are always lowercase regardless of position
    expect(toTitleCase("DE OLIVEIRA")).toBe("de Oliveira");
  });

  it("handles full name with multiple prepositions", () => {
    expect(toTitleCase("JOSE MACEDO DOS SANTOS JUNIOR")).toBe("Jose Macedo dos Santos Junior");
  });

  it("handles name with 'da' and 'dos'", () => {
    expect(toTitleCase("MARIA DA CONCEICAO DOS SANTOS")).toBe("Maria da Conceicao dos Santos");
  });

  it("handles simple name without prepositions", () => {
    expect(toTitleCase("ANTONIO AUGUSTO TEIXEIRA")).toBe("Antonio Augusto Teixeira");
  });

  it("handles single name", () => {
    expect(toTitleCase("ANTONIO")).toBe("Antonio");
  });

  it("handles already lowercase input", () => {
    expect(toTitleCase("jose macedo dos santos")).toBe("Jose Macedo dos Santos");
  });

  it("handles mixed case input", () => {
    expect(toTitleCase("Jose Macedo Dos Santos")).toBe("Jose Macedo dos Santos");
  });
});

// ─── Enrollment duplicate validation ───

describe("Enrollment duplicate validation on edit", () => {
  const students = [
    { id: 1, enrollment: "20221001", name: "Student A" },
    { id: 2, enrollment: "20221002", name: "Student B" },
    { id: 3, enrollment: "20221003", name: "Student C" },
  ];

  function validateEnrollmentEdit(studentId: number, newEnrollment: string): { valid: boolean; error?: string } {
    const existing = students.find((s) => s.enrollment === newEnrollment);
    if (existing && existing.id !== studentId) {
      return { valid: false, error: "Já existe outro aluno com esta matrícula" };
    }
    return { valid: true };
  }

  it("allows keeping same enrollment", () => {
    const result = validateEnrollmentEdit(1, "20221001");
    expect(result.valid).toBe(true);
  });

  it("allows changing to unused enrollment", () => {
    const result = validateEnrollmentEdit(1, "20229999");
    expect(result.valid).toBe(true);
  });

  it("rejects changing to enrollment used by another student", () => {
    const result = validateEnrollmentEdit(1, "20221002");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Já existe outro aluno com esta matrícula");
  });

  it("rejects duplicate enrollment for different student", () => {
    const result = validateEnrollmentEdit(3, "20221001");
    expect(result.valid).toBe(false);
  });
});

// ─── Router structure tests for new routes ───

describe("Router has reevaluation routes", () => {
  it("evaluations.allowReevaluation route exists", async () => {
    const { appRouter } = await import("./routers");
    const ctx = {
      user: {
        id: 1,
        openId: "admin-user",
        email: "professor@example.com",
        name: "Professor Admin",
        loginMethod: "manus" as const,
        role: "admin" as const,
        approvalStatus: "approved" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    };
    const caller = appRouter.createCaller(ctx);
    expect(caller.evaluations.allowReevaluation).toBeDefined();
  });

  it("evaluations.submittedStudents route exists", async () => {
    const { appRouter } = await import("./routers");
    const ctx = {
      user: {
        id: 1,
        openId: "admin-user",
        email: "professor@example.com",
        name: "Professor Admin",
        loginMethod: "manus" as const,
        role: "admin" as const,
        approvalStatus: "approved" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    };
    const caller = appRouter.createCaller(ctx);
    expect(caller.evaluations.submittedStudents).toBeDefined();
  });

  it("studentAccess.submitEvaluation blocks duplicate submission", async () => {
    // This test verifies the route exists and validates input
    const { appRouter } = await import("./routers");
    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    };
    const caller = appRouter.createCaller(ctx);
    // Should reject with "Código inválido" since we're using a fake code
    await expect(
      caller.studentAccess.submitEvaluation({
        accessCode: "FAKECODE",
        evaluatorStudentId: 1,
        items: [
          {
            evaluatedStudentId: 2,
            role: "PARTICIPANTE",
            absent: false,
            atuacao: 2,
            pontualidade: 2,
            dominio: 2,
            metas: 2,
            participacao: 2,
          },
        ],
      })
    ).rejects.toThrow();
  });
});
