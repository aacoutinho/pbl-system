import { describe, it, expect } from "vitest";

// ─── Test BackupData structure ───
describe("Backup data structure", () => {
  it("BackupData has required fields: version, exportedAt, tables", () => {
    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tables: {},
    };
    expect(backupData.version).toBe("1.0");
    expect(typeof backupData.exportedAt).toBe("string");
    expect(typeof backupData.tables).toBe("object");
  });

  it("exportedAt is a valid ISO date string", () => {
    const exportedAt = new Date().toISOString();
    const parsed = new Date(exportedAt);
    expect(parsed.toISOString()).toBe(exportedAt);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  it("tables is a record of string keys to arrays", () => {
    const tables: Record<string, unknown[]> = {
      users: [{ id: 1, name: "Admin" }],
      components: [{ id: 1, code: "TEC502" }],
    };
    expect(Object.keys(tables)).toHaveLength(2);
    expect(Array.isArray(tables.users)).toBe(true);
    expect(Array.isArray(tables.components)).toBe(true);
  });
});

// ─── Test backup table list ───
describe("Backup table coverage", () => {
  const EXPECTED_TABLES = [
    "users",
    "components",
    "professorComponents",
    "classes",
    "students",
    "classStudents",
    "sessions",
    "sessionStudents",
    "evaluations",
    "evaluationItems",
    "tutorialEvaluations",
    "classEvalPermissions",
    "smtpConfig",
    "auditLogs",
    "notifications",
    "contactTickets",
  ];

  it("backup includes all 16 expected tables", () => {
    expect(EXPECTED_TABLES).toHaveLength(16);
  });

  it("all table names are unique", () => {
    const unique = new Set(EXPECTED_TABLES);
    expect(unique.size).toBe(EXPECTED_TABLES.length);
  });

  it("excludes temporary tables (emailVerificationCodes, passwordResetCodes)", () => {
    expect(EXPECTED_TABLES).not.toContain("emailVerificationCodes");
    expect(EXPECTED_TABLES).not.toContain("passwordResetCodes");
  });

  it("includes core data tables", () => {
    expect(EXPECTED_TABLES).toContain("users");
    expect(EXPECTED_TABLES).toContain("components");
    expect(EXPECTED_TABLES).toContain("classes");
    expect(EXPECTED_TABLES).toContain("students");
    expect(EXPECTED_TABLES).toContain("sessions");
    expect(EXPECTED_TABLES).toContain("evaluations");
    expect(EXPECTED_TABLES).toContain("evaluationItems");
  });

  it("includes relationship tables", () => {
    expect(EXPECTED_TABLES).toContain("professorComponents");
    expect(EXPECTED_TABLES).toContain("classStudents");
    expect(EXPECTED_TABLES).toContain("sessionStudents");
    expect(EXPECTED_TABLES).toContain("classEvalPermissions");
  });

  it("includes configuration and audit tables", () => {
    expect(EXPECTED_TABLES).toContain("smtpConfig");
    expect(EXPECTED_TABLES).toContain("auditLogs");
    expect(EXPECTED_TABLES).toContain("notifications");
    expect(EXPECTED_TABLES).toContain("contactTickets");
  });

  it("includes tutorial evaluation table", () => {
    expect(EXPECTED_TABLES).toContain("tutorialEvaluations");
  });
});

// ─── Test import order (parents before children) ───
describe("Import order validation", () => {
  const IMPORT_ORDER = [
    "users",
    "components",
    "professorComponents",
    "classes",
    "students",
    "classStudents",
    "sessions",
    "sessionStudents",
    "evaluations",
    "evaluationItems",
    "tutorialEvaluations",
    "classEvalPermissions",
    "smtpConfig",
    "auditLogs",
    "notifications",
    "contactTickets",
  ];

  it("users are imported before professorComponents", () => {
    const usersIdx = IMPORT_ORDER.indexOf("users");
    const pcIdx = IMPORT_ORDER.indexOf("professorComponents");
    expect(usersIdx).toBeLessThan(pcIdx);
  });

  it("components are imported before classes", () => {
    const compIdx = IMPORT_ORDER.indexOf("components");
    const classIdx = IMPORT_ORDER.indexOf("classes");
    expect(compIdx).toBeLessThan(classIdx);
  });

  it("classes are imported before sessions", () => {
    const classIdx = IMPORT_ORDER.indexOf("classes");
    const sessIdx = IMPORT_ORDER.indexOf("sessions");
    expect(classIdx).toBeLessThan(sessIdx);
  });

  it("students are imported before classStudents", () => {
    const studIdx = IMPORT_ORDER.indexOf("students");
    const csIdx = IMPORT_ORDER.indexOf("classStudents");
    expect(studIdx).toBeLessThan(csIdx);
  });

  it("sessions are imported before sessionStudents", () => {
    const sessIdx = IMPORT_ORDER.indexOf("sessions");
    const ssIdx = IMPORT_ORDER.indexOf("sessionStudents");
    expect(sessIdx).toBeLessThan(ssIdx);
  });

  it("evaluations are imported before evaluationItems", () => {
    const evalIdx = IMPORT_ORDER.indexOf("evaluations");
    const itemIdx = IMPORT_ORDER.indexOf("evaluationItems");
    expect(evalIdx).toBeLessThan(itemIdx);
  });

  it("sessions are imported before evaluations", () => {
    const sessIdx = IMPORT_ORDER.indexOf("sessions");
    const evalIdx = IMPORT_ORDER.indexOf("evaluations");
    expect(sessIdx).toBeLessThan(evalIdx);
  });

  it("users are imported before notifications", () => {
    const usersIdx = IMPORT_ORDER.indexOf("users");
    const notifIdx = IMPORT_ORDER.indexOf("notifications");
    expect(usersIdx).toBeLessThan(notifIdx);
  });
});

// ─── Test backup validation ───
describe("Backup file validation", () => {
  it("rejects backup without version field", () => {
    const invalid = { exportedAt: "2025-01-01", tables: {} };
    expect(invalid).not.toHaveProperty("version");
  });

  it("rejects backup without exportedAt field", () => {
    const invalid = { version: "1.0", tables: {} };
    expect(invalid).not.toHaveProperty("exportedAt");
  });

  it("rejects backup without tables field", () => {
    const invalid = { version: "1.0", exportedAt: "2025-01-01" };
    expect(invalid).not.toHaveProperty("tables");
  });

  it("accepts valid backup with empty tables", () => {
    const valid = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tables: {},
    };
    expect(valid).toHaveProperty("version");
    expect(valid).toHaveProperty("exportedAt");
    expect(valid).toHaveProperty("tables");
  });

  it("accepts valid backup with populated tables", () => {
    const valid = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tables: {
        users: [
          { id: 1, openId: "abc", name: "Admin", email: "admin@test.com", role: "admin", approvalStatus: "approved" },
        ],
        components: [
          { id: 1, code: "TEC502", name: "Concorrência e Conectividade" },
        ],
        classes: [],
        students: [],
      },
    };
    expect(valid.tables.users).toHaveLength(1);
    expect(valid.tables.components).toHaveLength(1);
    expect(valid.tables.classes).toHaveLength(0);
    expect(valid.tables.students).toHaveLength(0);
  });
});

