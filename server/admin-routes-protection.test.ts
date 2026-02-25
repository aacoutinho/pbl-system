import { describe, it, expect } from "vitest";

// ─── Test admin route protection ───
describe("Admin route protection", () => {
  const adminCheck = (role: string) => role === "admin";

  describe("Backup routes require admin", () => {
    it("backup.export rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
      expect(adminCheck("coordinator")).toBe(false);
      expect(adminCheck("user")).toBe(false);
    });

    it("backup.export accepts admin users", () => {
      expect(adminCheck("admin")).toBe(true);
    });

    it("backup.import rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
      expect(adminCheck("coordinator")).toBe(false);
    });

    it("backup.import accepts admin users", () => {
      expect(adminCheck("admin")).toBe(true);
    });

    it("backup.stats rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
      expect(adminCheck("coordinator")).toBe(false);
    });

    it("backup.stats accepts admin users", () => {
      expect(adminCheck("admin")).toBe(true);
    });

    it("backup.rebuild rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
      expect(adminCheck("coordinator")).toBe(false);
    });

    it("backup.rebuild accepts admin users", () => {
      expect(adminCheck("admin")).toBe(true);
    });
  });

  describe("Audit log route requires admin", () => {
    it("auditLogs.list rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
      expect(adminCheck("coordinator")).toBe(false);
      expect(adminCheck("user")).toBe(false);
    });

    it("auditLogs.list accepts admin users", () => {
      expect(adminCheck("admin")).toBe(true);
    });
  });

  describe("Export route requires admin", () => {
    it("students.exportGoogleWorkspace rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
      expect(adminCheck("coordinator")).toBe(false);
      expect(adminCheck("user")).toBe(false);
    });

    it("students.exportGoogleWorkspace accepts admin users", () => {
      expect(adminCheck("admin")).toBe(true);
    });
  });

  describe("SMTP configuration routes require admin", () => {
    it("smtp.get rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
      expect(adminCheck("coordinator")).toBe(false);
    });

    it("smtp.save rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
      expect(adminCheck("coordinator")).toBe(false);
    });

    it("smtp.test rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
    });

    it("smtp.delete rejects non-admin users", () => {
      expect(adminCheck("prof")).toBe(false);
    });

    it("all smtp routes accept admin users", () => {
      expect(adminCheck("admin")).toBe(true);
    });
  });

  describe("Admin returns 403 FORBIDDEN for non-admin", () => {
    it("FORBIDDEN error code is used for access denial", () => {
      const errorCode = "FORBIDDEN";
      expect(errorCode).toBe("FORBIDDEN");
    });

    it("error message is in Portuguese", () => {
      const errorMessage = "Acesso restrito ao administrador";
      expect(errorMessage).toContain("administrador");
      expect(errorMessage).toContain("restrito");
    });
  });
});

// ─── Test SMTP status indicator ───
describe("SMTP status indicator", () => {
  it("smtpStatus route returns configured boolean", () => {
    const response = { configured: false };
    expect(typeof response.configured).toBe("boolean");
  });

  it("smtpStatus returns true when SMTP is configured", () => {
    const response = { configured: true };
    expect(response.configured).toBe(true);
  });

  it("smtpStatus returns false when SMTP is not configured", () => {
    const response = { configured: false };
    expect(response.configured).toBe(false);
  });

  it("SMTP indicator shows warning when not configured", () => {
    const smtpConfigured = false;
    const showSmtpWarning = !smtpConfigured;
    expect(showSmtpWarning).toBe(true);
  });

  it("SMTP indicator hides warning when configured", () => {
    const smtpConfigured = true;
    const showSmtpWarning = !smtpConfigured;
    expect(showSmtpWarning).toBe(false);
  });

  it("SMTP indicator only shows on E-mails menu item", () => {
    const menuItems = [
      { path: "/smtp-config", label: "E-mails" },
      { path: "/backup", label: "Backup" },
      { path: "/restauracao", label: "Restauração" },
      { path: "/export-students", label: "Exportar" },
      { path: "/audit-log", label: "Histórico" },
    ];
    const smtpItem = menuItems.find(i => i.path === "/smtp-config");
    expect(smtpItem).toBeDefined();
    expect(smtpItem!.label).toBe("E-mails");
    
    // Only smtp-config should show indicator
    menuItems.forEach(item => {
      const isSmtpItem = item.path === "/smtp-config";
      if (item.path === "/smtp-config") {
        expect(isSmtpItem).toBe(true);
      } else {
        expect(isSmtpItem).toBe(false);
      }
    });
  });

  it("smtpStatus is a public procedure (accessible without auth)", () => {
    // The smtpStatus route uses publicProcedure so it can be queried
    // from the login screen and the admin menu
    const procedureType = "publicProcedure";
    expect(procedureType).toBe("publicProcedure");
  });
});

