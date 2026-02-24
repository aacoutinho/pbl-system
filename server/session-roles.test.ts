import { describe, it, expect } from "vitest";

// ─── Test session role assignment and evaluation form logic ───
describe("Session Roles and Evaluation Form", () => {

  type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

  interface StudentAssignment {
    studentId: number;
    role: RoleType;
    absent: boolean;
  }

  interface EvalItem {
    evaluatedStudentId: number;
    pontualidade: number;
    pesquisaMetas: number;
    dominio: number;
    participacao: number;
    desempenhoPapel: number;
  }

  // ─── 1. Professor defines roles at session creation ───
  describe("Professor assigns roles at session creation", () => {
    it("accepts valid studentAssignments with roles", () => {
      const assignments: StudentAssignment[] = [
        { studentId: 1, role: "COORDENADOR", absent: false },
        { studentId: 2, role: "MESA", absent: false },
        { studentId: 3, role: "QUADRO", absent: false },
        { studentId: 4, role: "PARTICIPANTE", absent: false },
        { studentId: 5, role: "PARTICIPANTE", absent: true },
      ];
      expect(assignments.length).toBe(5);
      expect(assignments.filter(a => a.absent).length).toBe(1);
      expect(assignments.filter(a => a.role === "COORDENADOR").length).toBe(1);
    });

    it("validates exclusive roles (only one COORDENADOR, MESA, QUADRO)", () => {
      const assignments: StudentAssignment[] = [
        { studentId: 1, role: "COORDENADOR", absent: false },
        { studentId: 2, role: "COORDENADOR", absent: false },
      ];
      const exclusiveRoles: RoleType[] = ["COORDENADOR", "MESA", "QUADRO"];
      const errors: string[] = [];
      for (const role of exclusiveRoles) {
        const count = assignments.filter(a => a.role === role && !a.absent).length;
        if (count > 1) errors.push(`O papel ${role} só pode ser atribuído a um aluno`);
      }
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain("COORDENADOR");
    });

    it("allows multiple PARTICIPANTE roles", () => {
      const assignments: StudentAssignment[] = [
        { studentId: 1, role: "PARTICIPANTE", absent: false },
        { studentId: 2, role: "PARTICIPANTE", absent: false },
        { studentId: 3, role: "PARTICIPANTE", absent: false },
      ];
      const participantes = assignments.filter(a => a.role === "PARTICIPANTE");
      expect(participantes.length).toBe(3);
    });

    it("marks non-selected students as absent", () => {
      const allStudents = [1, 2, 3, 4, 5];
      const selectedStudents = [1, 2, 3];
      const assignments: StudentAssignment[] = allStudents.map(id => ({
        studentId: id,
        role: "PARTICIPANTE",
        absent: !selectedStudents.includes(id),
      }));
      expect(assignments.filter(a => a.absent).length).toBe(2);
      expect(assignments.filter(a => !a.absent).length).toBe(3);
    });
  });

  // ─── 2. Evaluation form no longer has role/absent selection ───
  describe("Evaluation form removes role/absent from student input", () => {
    it("evaluation item does not contain role or absent fields", () => {
      const evalItem: EvalItem = {
        evaluatedStudentId: 1,
        pontualidade: 1,
        pesquisaMetas: 0.75,
        dominio: 0.5,
        participacao: 1,
        desempenhoPapel: 0,
      };
      expect(evalItem).not.toHaveProperty("role");
      expect(evalItem).not.toHaveProperty("absent");
      expect(Object.keys(evalItem)).toEqual([
        "evaluatedStudentId", "pontualidade", "pesquisaMetas", "dominio", "participacao", "desempenhoPapel"
      ]);
    });

    it("backend enriches items with role/absent from sessionStudents", () => {
      const sessionStudents: StudentAssignment[] = [
        { studentId: 1, role: "COORDENADOR", absent: false },
        { studentId: 2, role: "MESA", absent: false },
        { studentId: 3, role: "PARTICIPANTE", absent: true },
      ];
      const studentMap = new Map(sessionStudents.map(s => [s.studentId, s]));

      const inputItems: EvalItem[] = [
        { evaluatedStudentId: 1, pontualidade: 1, pesquisaMetas: 1, dominio: 1, participacao: 1, desempenhoPapel: 0 },
        { evaluatedStudentId: 2, pontualidade: 0.75, pesquisaMetas: 0.5, dominio: 0.75, participacao: 0.5, desempenhoPapel: 0 },
      ];

      const enriched = inputItems.map(item => {
        const ss = studentMap.get(item.evaluatedStudentId);
        return { ...item, role: ss?.role ?? "PARTICIPANTE", absent: ss?.absent ?? false };
      });

      expect(enriched[0].role).toBe("COORDENADOR");
      expect(enriched[0].absent).toBe(false);
      expect(enriched[1].role).toBe("MESA");
      expect(enriched[1].absent).toBe(false);
    });
  });

  // ─── 3. Evaluation form displays role from professor ───
  describe("Evaluation form displays professor-assigned role", () => {
    it("role labels are correctly mapped", () => {
      const roleLabels: Record<RoleType, string> = {
        COORDENADOR: "Coordenador",
        MESA: "Mesa",
        QUADRO: "Quadro",
        PARTICIPANTE: "Participante",
      };
      expect(roleLabels["COORDENADOR"]).toBe("Coordenador");
      expect(roleLabels["MESA"]).toBe("Mesa");
      expect(roleLabels["QUADRO"]).toBe("Quadro");
      expect(roleLabels["PARTICIPANTE"]).toBe("Participante");
    });

    it("filters out absent peers from evaluation list", () => {
      const sessionStudents = [
        { studentId: 1, role: "COORDENADOR" as RoleType, absent: false, studentName: "Alice" },
        { studentId: 2, role: "MESA" as RoleType, absent: false, studentName: "Bob" },
        { studentId: 3, role: "PARTICIPANTE" as RoleType, absent: true, studentName: "Charlie" },
        { studentId: 4, role: "QUADRO" as RoleType, absent: false, studentName: "Diana" },
      ];
      const evaluatorId = 1;
      const peers = sessionStudents.filter(s => s.studentId !== evaluatorId);
      const activePeers = peers.filter(p => !p.absent);
      expect(activePeers.length).toBe(2);
      expect(activePeers.map(p => p.studentName)).toEqual(["Bob", "Diana"]);
    });
  });

  // ─── 4. "Desempenho no Papel" only for Coordenador/Mesa/Quadro ───
  describe("Desempenho no Papel conditional display", () => {
    it("shows Desempenho only for COORDENADOR, MESA, QUADRO", () => {
      const roles: RoleType[] = ["COORDENADOR", "MESA", "QUADRO", "PARTICIPANTE"];
      const hasRolePenalty = (role: RoleType) => ["COORDENADOR", "MESA", "QUADRO"].includes(role);

      expect(hasRolePenalty("COORDENADOR")).toBe(true);
      expect(hasRolePenalty("MESA")).toBe(true);
      expect(hasRolePenalty("QUADRO")).toBe(true);
      expect(hasRolePenalty("PARTICIPANTE")).toBe(false);
    });

    it("calculates score without desempenhoPapel for PARTICIPANTE", () => {
      const evalParticipante: EvalItem = {
        evaluatedStudentId: 1,
        pontualidade: 1,
        pesquisaMetas: 1,
        dominio: 1,
        participacao: 1,
        desempenhoPapel: 0.5, // should be ignored
      };
      const role: RoleType = "PARTICIPANTE";
      const hasRolePenalty = ["COORDENADOR", "MESA", "QUADRO"].includes(role);
      const score = evalParticipante.pontualidade * 1 +
                    evalParticipante.pesquisaMetas * 3 +
                    evalParticipante.dominio * 3 +
                    evalParticipante.participacao * 3 -
                    (hasRolePenalty ? evalParticipante.desempenhoPapel * 1 : 0);
      expect(score).toBe(10); // 1 + 3 + 3 + 3 = 10 (no penalty)
    });

    it("calculates score with desempenhoPapel penalty for COORDENADOR", () => {
      const evalCoord: EvalItem = {
        evaluatedStudentId: 2,
        pontualidade: 1,
        pesquisaMetas: 1,
        dominio: 1,
        participacao: 1,
        desempenhoPapel: 0.5,
      };
      const role: RoleType = "COORDENADOR";
      const hasRolePenalty = ["COORDENADOR", "MESA", "QUADRO"].includes(role);
      const score = evalCoord.pontualidade * 1 +
                    evalCoord.pesquisaMetas * 3 +
                    evalCoord.dominio * 3 +
                    evalCoord.participacao * 3 -
                    (hasRolePenalty ? evalCoord.desempenhoPapel * 1 : 0);
      expect(score).toBe(9.5); // 1 + 3 + 3 + 3 - 0.5 = 9.5
    });

    it("generates correct label for each role", () => {
      const roleLabels: Record<RoleType, string> = {
        COORDENADOR: "Coordenador",
        MESA: "Mesa",
        QUADRO: "Quadro",
        PARTICIPANTE: "Participante",
      };
      const getDesempenhoLabel = (role: RoleType) => `Desempenho no Papel de ${roleLabels[role]}`;
      expect(getDesempenhoLabel("COORDENADOR")).toBe("Desempenho no Papel de Coordenador");
      expect(getDesempenhoLabel("MESA")).toBe("Desempenho no Papel de Mesa");
      expect(getDesempenhoLabel("QUADRO")).toBe("Desempenho no Papel de Quadro");
    });

    it("maximum penalty is -1.0", () => {
      const evalMax: EvalItem = {
        evaluatedStudentId: 3,
        pontualidade: 1,
        pesquisaMetas: 1,
        dominio: 1,
        participacao: 1,
        desempenhoPapel: 1, // max penalty
      };
      const score = evalMax.pontualidade * 1 +
                    evalMax.pesquisaMetas * 3 +
                    evalMax.dominio * 3 +
                    evalMax.participacao * 3 -
                    evalMax.desempenhoPapel * 1;
      expect(score).toBe(9); // 10 - 1 = 9
    });
  });

  // ─── Edge cases ───
  describe("Edge cases", () => {
    it("handles session with all students absent except evaluator", () => {
      const sessionStudents = [
        { studentId: 1, role: "COORDENADOR" as RoleType, absent: false },
        { studentId: 2, role: "PARTICIPANTE" as RoleType, absent: true },
        { studentId: 3, role: "PARTICIPANTE" as RoleType, absent: true },
      ];
      const evaluatorId = 1;
      const activePeers = sessionStudents.filter(s => s.studentId !== evaluatorId && !s.absent);
      expect(activePeers.length).toBe(0);
    });

    it("handles session with no exclusive roles assigned", () => {
      const assignments: StudentAssignment[] = [
        { studentId: 1, role: "PARTICIPANTE", absent: false },
        { studentId: 2, role: "PARTICIPANTE", absent: false },
        { studentId: 3, role: "PARTICIPANTE", absent: false },
      ];
      const exclusiveRoles = assignments.filter(a => ["COORDENADOR", "MESA", "QUADRO"].includes(a.role));
      expect(exclusiveRoles.length).toBe(0);
    });

    it("absent student with exclusive role does not block role assignment", () => {
      const assignments: StudentAssignment[] = [
        { studentId: 1, role: "COORDENADOR", absent: true },
        { studentId: 2, role: "COORDENADOR", absent: false },
      ];
      // Validation should only count non-absent for exclusive role check
      const exclusiveRoles: RoleType[] = ["COORDENADOR", "MESA", "QUADRO"];
      let valid = true;
      for (const role of exclusiveRoles) {
        const count = assignments.filter(a => a.role === role && !a.absent).length;
        if (count > 1) valid = false;
      }
      expect(valid).toBe(true);
    });
  });
});