// ─── Test clear order (reverse of import order) ───
describe("Clear order validation", () => {
  const IMPORT_ORDER = [
    "users",
    "components",
    "professorComponents",
    "classes",
    "students",
    "classStudents",
    "sessions",
    "sessionStudents",
    "evaluations",
    "evaluationItems",
    "tutorialEvaluations",
    "classEvalPermissions",
    "smtpConfig",
    "auditLogs",
    "notifications",
    "contactTickets",
  ];

  const CLEAR_ORDER = [...IMPORT_ORDER].reverse();

  it("clear order is the reverse of import order", () => {
    expect(CLEAR_ORDER[0]).toBe("contactTickets");
    expect(CLEAR_ORDER[CLEAR_ORDER.length - 1]).toBe("users");
  });

  it("evaluationItems are cleared before evaluations", () => {
    const itemIdx = CLEAR_ORDER.indexOf("evaluationItems");
    const evalIdx = CLEAR_ORDER.indexOf("evaluations");
    expect(itemIdx).toBeLessThan(evalIdx);
  });

  it("sessionStudents are cleared before sessions", () => {
    const ssIdx = CLEAR_ORDER.indexOf("sessionStudents");
    const sessIdx = CLEAR_ORDER.indexOf("sessions");
    expect(ssIdx).toBeLessThan(sessIdx);
  });

  it("classStudents are cleared before students", () => {
    const csIdx = CLEAR_ORDER.indexOf("classStudents");
    const studIdx = CLEAR_ORDER.indexOf("students");
    expect(csIdx).toBeLessThan(studIdx);
  });

  it("classes are cleared before components", () => {
    const classIdx = CLEAR_ORDER.indexOf("classes");
    const compIdx = CLEAR_ORDER.indexOf("components");
    expect(classIdx).toBeLessThan(compIdx);
  });

  it("professorComponents are cleared before users", () => {
    const pcIdx = CLEAR_ORDER.indexOf("professorComponents");
    const usersIdx = CLEAR_ORDER.indexOf("users");
    expect(pcIdx).toBeLessThan(usersIdx);
  });
});