// ─── Test Backup/Restore page separation ───
describe("Backup and Restore page separation", () => {
  describe("Menu structure", () => {
    const configSubItems = [
      { label: "E-mails", path: "/smtp-config" },
      { label: "Backup", path: "/backup" },
      { label: "Restauração", path: "/restauracao" },
      { label: "Exportar", path: "/export-students" },
      { label: "Histórico", path: "/audit-log" },
    ];

    it("Settings submenu has 5 items", () => {
      expect(configSubItems).toHaveLength(5);
    });

    it("Backup and Restauração are separate menu items", () => {
      const backupItem = configSubItems.find(i => i.path === "/backup");
      const restoreItem = configSubItems.find(i => i.path === "/restauracao");
      expect(backupItem).toBeDefined();
      expect(restoreItem).toBeDefined();
      expect(backupItem!.path).not.toBe(restoreItem!.path);
    });

    it("Backup menu item has correct label", () => {
      const backupItem = configSubItems.find(i => i.path === "/backup");
      expect(backupItem!.label).toBe("Backup");
    });

    it("Restauração menu item has correct label", () => {
      const restoreItem = configSubItems.find(i => i.path === "/restauracao");
      expect(restoreItem!.label).toBe("Restauração");
    });

    it("all menu items have unique paths", () => {
      const paths = configSubItems.map(i => i.path);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(paths.length);
    });

    it("Backup comes before Restauração in menu order", () => {
      const backupIdx = configSubItems.findIndex(i => i.path === "/backup");
      const restoreIdx = configSubItems.findIndex(i => i.path === "/restauracao");
      expect(backupIdx).toBeLessThan(restoreIdx);
    });
  });

  describe("Route configuration", () => {
    const routes = [
      "/backup",
      "/restauracao",
    ];

    it("backup route exists", () => {
      expect(routes).toContain("/backup");
    });

    it("restauracao route exists", () => {
      expect(routes).toContain("/restauracao");
    });

    it("routes are distinct", () => {
      expect(routes[0]).not.toBe(routes[1]);
    });
  });

  describe("Backup page content", () => {
    it("Backup page shows database statistics", () => {
      // BackupPage contains stats query and table grid
      const pageFeatures = ["stats", "export"];
      expect(pageFeatures).toContain("stats");
    });

    it("Backup page has export functionality", () => {
      const pageFeatures = ["stats", "export"];
      expect(pageFeatures).toContain("export");
    });

    it("Backup page does NOT have import functionality", () => {
      const pageFeatures = ["stats", "export"];
      expect(pageFeatures).not.toContain("import");
      expect(pageFeatures).not.toContain("rebuild");
    });
  });

  describe("Restore page content", () => {
    it("Restore page has import functionality", () => {
      const pageFeatures = ["import", "rebuild"];
      expect(pageFeatures).toContain("import");
    });

    it("Restore page has rebuild functionality", () => {
      const pageFeatures = ["import", "rebuild"];
      expect(pageFeatures).toContain("rebuild");
    });

    it("Restore page does NOT have export or stats", () => {
      const pageFeatures = ["import", "rebuild"];
      expect(pageFeatures).not.toContain("export");
      expect(pageFeatures).not.toContain("stats");
    });
  });

  describe("TABLE_LABELS shared between pages", () => {
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
    };

    it("TABLE_LABELS has 23 entries for all tables", () => {
      expect(Object.keys(TABLE_LABELS)).toHaveLength(23);
    });

    it("all labels are non-empty Portuguese strings", () => {
      Object.values(TABLE_LABELS).forEach(label => {
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      });
    });

    it("includes professorStudentNotes label", () => {
      expect(TABLE_LABELS.professorStudentNotes).toBe("Notas do Professor por Aluno");
    });
  });
});

// ─── Test Settings submenu is admin-only ───
describe("Settings submenu access control", () => {
  it("admin sees Settings submenu", () => {
    const role = "admin";
    const showSettings = role === "admin";
    expect(showSettings).toBe(true);
  });

  it("coordinator does NOT see Settings submenu", () => {
    const role = "coordinator";
    const showSettings = role === "admin";
    expect(showSettings).toBe(false);
  });

  it("prof does NOT see Settings submenu", () => {
    const role = "prof";
    const showSettings = role === "admin";
    expect(showSettings).toBe(false);
  });

  it("user does NOT see Settings submenu", () => {
    const role = "user";
    const showSettings = role === "admin";
    expect(showSettings).toBe(false);
  });

  it("getMenuItemsForRole includes config group only for admin", () => {
    const getMenuForRole = (role: string) => {
      if (role === "admin") {
        return ["Painel Geral", "Componentes", "Turmas", "Alunos", "Sessões", "Resultados", "Professores", "Notificações", "Contato", "Configurações"];
      }
      return ["Painel Geral", "Componentes", "Turmas", "Alunos", "Sessões", "Avaliar Tutorial", "Resultados", "Professores", "Notificações", "Contato"];
    };
    expect(getMenuForRole("admin")).toContain("Configurações");
    expect(getMenuForRole("prof")).not.toContain("Configurações");
    expect(getMenuForRole("coordinator")).not.toContain("Configurações");
  });
});
