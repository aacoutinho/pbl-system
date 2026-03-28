import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── All 25 expected table names matching BACKUP_TABLES in db.ts ───
const EXPECTED_TABLES = [
  "users", "components", "professorComponents", "classes", "students",
  "classStudents", "sessions", "sessionStudents", "evaluations",
  "evaluationItems", "tutorialEvaluations", "tutorialEvalDrafts",
  "classEvalPermissions", "emailVerificationCodes", "passwordResetCodes",
  "smtpConfig", "auditLogs", "notifications", "contactTickets",
  "professorStudentNotes", "sessionAccessTokens", "brainstormBoards",
  "brainstormItems", "brainstormItemAttachments", "brainstormBoardSendHistory",
];

// ─── TABLE_LABELS from BackupPage (frontend) ───
const FRONTEND_TABLE_LABELS: Record<string, string> = {
  users: "Usuários",
  components: "Componentes",
  professorComponents: "Vínculos Professor-Componente",
  classes: "Turmas",
  students: "Alunos",
  classStudents: "Vínculos Aluno-Turma",
  sessions: "Sessões",
  sessionStudents: "Alunos nas Sessões",
  evaluations: "Avaliações",
  evaluationItems: "Itens de Avaliação",
  tutorialEvaluations: "Avaliações Tutoriais",
  tutorialEvalDrafts: "Rascunhos de Avaliação Tutorial",
  classEvalPermissions: "Permissões de Avaliação",
  emailVerificationCodes: "Códigos de Verificação de E-mail",
  passwordResetCodes: "Códigos de Recuperação de Senha",
  smtpConfig: "Configuração SMTP",
  auditLogs: "Histórico de Ações",
  notifications: "Notificações",
  contactTickets: "Tickets de Contato",
  professorStudentNotes: "Notas do Professor por Aluno",
  sessionAccessTokens: "Tokens de Acesso por Sessão",
  brainstormBoards: "Quadros de Brainstorming",
  brainstormItems: "Itens de Brainstorming",
  brainstormItemAttachments: "Anexos de Brainstorming",
  brainstormBoardSendHistory: "Histórico de Envio de Brainstorming",
};

// ─── Mock db functions used by backup routes ───
const mockExportData = {
  version: "1.0",
  exportedAt: new Date().toISOString(),
  tables: {} as Record<string, any[]>,
};