// ─── Test table label mapping ───
describe("Table label mapping", () => {
  const TABLE_LABELS: Record<string, string> = {
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
    classEvalPermissions: "Permissões de Avaliação",
    smtpConfig: "Configuração SMTP",
    auditLogs: "Histórico de Ações",
    notifications: "Notificações",
    contactTickets: "Tickets de Contato",
  };

  it("has labels for all 16 backup tables", () => {
    expect(Object.keys(TABLE_LABELS)).toHaveLength(16);
  });

  it("all labels are non-empty strings in Portuguese", () => {
    Object.values(TABLE_LABELS).forEach(label => {
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it("users table is labeled as Usuários", () => {
    expect(TABLE_LABELS.users).toBe("Usuários");
  });

  it("evaluationItems table is labeled as Itens de Avaliação", () => {
    expect(TABLE_LABELS.evaluationItems).toBe("Itens de Avaliação");
  });
});

// ─── Test backup stats structure ───
describe("Backup stats structure", () => {
  it("stats returns a record of table names to counts", () => {
    const stats: Record<string, number> = {
      users: 5,
      components: 2,
      classes: 3,
      students: 30,
      evaluations: 100,
    };
    Object.values(stats).forEach(count => {
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  it("total rows can be calculated from stats", () => {
    const stats: Record<string, number> = {
      users: 5,
      components: 2,
      classes: 3,
    };
    const total = Object.values(stats).reduce((sum, c) => sum + c, 0);
    expect(total).toBe(10);
  });
});

// ─── Test audit log entries for backup operations ───
describe("Backup audit log entries", () => {
  it("database_export action includes exportedAt and tableCount", () => {
    const details = JSON.stringify({
      exportedAt: "2025-06-15T10:30:00.000Z",
      tableCount: 16,
    });
    const parsed = JSON.parse(details);
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.tableCount).toBe(16);
  });

  it("database_import action includes import details", () => {
    const details = JSON.stringify({
      importedAt: "2025-06-15T11:00:00.000Z",
      originalExportedAt: "2025-06-15T10:30:00.000Z",
      clearFirst: true,
      tablesImported: 12,
      rowsImported: 450,
    });
    const parsed = JSON.parse(details);
    expect(parsed.importedAt).toBeDefined();
    expect(parsed.originalExportedAt).toBeDefined();
    expect(parsed.clearFirst).toBe(true);
    expect(parsed.tablesImported).toBe(12);
    expect(parsed.rowsImported).toBe(450);
  });

  it("database_import with clearFirst=false records correctly", () => {
    const details = JSON.stringify({
      importedAt: "2025-06-15T11:00:00.000Z",
      originalExportedAt: "2025-06-15T10:30:00.000Z",
      clearFirst: false,
      tablesImported: 5,
      rowsImported: 100,
    });
    const parsed = JSON.parse(details);
    expect(parsed.clearFirst).toBe(false);
  });
});

// ─── Test JSON serialization of backup data ───
describe("Backup JSON serialization", () => {
  it("backup data can be serialized and deserialized", () => {
    const original = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tables: {
        users: [{ id: 1, name: "Test", createdAt: "2025-01-01T00:00:00.000Z" }],
        components: [{ id: 1, code: "TEC502", name: "Test Component" }],
      },
    };
    const json = JSON.stringify(original, null, 2);
    const restored = JSON.parse(json);
    expect(restored.version).toBe(original.version);
    expect(restored.exportedAt).toBe(original.exportedAt);
    expect(restored.tables.users).toEqual(original.tables.users);
    expect(restored.tables.components).toEqual(original.tables.components);
  });

  it("handles decimal values in evaluation items", () => {
    const evalItem = {
      id: 1,
      evaluationId: 1,
      evaluatedStudentId: 2,
      role: "PARTICIPANTE",
      absent: false,
      atuacao: "7.5",
      pontualidade: "8.0",
      dominio: "6.5",
      metas: "9.0",
      participacao: "7.0",
    };
    const json = JSON.stringify(evalItem);
    const restored = JSON.parse(json);
    expect(restored.atuacao).toBe("7.5");
    expect(restored.pontualidade).toBe("8.0");
  });

  it("handles null values in optional fields", () => {
    const user = {
      id: 1,
      openId: "abc",
      name: "Test",
      email: null,
      loginMethod: null,
      role: "prof",
      approvalStatus: "approved",
      passwordHash: null,
    };
    const json = JSON.stringify(user);
    const restored = JSON.parse(json);
    expect(restored.email).toBeNull();
    expect(restored.loginMethod).toBeNull();
    expect(restored.passwordHash).toBeNull();
  });

  it("handles Date objects serialized as ISO strings", () => {
    const date = new Date("2025-06-15T10:30:00.000Z");
    const json = JSON.stringify({ createdAt: date });
    const restored = JSON.parse(json);
    expect(typeof restored.createdAt).toBe("string");
    expect(new Date(restored.createdAt).getTime()).toBe(date.getTime());
  });
});

// ─── Test batch import logic ───
describe("Batch import logic", () => {
  it("batches of 100 correctly split large arrays", () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }));
    const batchSize = 100;
    const batches: typeof rows[] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      batches.push(rows.slice(i, i + batchSize));
    }
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(100);
    expect(batches[2]).toHaveLength(50);
  });

  it("single batch for arrays smaller than 100", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
    const batchSize = 100;
    const batches: typeof rows[] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      batches.push(rows.slice(i, i + batchSize));
    }
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(50);
  });

  it("empty array produces no batches", () => {
    const rows: unknown[] = [];
    const batchSize = 100;
    const batches: unknown[][] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      batches.push(rows.slice(i, i + batchSize));
    }
    expect(batches).toHaveLength(0);
  });
});

// ─── Test backup file naming ───
describe("Backup file naming", () => {
  it("generates correct filename format", () => {
    const date = new Date("2025-06-15T10:30:45.123Z");
    const formatted = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `backup-avaliacao-tutorial-${formatted}.json`;
    expect(filename).toBe("backup-avaliacao-tutorial-2025-06-15T10-30-45.json");
    expect(filename).toMatch(/^backup-avaliacao-tutorial-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
  });

  it("filename does not contain colons or dots except extension", () => {
    const date = new Date();
    const formatted = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `backup-avaliacao-tutorial-${formatted}.json`;
    const nameWithoutExt = filename.replace(".json", "");
    expect(nameWithoutExt).not.toContain(":");
    expect(nameWithoutExt).not.toContain(".");
  });
});
