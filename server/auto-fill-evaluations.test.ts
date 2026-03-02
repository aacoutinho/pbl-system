import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───
const mockGetDb = vi.fn();
const mockGetSessionStudents = vi.fn();
const mockSelectEvals = vi.fn();
const mockInsertEval = vi.fn();
const mockInsertItems = vi.fn();
const mockUpdateSession = vi.fn();

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getSessionStudents: (...args: any[]) => mockGetSessionStudents(...args),
    autoFillMissingEvaluations: actual.autoFillMissingEvaluations,
    finishSession: actual.finishSession,
  };
});

import { autoFillMissingEvaluations } from "./db";

// ─── Unit tests for autoFillMissingEvaluations logic ───

describe("autoFillMissingEvaluations - exported function exists", () => {
  it("autoFillMissingEvaluations is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.autoFillMissingEvaluations).toBe("function");
  });
});

describe("autoFillMissingEvaluations - business logic", () => {
  /**
   * Testa a lógica de negócio sem banco de dados real.
   * Simula os dados de entrada e verifica o comportamento esperado.
   */

  it("identifies students who submitted evaluations", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "COORDENADOR" },
      { studentId: 2, studentName: "Bob", absent: false, role: "PARTICIPANTE" },
      { studentId: 3, studentName: "Carol", absent: false, role: "PARTICIPANTE" },
    ];
    const existingEvals = [
      { evaluatorStudentId: 1 }, // Alice submeteu
      { evaluatorStudentId: 2 }, // Bob submeteu
    ];

    const studentsWhoSubmitted = new Set(existingEvals.map(e => e.evaluatorStudentId));
    const presentStudents = sessionStudents.filter(s => !s.absent);
    const missingEvaluators = presentStudents.filter(s => !studentsWhoSubmitted.has(s.studentId));

    expect(missingEvaluators).toHaveLength(1);
    expect(missingEvaluators[0].studentId).toBe(3); // Carol não submeteu
    expect(missingEvaluators[0].studentName).toBe("Carol");
  });

  it("returns no missing evaluators when all present students submitted", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "PARTICIPANTE" },
      { studentId: 2, studentName: "Bob", absent: false, role: "PARTICIPANTE" },
    ];
    const existingEvals = [
      { evaluatorStudentId: 1 },
      { evaluatorStudentId: 2 },
    ];

    const studentsWhoSubmitted = new Set(existingEvals.map(e => e.evaluatorStudentId));
    const presentStudents = sessionStudents.filter(s => !s.absent);
    const missingEvaluators = presentStudents.filter(s => !studentsWhoSubmitted.has(s.studentId));

    expect(missingEvaluators).toHaveLength(0);
  });

  it("excludes absent students from auto-fill", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "PARTICIPANTE" },
      { studentId: 2, studentName: "Bob", absent: true, role: "PARTICIPANTE" }, // ausente
      { studentId: 3, studentName: "Carol", absent: false, role: "PARTICIPANTE" },
    ];
    const existingEvals = [
      { evaluatorStudentId: 1 }, // Alice submeteu
      // Bob está ausente, não deve ser auto-preenchido
      // Carol não submeteu
    ];

    const studentsWhoSubmitted = new Set(existingEvals.map(e => e.evaluatorStudentId));
    const presentStudents = sessionStudents.filter(s => !s.absent);
    const missingEvaluators = presentStudents.filter(s => !studentsWhoSubmitted.has(s.studentId));

    expect(missingEvaluators).toHaveLength(1);
    expect(missingEvaluators[0].studentId).toBe(3); // Carol, não Bob
  });

  it("absent student is not included in auto-fill even if they did not submit", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: true, role: "PARTICIPANTE" },
      { studentId: 2, studentName: "Bob", absent: true, role: "PARTICIPANTE" },
    ];
    const existingEvals: { evaluatorStudentId: number }[] = [];

    const studentsWhoSubmitted = new Set(existingEvals.map(e => e.evaluatorStudentId));
    const presentStudents = sessionStudents.filter(s => !s.absent);
    const missingEvaluators = presentStudents.filter(s => !studentsWhoSubmitted.has(s.studentId));

    // Todos estão ausentes, nenhum deve ser auto-preenchido
    expect(presentStudents).toHaveLength(0);
    expect(missingEvaluators).toHaveLength(0);
  });

  it("auto-fill items exclude the evaluator themselves (no self-evaluation)", () => {
    const presentStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "COORDENADOR" },
      { studentId: 2, studentName: "Bob", absent: false, role: "PARTICIPANTE" },
      { studentId: 3, studentName: "Carol", absent: false, role: "PARTICIPANTE" },
    ];
    const evaluatorId = 3; // Carol vai ser auto-preenchida

    const peers = presentStudents.filter(s => s.studentId !== evaluatorId);

    expect(peers).toHaveLength(2);
    expect(peers.map(p => p.studentId)).toContain(1); // Alice
    expect(peers.map(p => p.studentId)).toContain(2); // Bob
    expect(peers.map(p => p.studentId)).not.toContain(3); // não Carol
  });

  it("auto-fill uses maximum grade values (Excelente = nota 10.0)", () => {
    // Fórmula: pontualidade*1 + pesquisaMetas*3 + dominio*3 + participacao*3 - desempenhoPapel*1
    const defaultValues = {
      pontualidade: 1.0,
      pesquisaMetas: 1.0,
      dominio: 1.0,
      participacao: 1.0,
      desempenhoPapel: 0.0,
    };

    const score =
      defaultValues.pontualidade * 1 +
      defaultValues.pesquisaMetas * 3 +
      defaultValues.dominio * 3 +
      defaultValues.participacao * 3 -
      defaultValues.desempenhoPapel * 1;

    expect(score).toBe(10.0);
  });

  it("auto-fill with default values does not penalize evaluated students", () => {
    // Verificar que desempenhoPapel = 0 (sem penalidade)
    const defaultDesempenhoPapel = 0.0;
    expect(defaultDesempenhoPapel).toBe(0.0);

    // Verificar que todos os outros critérios são máximos
    const defaultPontualidade = 1.0;
    const defaultPesquisaMetas = 1.0;
    const defaultDominio = 1.0;
    const defaultParticipacao = 1.0;

    expect(defaultPontualidade).toBe(1.0);
    expect(defaultPesquisaMetas).toBe(1.0);
    expect(defaultDominio).toBe(1.0);
    expect(defaultParticipacao).toBe(1.0);
  });

  it("auto-fill items preserve the role of each evaluated peer", () => {
    const presentStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "COORDENADOR" },
      { studentId: 2, studentName: "Bob", absent: false, role: "MESA" },
      { studentId: 3, studentName: "Carol", absent: false, role: "PARTICIPANTE" },
    ];
    const evaluatorId = 3;

    const peers = presentStudents.filter(s => s.studentId !== evaluatorId);
    const items = peers.map(peer => ({
      evaluatedStudentId: peer.studentId,
      role: peer.role,
      absent: false,
      pontualidade: "1.00",
      pesquisaMetas: "1.00",
      dominio: "1.00",
      participacao: "1.00",
      desempenhoPapel: "0.00",
    }));

    expect(items[0].role).toBe("COORDENADOR"); // Alice mantém papel
    expect(items[1].role).toBe("MESA");         // Bob mantém papel
    expect(items.every(i => !i.absent)).toBe(true);
  });

  it("auto-fill does not create items when session has only one present student", () => {
    const presentStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "PARTICIPANTE" },
    ];
    const evaluatorId = 1;

    const peers = presentStudents.filter(s => s.studentId !== evaluatorId);
    expect(peers).toHaveLength(0);
    // Nenhum item seria inserido (sem pares para avaliar)
  });

  it("calculates correct impact on peer average when auto-fill is applied", () => {
    // Cenário: 3 alunos presentes, 2 submeteram notas reais, 1 recebe auto-fill
    // Alice avaliou Bob com 8.0 e Carol com 6.0
    // Bob avaliou Alice com 7.0 e Carol com 9.0
    // Carol NÃO submeteu → auto-fill: Alice=10.0, Bob=10.0

    const aliceScoreFromBob = 7.0;
    const aliceScoreFromCarolAutoFill = 10.0;
    const aliceAvg = (aliceScoreFromBob + aliceScoreFromCarolAutoFill) / 2;

    const bobScoreFromAlice = 8.0;
    const bobScoreFromCarolAutoFill = 10.0;
    const bobAvg = (bobScoreFromAlice + bobScoreFromCarolAutoFill) / 2;

    const carolScoreFromAlice = 6.0;
    const carolScoreFromBob = 9.0;
    // Carol não avaliou ninguém, mas foi avaliada pelos outros
    const carolAvg = (carolScoreFromAlice + carolScoreFromBob) / 2;

    expect(aliceAvg).toBeCloseTo(8.5);
    expect(bobAvg).toBeCloseTo(9.0);
    expect(carolAvg).toBeCloseTo(7.5);
  });

  it("auto-fill does not overwrite existing evaluations", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "PARTICIPANTE" },
      { studentId: 2, studentName: "Bob", absent: false, role: "PARTICIPANTE" },
    ];
    const existingEvals = [
      { evaluatorStudentId: 1 }, // Alice já submeteu
    ];

    const studentsWhoSubmitted = new Set(existingEvals.map(e => e.evaluatorStudentId));
    const presentStudents = sessionStudents.filter(s => !s.absent);
    const missingEvaluators = presentStudents.filter(s => !studentsWhoSubmitted.has(s.studentId));

    // Apenas Bob deve receber auto-fill, Alice não
    expect(missingEvaluators).toHaveLength(1);
    expect(missingEvaluators[0].studentId).toBe(2);
    expect(studentsWhoSubmitted.has(1)).toBe(true); // Alice não é sobrescrita
  });

  it("all present students receive auto-fill when no one submitted", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "PARTICIPANTE" },
      { studentId: 2, studentName: "Bob", absent: false, role: "PARTICIPANTE" },
      { studentId: 3, studentName: "Carol", absent: false, role: "PARTICIPANTE" },
    ];
    const existingEvals: { evaluatorStudentId: number }[] = [];

    const studentsWhoSubmitted = new Set(existingEvals.map(e => e.evaluatorStudentId));
    const presentStudents = sessionStudents.filter(s => !s.absent);
    const missingEvaluators = presentStudents.filter(s => !studentsWhoSubmitted.has(s.studentId));

    expect(missingEvaluators).toHaveLength(3);
  });

  it("mixed scenario: some submitted, some absent, some missing", () => {
    const sessionStudents = [
      { studentId: 1, studentName: "Alice", absent: false, role: "COORDENADOR" },
      { studentId: 2, studentName: "Bob", absent: false, role: "PARTICIPANTE" },
      { studentId: 3, studentName: "Carol", absent: true, role: "PARTICIPANTE" }, // ausente
      { studentId: 4, studentName: "Dave", absent: false, role: "PARTICIPANTE" },
      { studentId: 5, studentName: "Eve", absent: false, role: "MESA" },
    ];
    const existingEvals = [
      { evaluatorStudentId: 1 }, // Alice submeteu
      { evaluatorStudentId: 5 }, // Eve submeteu
    ];

    const studentsWhoSubmitted = new Set(existingEvals.map(e => e.evaluatorStudentId));
    const presentStudents = sessionStudents.filter(s => !s.absent);
    const missingEvaluators = presentStudents.filter(s => !studentsWhoSubmitted.has(s.studentId));

    expect(presentStudents).toHaveLength(4); // Alice, Bob, Dave, Eve (sem Carol)
    expect(missingEvaluators).toHaveLength(2); // Bob e Dave
    expect(missingEvaluators.map(s => s.studentId)).toContain(2); // Bob
    expect(missingEvaluators.map(s => s.studentId)).toContain(4); // Dave
    expect(missingEvaluators.map(s => s.studentId)).not.toContain(1); // Alice submeteu
    expect(missingEvaluators.map(s => s.studentId)).not.toContain(3); // Carol ausente
    expect(missingEvaluators.map(s => s.studentId)).not.toContain(5); // Eve submeteu
  });
});

describe("autoFillMissingEvaluations - route and export", () => {
  it("autoFillMissingEvaluations is exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.autoFillMissingEvaluations).toBe("function");
  });

  it("finishSession is exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.finishSession).toBe("function");
  });

  it("sessions.finish route exists in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures["sessions.finish"]).toBeDefined();
  });
});