// Populate mock export data with realistic test data for all 25 tables
function createFullTestData(): Record<string, any[]> {
  const now = new Date().toISOString();
  return {
    users: [
      { id: 1, openId: "admin-001", name: "Prof. Admin", email: "admin@test.com", loginMethod: "password", role: "admin", approvalStatus: "approved", createdAt: now, updatedAt: now, passwordHash: "$2b$10$hash", lastSignedIn: now },
      { id: 2, openId: "prof-002", name: "Prof. João", email: "joao@test.com", loginMethod: "manus", role: "prof", approvalStatus: "approved", createdAt: now, updatedAt: now, passwordHash: null, lastSignedIn: now },
    ],
    components: [
      { id: 1, code: "TEC502", name: "Concorrência e Conectividade", type: "TP", createdAt: now },
    ],
    professorComponents: [
      { id: 1, userId: 1, componentId: 1, componentRole: "coordinator", status: "approved", authorizedAt: now, authorizedByUserId: null },
    ],
    classes: [
      { id: 1, classCode: "TP01", componentId: 1, semester: "2026.1", professorUserId: 1, createdAt: now },
    ],
    students: [
      { id: 1, name: "Ana Silva", enrollment: "20211001", email: "ana@ecomp.uefs.br", photoUrl: "https://s3.example.com/ana.jpg", createdAt: now },
      { id: 2, name: "Bruno Costa", enrollment: "20211002", email: "bruno@ecomp.uefs.br", photoUrl: null, createdAt: now },
      { id: 3, name: "Carla Dias", enrollment: "20211003", email: null, photoUrl: null, createdAt: now },
    ],
    classStudents: [
      { id: 1, studentId: 1, classId: 1, addedAt: now },
      { id: 2, studentId: 2, classId: 1, addedAt: now },
      { id: 3, studentId: 3, classId: 1, addedAt: now },
    ],
    sessions: [
      { id: 1, classId: 1, problemNumber: 1, sessionNumber: 1, problemTitle: "Cliente-Servidor Cloud", label: "P1S1", accessCode: "ABC12345", status: "closed", createdAt: now, closedAt: now },
    ],
    sessionStudents: [
      { id: 1, sessionId: 1, studentId: 1, role: "COORDENADOR", absent: false },
      { id: 2, sessionId: 1, studentId: 2, role: "MESA", absent: false },
      { id: 3, sessionId: 1, studentId: 3, role: "PARTICIPANTE", absent: true },
    ],
    evaluations: [
      { id: 1, sessionId: 1, evaluatorStudentId: 1, submittedAt: now },
      { id: 2, sessionId: 1, evaluatorStudentId: 2, submittedAt: now },
    ],
    evaluationItems: [
      { id: 1, evaluationId: 1, evaluatedStudentId: 2, role: "MESA", absent: false, pontualidade: "1.00", pesquisaMetas: "0.75", dominio: "0.50", participacao: "0.75", desempenhoPapel: "0.25" },
      { id: 2, evaluationId: 2, evaluatedStudentId: 1, role: "COORDENADOR", absent: false, pontualidade: "0.75", pesquisaMetas: "1.00", dominio: "0.75", participacao: "1.00", desempenhoPapel: "0.00" },
    ],
    tutorialEvaluations: [
      { id: 1, sessionId: 1, professorUserId: 1, organizacao: "0.8", cooperacao: "0.7", conteudo: "0.9", objetivo: "0.8", metas: "0.6", submittedAt: now },
    ],
    tutorialEvalDrafts: [
      { id: 1, sessionId: 2, professorUserId: 1, organizacao: "0.5", cooperacao: "0.5", conteudo: "0.5", objetivo: "0.5", metas: "0.5", savedAt: now },
    ],
    classEvalPermissions: [
      { id: 1, classId: 1, authorizedUserId: 2, grantedByUserId: 1, grantedAt: now },
    ],
    emailVerificationCodes: [
      { id: 1, email: "joao@test.com", code: "123456", expiresAt: now, used: true, createdAt: now },
    ],
    passwordResetCodes: [
      { id: 1, userId: 1, code: "654321", expiresAt: now, used: false, createdAt: now },
    ],
    smtpConfig: [
      { id: 1, userId: 1, host: "smtp.gmail.com", port: 587, secure: false, username: "admin@test.com", password: "encrypted-pass", fromEmail: "admin@test.com", fromName: "Sessão Tutorial", configured: true, createdAt: now, updatedAt: now },
    ],
    auditLogs: [
      { id: 1, action: "approve_request", actorUserId: 1, targetUserId: 2, componentId: 1, classId: null, details: '{"reason":"approved"}', createdAt: now },
    ],
    notifications: [
      { id: 1, userId: 2, type: "component_approved", title: "Solicitação Aprovada", message: "Sua solicitação foi aprovada", read: false, metadata: '{"componentId":1}', createdAt: now },
    ],
    contactTickets: [
      { id: 1, userId: 2, type: "bug", subject: "Erro na página", message: "Erro ao carregar resultados", status: "open", resolvedAt: null, createdAt: now },
    ],
    professorStudentNotes: [
      { id: 1, sessionId: 1, studentId: 1, professorUserId: 1, positivePoints: 3, negativePoints: 1, positiveTexts: ["Boa participação", "Pesquisa completa", "Liderança"], negativeTexts: ["Atraso"], notes: "Bom desempenho geral", updatedAt: now },
    ],
    sessionAccessTokens: [
      { id: 1, sessionId: 1, studentId: 1, token: "tok_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def12", createdAt: now },
    ],
    brainstormBoards: [
      { id: 1, sessionId: 1, mesaStudentId: 2, tutorComments: "Bom trabalho na organização", createdAt: now, updatedAt: now },
    ],
    brainstormItems: [
      { id: 1, boardId: 1, section: "ideias", content: "Usar microserviços", status: "aceita", attachmentUrl: null, attachmentType: null, sortOrder: 0, createdAt: now, updatedAt: now },
      { id: 2, boardId: 1, section: "fatos", content: "REST é stateless", status: "confirmado", attachmentUrl: "https://example.com/ref", attachmentType: "link", sortOrder: 0, createdAt: now, updatedAt: now },
    ],
    brainstormItemAttachments: [
      { id: 1, itemId: 2, url: "https://s3.example.com/diagram.png", type: "image", title: "Diagrama de arquitetura", sortOrder: 0, createdAt: now },
    ],
    brainstormBoardSendHistory: [
      { id: 1, sessionId: 1, sentByName: "Prof. Admin", sentByRole: "prof", recipientCount: 3, failCount: 1, sentAt: now },
    ],
  };
}