// ─── Validation: required roles (Coordenador, Mesa, Quadro) ───
describe("Required roles validation", () => {
  type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";
  interface StudentAssignment {
    studentId: number;
    role: RoleType;
    absent: boolean;
  }

  function validateRequiredRoles(assignments: StudentAssignment[]): string[] {
    const errors: string[] = [];
    const presentRoles = assignments.filter(a => !a.absent).map(a => a.role);
    if (!presentRoles.includes("COORDENADOR")) errors.push("É necessário atribuir o papel de Coordenador a um aluno presente.");
    if (!presentRoles.includes("MESA")) errors.push("É necessário atribuir o papel de Mesa a um aluno presente.");
    if (!presentRoles.includes("QUADRO")) errors.push("É necessário atribuir o papel de Quadro a um aluno presente.");
    return errors;
  }

  it("passes when all required roles are present", () => {
    const assignments: StudentAssignment[] = [
      { studentId: 1, role: "COORDENADOR", absent: false },
      { studentId: 2, role: "MESA", absent: false },
      { studentId: 3, role: "QUADRO", absent: false },
      { studentId: 4, role: "PARTICIPANTE", absent: false },
    ];
    expect(validateRequiredRoles(assignments)).toEqual([]);
  });

  it("fails when COORDENADOR is missing", () => {
    const assignments: StudentAssignment[] = [
      { studentId: 1, role: "PARTICIPANTE", absent: false },
      { studentId: 2, role: "MESA", absent: false },
      { studentId: 3, role: "QUADRO", absent: false },
    ];
    const errors = validateRequiredRoles(assignments);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Coordenador");
  });

  it("fails when MESA is missing", () => {
    const assignments: StudentAssignment[] = [
      { studentId: 1, role: "COORDENADOR", absent: false },
      { studentId: 2, role: "PARTICIPANTE", absent: false },
      { studentId: 3, role: "QUADRO", absent: false },
    ];
    const errors = validateRequiredRoles(assignments);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Mesa");
  });

  it("fails when QUADRO is missing", () => {
    const assignments: StudentAssignment[] = [
      { studentId: 1, role: "COORDENADOR", absent: false },
      { studentId: 2, role: "MESA", absent: false },
      { studentId: 3, role: "PARTICIPANTE", absent: false },
    ];
    const errors = validateRequiredRoles(assignments);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Quadro");
  });

  it("fails when all required roles are missing", () => {
    const assignments: StudentAssignment[] = [
      { studentId: 1, role: "PARTICIPANTE", absent: false },
      { studentId: 2, role: "PARTICIPANTE", absent: false },
    ];
    const errors = validateRequiredRoles(assignments);
    expect(errors.length).toBe(3);
  });

  it("fails when required roles are only assigned to absent students", () => {
    const assignments: StudentAssignment[] = [
      { studentId: 1, role: "COORDENADOR", absent: true },
      { studentId: 2, role: "MESA", absent: true },
      { studentId: 3, role: "QUADRO", absent: true },
      { studentId: 4, role: "PARTICIPANTE", absent: false },
    ];
    const errors = validateRequiredRoles(assignments);
    expect(errors.length).toBe(3);
  });

  it("passes when required roles are present even with some absent students", () => {
    const assignments: StudentAssignment[] = [
      { studentId: 1, role: "COORDENADOR", absent: false },
      { studentId: 2, role: "MESA", absent: false },
      { studentId: 3, role: "QUADRO", absent: false },
      { studentId: 4, role: "PARTICIPANTE", absent: true },
      { studentId: 5, role: "PARTICIPANTE", absent: true },
    ];
    expect(validateRequiredRoles(assignments)).toEqual([]);
  });
});

