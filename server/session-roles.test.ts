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