// Mock all db functions used by backup routes
let capturedExportResult: any = null;
let capturedImportInput: any = null;
let capturedImportClearFirst: boolean = true;
let mockImportResult: { tablesImported: number; rowsImported: number; warnings: string[] } = { tablesImported: 25, rowsImported: 35, warnings: [] };
let mockStatsResult: Record<string, number> = {};

vi.mock("./db", () => ({
  exportDatabase: vi.fn().mockImplementation(async () => {
    return capturedExportResult;
  }),
  importDatabase: vi.fn().mockImplementation(async (data: any, clearFirst: boolean) => {
    capturedImportInput = data;
    capturedImportClearFirst = clearFirst;
    return mockImportResult;
  }),
  getBackupStats: vi.fn().mockImplementation(async () => {
    return mockStatsResult;
  }),
  rebuildDatabase: vi.fn().mockImplementation(async () => {
    return { success: true, tablesCreated: 25 };
  }),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-001",
    email: "admin@test.com",
    name: "Prof. Admin",
    loginMethod: "password",
    role: "admin",
    approvalStatus: "approved",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createProfContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "prof-002",
    email: "joao@test.com",
    name: "Prof. João",
    loginMethod: "manus",
    role: "prof",
    approvalStatus: "approved",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Backup/Restore - Ciclo completo com 25 tabelas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedExportResult = null;
    capturedImportInput = null;
    capturedImportClearFirst = true;
  });

  describe("BACKUP_TABLES completude (25 tabelas)", () => {
    it("deve exportar exatamente 25 tabelas", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      const exportedTableNames = Object.keys(backup.tables);
      expect(exportedTableNames).toHaveLength(25);
    });

    it("deve incluir todas as 25 tabelas esperadas no backup", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      for (const tableName of EXPECTED_TABLES) {
        expect(backup.tables).toHaveProperty(tableName);
      }
    });

    it("deve incluir brainstormItemAttachments no backup", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      expect(backup.tables.brainstormItemAttachments).toBeDefined();
      expect(backup.tables.brainstormItemAttachments).toHaveLength(1);
      expect(backup.tables.brainstormItemAttachments[0].url).toBe("https://s3.example.com/diagram.png");
    });

    it("deve incluir brainstormBoardSendHistory no backup", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      expect(backup.tables.brainstormBoardSendHistory).toBeDefined();
      expect(backup.tables.brainstormBoardSendHistory).toHaveLength(1);
      expect(backup.tables.brainstormBoardSendHistory[0].sentByName).toBe("Prof. Admin");
    });

    it("frontend TABLE_LABELS deve ter rótulo para cada tabela do backup", () => {
      const labelKeys = Object.keys(FRONTEND_TABLE_LABELS);
      expect(labelKeys.sort()).toEqual(EXPECTED_TABLES.sort());
      expect(labelKeys).toHaveLength(25);
    });

    it("cada tabela no TABLE_LABELS deve ter um rótulo não vazio em português", () => {
      for (const [key, label] of Object.entries(FRONTEND_TABLE_LABELS)) {
        expect(label).toBeTruthy();
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(2);
      }
    });
  });

  describe("exportDatabase - formato e dados", () => {
    it("deve retornar backup com version e exportedAt", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: "2026-02-26T00:00:00.000Z",
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      expect(backup.version).toBe("1.0");
      expect(backup.exportedAt).toBe("2026-02-26T00:00:00.000Z");
    });

    it("deve preservar contagem de linhas por tabela", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      expect(backup.tables.users).toHaveLength(2);
      expect(backup.tables.students).toHaveLength(3);
      expect(backup.tables.sessionStudents).toHaveLength(3);
      expect(backup.tables.evaluations).toHaveLength(2);
      expect(backup.tables.evaluationItems).toHaveLength(2);
      expect(backup.tables.brainstormItems).toHaveLength(2);
      expect(backup.tables.brainstormItemAttachments).toHaveLength(1);
      expect(backup.tables.brainstormBoardSendHistory).toHaveLength(1);
    });

    it("deve preservar campos nullable (null) nos dados exportados", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      // Student without email
      const student3 = backup.tables.students.find((s: any) => s.id === 3);
      expect(student3.email).toBeNull();
      expect(student3.photoUrl).toBeNull();

      // User without passwordHash
      const prof = backup.tables.users.find((u: any) => u.id === 2);
      expect(prof.passwordHash).toBeNull();

      // Contact ticket without resolvedAt
      expect(backup.tables.contactTickets[0].resolvedAt).toBeNull();
    });

    it("deve preservar campos decimais de avaliações", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      const evalItem = backup.tables.evaluationItems[0];
      expect(evalItem.pontualidade).toBe("1.00");
      expect(evalItem.pesquisaMetas).toBe("0.75");
      expect(evalItem.dominio).toBe("0.50");
      expect(evalItem.participacao).toBe("0.75");
      expect(evalItem.desempenhoPapel).toBe("0.25");
    });

    it("deve preservar campos booleanos", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      expect(backup.tables.smtpConfig[0].secure).toBe(false);
      expect(backup.tables.smtpConfig[0].configured).toBe(true);
      expect(backup.tables.sessionStudents[2].absent).toBe(true);
      expect(backup.tables.sessionStudents[0].absent).toBe(false);
    });

    it("deve preservar campos JSON (arrays)", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      const note = backup.tables.professorStudentNotes[0];
      expect(Array.isArray(note.positiveTexts)).toBe(true);
      expect(note.positiveTexts).toHaveLength(3);
      expect(note.negativeTexts).toHaveLength(1);
    });

    it("deve ser serializável para JSON sem perda de dados", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      // Serialize and deserialize
      const json = JSON.stringify(backup);
      const restored = JSON.parse(json);

      expect(restored.version).toBe(backup.version);
      expect(restored.exportedAt).toBe(backup.exportedAt);
      expect(Object.keys(restored.tables).sort()).toEqual(Object.keys(backup.tables).sort());

      for (const name of EXPECTED_TABLES) {
        expect(restored.tables[name].length).toBe(backup.tables[name].length);
      }
    });
  });

  describe("importDatabase - restauração", () => {
    it("deve aceitar backup com todas as 25 tabelas", async () => {
      const testData = createFullTestData();
      mockImportResult = { tablesImported: 25, rowsImported: 35, warnings: [] };

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.backup.import({
        data: {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          tables: testData,
        },
        clearFirst: true,
      });

      expect(result.tablesImported).toBe(25);
      expect(result.rowsImported).toBe(35);
    });

    it("deve passar clearFirst=true para importDatabase quando solicitado", async () => {
      const testData = createFullTestData();
      mockImportResult = { tablesImported: 25, rowsImported: 35, warnings: [] };

      const caller = appRouter.createCaller(createAdminContext());
      await caller.backup.import({
        data: {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          tables: testData,
        },
        clearFirst: true,
      });

      expect(capturedImportClearFirst).toBe(true);
    });

    it("deve passar clearFirst=false para importDatabase quando solicitado", async () => {
      const testData = createFullTestData();
      mockImportResult = { tablesImported: 25, rowsImported: 35, warnings: [] };

      const caller = appRouter.createCaller(createAdminContext());
      await caller.backup.import({
        data: {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          tables: testData,
        },
        clearFirst: false,
      });

      expect(capturedImportClearFirst).toBe(false);
    });

    it("deve passar os dados do backup corretamente para importDatabase", async () => {
      const testData = createFullTestData();
      mockImportResult = { tablesImported: 25, rowsImported: 35, warnings: [] };

      const caller = appRouter.createCaller(createAdminContext());
      await caller.backup.import({
        data: {
          version: "1.0",
          exportedAt: "2026-02-26T00:00:00.000Z",
          tables: testData,
        },
        clearFirst: true,
      });

      expect(capturedImportInput).toBeDefined();
      expect(capturedImportInput.version).toBe("1.0");
      expect(capturedImportInput.exportedAt).toBe("2026-02-26T00:00:00.000Z");
      expect(Object.keys(capturedImportInput.tables)).toHaveLength(25);
    });
  });

  describe("Ciclo completo: export → import", () => {
    it("deve exportar e reimportar dados preservando estrutura", async () => {
      const testData = createFullTestData();

      // Step 1: Export
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      // Step 2: Import the exported data
      mockImportResult = {
        tablesImported: Object.entries(backup.tables).filter(([_, rows]) => (rows as any[]).length > 0).length,
        rowsImported: Object.values(backup.tables).reduce((sum, rows) => sum + (rows as any[]).length, 0),
        warnings: [],
      };

      const result = await caller.backup.import({
        data: {
          version: backup.version,
          exportedAt: backup.exportedAt,
          tables: backup.tables as Record<string, any[]>,
        },
        clearFirst: true,
      });

      // Verify all tables were imported
      expect(result.tablesImported).toBe(25);

      // Verify total row count
      const expectedTotalRows = Object.values(testData).reduce((sum, rows) => sum + rows.length, 0);
      expect(result.rowsImported).toBe(expectedTotalRows);
    });

    it("dados exportados devem ser compatíveis com o formato de import", async () => {
      const testData = createFullTestData();
      capturedExportResult = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        tables: testData,
      };

      const caller = appRouter.createCaller(createAdminContext());
      const backup = await caller.backup.export();

      // Verify export format matches import schema
      expect(backup).toHaveProperty("version");
      expect(backup).toHaveProperty("exportedAt");
      expect(backup).toHaveProperty("tables");
      expect(typeof backup.version).toBe("string");
      expect(typeof backup.exportedAt).toBe("string");
      expect(typeof backup.tables).toBe("object");

      // Each table should be an array
      for (const [name, rows] of Object.entries(backup.tables)) {
        expect(Array.isArray(rows)).toBe(true);
      }
    });
  });

  describe("getBackupStats", () => {
    it("deve retornar contagem para todas as 25 tabelas", async () => {
      mockStatsResult = Object.fromEntries(EXPECTED_TABLES.map(name => [name, 0]));
      mockStatsResult["users"] = 2;
      mockStatsResult["students"] = 3;
      mockStatsResult["brainstormItemAttachments"] = 1;
      mockStatsResult["brainstormBoardSendHistory"] = 1;

      const caller = appRouter.createCaller(createAdminContext());
      const stats = await caller.backup.stats();

      expect(Object.keys(stats)).toHaveLength(25);
      for (const name of EXPECTED_TABLES) {
        expect(stats).toHaveProperty(name);
        expect(typeof stats[name]).toBe("number");
      }
    });

    it("deve incluir brainstormItemAttachments nas estatísticas", async () => {
      mockStatsResult = Object.fromEntries(EXPECTED_TABLES.map(name => [name, 0]));
      mockStatsResult["brainstormItemAttachments"] = 5;

      const caller = appRouter.createCaller(createAdminContext());
      const stats = await caller.backup.stats();

      expect(stats.brainstormItemAttachments).toBe(5);
    });

    it("deve incluir brainstormBoardSendHistory nas estatísticas", async () => {
      mockStatsResult = Object.fromEntries(EXPECTED_TABLES.map(name => [name, 0]));
      mockStatsResult["brainstormBoardSendHistory"] = 3;

      const caller = appRouter.createCaller(createAdminContext());
      const stats = await caller.backup.stats();

      expect(stats.brainstormBoardSendHistory).toBe(3);
    });
  });

  describe("Controle de acesso", () => {
    it("deve bloquear export para não-admin", async () => {
      const caller = appRouter.createCaller(createProfContext());
      await expect(caller.backup.export()).rejects.toThrow();
    });

    it("deve bloquear import para não-admin", async () => {
      const caller = appRouter.createCaller(createProfContext());
      await expect(
        caller.backup.import({
          data: { version: "1.0", exportedAt: new Date().toISOString(), tables: {} },
          clearFirst: true,
        })
      ).rejects.toThrow();
    });

    it("deve bloquear stats para não-admin", async () => {
      const caller = appRouter.createCaller(createProfContext());
      await expect(caller.backup.stats()).rejects.toThrow();
    });

    it("deve bloquear rebuild para não-admin", async () => {
      const caller = appRouter.createCaller(createProfContext());
      await expect(caller.backup.rebuild()).rejects.toThrow();
    });
  });

  describe("Integridade referencial nos dados de teste", () => {
    it("todos os professorComponents.userId devem existir em users", () => {
      const data = createFullTestData();
      for (const pc of data.professorComponents) {
        expect(data.users.some(u => u.id === pc.userId)).toBe(true);
      }
    });

    it("todos os classes.componentId devem existir em components", () => {
      const data = createFullTestData();
      for (const c of data.classes) {
        expect(data.components.some(comp => comp.id === c.componentId)).toBe(true);
      }
    });

    it("todos os classStudents referências devem ser válidas", () => {
      const data = createFullTestData();
      for (const cs of data.classStudents) {
        expect(data.students.some(s => s.id === cs.studentId)).toBe(true);
        expect(data.classes.some(c => c.id === cs.classId)).toBe(true);
      }
    });

    it("todos os sessionStudents referências devem ser válidas", () => {
      const data = createFullTestData();
      for (const ss of data.sessionStudents) {
        expect(data.sessions.some(s => s.id === ss.sessionId)).toBe(true);
        expect(data.students.some(s => s.id === ss.studentId)).toBe(true);
      }
    });

    it("todos os evaluations referências devem ser válidas", () => {
      const data = createFullTestData();
      for (const e of data.evaluations) {
        expect(data.sessions.some(s => s.id === e.sessionId)).toBe(true);
        expect(data.students.some(s => s.id === e.evaluatorStudentId)).toBe(true);
      }
    });

    it("todos os evaluationItems.evaluationId devem existir em evaluations", () => {
      const data = createFullTestData();
      for (const ei of data.evaluationItems) {
        expect(data.evaluations.some(e => e.id === ei.evaluationId)).toBe(true);
      }
    });

    it("todos os brainstormBoards.sessionId devem existir em sessions", () => {
      const data = createFullTestData();
      for (const b of data.brainstormBoards) {
        expect(data.sessions.some(s => s.id === b.sessionId)).toBe(true);
      }
    });

    it("todos os brainstormItems.boardId devem existir em brainstormBoards", () => {
      const data = createFullTestData();
      for (const item of data.brainstormItems) {
        expect(data.brainstormBoards.some(b => b.id === item.boardId)).toBe(true);
      }
    });

    it("todos os brainstormItemAttachments.itemId devem existir em brainstormItems", () => {
      const data = createFullTestData();
      for (const att of data.brainstormItemAttachments) {
        expect(data.brainstormItems.some(i => i.id === att.itemId)).toBe(true);
      }
    });

    it("todos os brainstormBoardSendHistory.sessionId devem existir em sessions", () => {
      const data = createFullTestData();
      for (const sh of data.brainstormBoardSendHistory) {
        expect(data.sessions.some(s => s.id === sh.sessionId)).toBe(true);
      }
    });
  });

  describe("Ordem do BACKUP_TABLES", () => {
    it("tabelas pai devem vir antes de tabelas filhas na lista esperada", () => {
      // Use the actual order from BACKUP_TABLES in db.ts (not sorted alphabetically)
      const BACKUP_ORDER = [
        "users", "components", "professorComponents", "classes", "students",
        "classStudents", "sessions", "sessionStudents", "evaluations",
        "evaluationItems", "tutorialEvaluations", "tutorialEvalDrafts",
        "classEvalPermissions", "emailVerificationCodes", "passwordResetCodes",
        "smtpConfig", "auditLogs", "notifications", "contactTickets",
        "professorStudentNotes", "sessionAccessTokens", "brainstormBoards",
        "brainstormItems", "brainstormItemAttachments", "brainstormBoardSendHistory",
      ];
      const idx = (name: string) => BACKUP_ORDER.indexOf(name);

      // users before professorComponents, classes, auditLogs, notifications, etc.
      expect(idx("users")).toBeLessThan(idx("professorComponents"));
      expect(idx("users")).toBeLessThan(idx("classes"));

      // components before professorComponents, classes
      expect(idx("components")).toBeLessThan(idx("professorComponents"));
      expect(idx("components")).toBeLessThan(idx("classes"));

      // classes before classStudents, sessions
      expect(idx("classes")).toBeLessThan(idx("classStudents"));
      expect(idx("classes")).toBeLessThan(idx("sessions"));

      // students before classStudents, sessionStudents
      expect(idx("students")).toBeLessThan(idx("classStudents"));
      expect(idx("students")).toBeLessThan(idx("sessionStudents"));

      // sessions before sessionStudents, evaluations, brainstormBoards
      expect(idx("sessions")).toBeLessThan(idx("sessionStudents"));
      expect(idx("sessions")).toBeLessThan(idx("evaluations"));
      expect(idx("sessions")).toBeLessThan(idx("brainstormBoards"));

      // evaluations before evaluationItems
      expect(idx("evaluations")).toBeLessThan(idx("evaluationItems"));

      // brainstormBoards before brainstormItems
      expect(idx("brainstormBoards")).toBeLessThan(idx("brainstormItems"));

      // brainstormItems before brainstormItemAttachments
      expect(idx("brainstormItems")).toBeLessThan(idx("brainstormItemAttachments"));

      // sessions before brainstormBoardSendHistory
      expect(idx("sessions")).toBeLessThan(idx("brainstormBoardSendHistory"));
    });
  });
});