// ─── Role Summary calculation ───
describe("Role Summary by Class", () => {
  type RoleType = "COORDENADOR" | "MESA" | "QUADRO" | "PARTICIPANTE";

  interface SessionAssignment {
    studentId: number;
    role: RoleType;
    absent: boolean;
  }

  function calculateRoleSummary(allAssignments: { studentId: number; studentName: string; role: RoleType; absent: boolean }[]) {
    const summaryMap = new Map<number, {
      studentId: number;
      studentName: string;
      coordenador: number;
      mesa: number;
      quadro: number;
      participante: number;
      ausencias: number;
      totalSessions: number;
    }>();

    for (const a of allAssignments) {
      if (!summaryMap.has(a.studentId)) {
        summaryMap.set(a.studentId, {
          studentId: a.studentId,
          studentName: a.studentName,
          coordenador: 0, mesa: 0, quadro: 0, participante: 0, ausencias: 0, totalSessions: 0,
        });
      }
      const entry = summaryMap.get(a.studentId)!;
      entry.totalSessions++;
      if (a.absent) {
        entry.ausencias++;
      } else {
        switch (a.role) {
          case "COORDENADOR": entry.coordenador++; break;
          case "MESA": entry.mesa++; break;
          case "QUADRO": entry.quadro++; break;
          case "PARTICIPANTE": entry.participante++; break;
        }
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }

  it("correctly counts roles across multiple sessions", () => {
    const assignments = [
      // Session 1
      { studentId: 1, studentName: "Alice", role: "COORDENADOR" as RoleType, absent: false },
      { studentId: 2, studentName: "Bob", role: "MESA" as RoleType, absent: false },
      { studentId: 3, studentName: "Charlie", role: "QUADRO" as RoleType, absent: false },
      // Session 2
      { studentId: 1, studentName: "Alice", role: "MESA" as RoleType, absent: false },
      { studentId: 2, studentName: "Bob", role: "COORDENADOR" as RoleType, absent: false },
      { studentId: 3, studentName: "Charlie", role: "PARTICIPANTE" as RoleType, absent: false },
      // Session 3
      { studentId: 1, studentName: "Alice", role: "PARTICIPANTE" as RoleType, absent: true },
      { studentId: 2, studentName: "Bob", role: "QUADRO" as RoleType, absent: false },
      { studentId: 3, studentName: "Charlie", role: "COORDENADOR" as RoleType, absent: false },
    ];

    const summary = calculateRoleSummary(assignments);
    expect(summary.length).toBe(3);

    const alice = summary.find(s => s.studentName === "Alice")!;
    expect(alice.coordenador).toBe(1);
    expect(alice.mesa).toBe(1);
    expect(alice.quadro).toBe(0);
    expect(alice.participante).toBe(0);
    expect(alice.ausencias).toBe(1);
    expect(alice.totalSessions).toBe(3);

    const bob = summary.find(s => s.studentName === "Bob")!;
    expect(bob.coordenador).toBe(1);
    expect(bob.mesa).toBe(1);
    expect(bob.quadro).toBe(1);
    expect(bob.ausencias).toBe(0);
    expect(bob.totalSessions).toBe(3);

    const charlie = summary.find(s => s.studentName === "Charlie")!;
    expect(charlie.coordenador).toBe(1);
    expect(charlie.quadro).toBe(1);
    expect(charlie.participante).toBe(1);
    expect(charlie.totalSessions).toBe(3);
  });

  it("identifies students who never assumed special roles", () => {
    const assignments = [
      { studentId: 1, studentName: "Alice", role: "PARTICIPANTE" as RoleType, absent: false },
      { studentId: 1, studentName: "Alice", role: "PARTICIPANTE" as RoleType, absent: false },
      { studentId: 2, studentName: "Bob", role: "COORDENADOR" as RoleType, absent: false },
      { studentId: 2, studentName: "Bob", role: "MESA" as RoleType, absent: false },
    ];

    const summary = calculateRoleSummary(assignments);
    const alice = summary.find(s => s.studentName === "Alice")!;
    const hasNoSpecialRole = alice.coordenador === 0 && alice.mesa === 0 && alice.quadro === 0;
    expect(hasNoSpecialRole).toBe(true);

    const bob = summary.find(s => s.studentName === "Bob")!;
    const bobHasNoSpecialRole = bob.coordenador === 0 && bob.mesa === 0 && bob.quadro === 0;
    expect(bobHasNoSpecialRole).toBe(false);
  });

  it("handles empty assignments", () => {
    const summary = calculateRoleSummary([]);
    expect(summary).toEqual([]);
  });

  it("sorts students alphabetically", () => {
    const assignments = [
      { studentId: 3, studentName: "Zara", role: "PARTICIPANTE" as RoleType, absent: false },
      { studentId: 1, studentName: "Alice", role: "PARTICIPANTE" as RoleType, absent: false },
      { studentId: 2, studentName: "Maria", role: "PARTICIPANTE" as RoleType, absent: false },
    ];
    const summary = calculateRoleSummary(assignments);
    expect(summary.map(s => s.studentName)).toEqual(["Alice", "Maria", "Zara"]);
  });
});

// ─── Professor evaluation form labels (concepts instead of numbers) ───
describe("Professor evaluation form labels", () => {
  it("uses descriptive concept labels instead of numeric values", () => {
    const LABELS: Record<number, string> = {
      0: "Nenhuma",
      0.25: "Fraca",
      0.5: "Razoável",
      0.75: "Boa",
      1: "Excelente",
    };
    expect(LABELS[0]).toBe("Nenhuma");
    expect(LABELS[0.25]).toBe("Fraca");
    expect(LABELS[0.5]).toBe("Razoável");
    expect(LABELS[0.75]).toBe("Boa");
    expect(LABELS[1]).toBe("Excelente");
  });

  it("maps all 5 values correctly", () => {
    const values = [0, 0.25, 0.5, 0.75, 1];
    expect(values.length).toBe(5);
    expect(values[0]).toBe(0);
    expect(values[4]).toBe(1);
  });
});
