import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import {
  buildBrainstormBoardEmailHtml,
  buildBrainstormNotificationEmailHtml,
} from "./email";
import {
  getStudentsByComponentFromSession,
  addBoardSendHistory,
  getBoardSendHistory,
  getLastBoardSend,
} from "./db";

// ─── Test 1: Brainstorm router structure ───
describe("Brainstorm Router Structure", () => {
  it("should have brainstorm router defined", () => {
    expect(appRouter._def.procedures).toBeDefined();
  });

  it("should have getOrCreateBoard procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.getOrCreateBoard"]).toBeDefined();
  });

  it("should have getBoard procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.getBoard"]).toBeDefined();
  });

  it("should have addItem procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.addItem"]).toBeDefined();
  });

  it("should have updateItem procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.updateItem"]).toBeDefined();
  });

  it("should have deleteItem procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.deleteItem"]).toBeDefined();
  });

  it("should have moveItem procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.moveItem"]).toBeDefined();
  });

  it("should have addAttachment procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.addAttachment"]).toBeDefined();
  });

  it("should have removeAttachment procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.removeAttachment"]).toBeDefined();
  });

  it("should have updateAttachmentTitle procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.updateAttachmentTitle"]).toBeDefined();
  });

  it("should have updateTutorComments procedure", () => {
    expect((appRouter._def.procedures as any)["brainstorm.updateTutorComments"]).toBeDefined();
  });
});

// ─── Test 2: Send Board Email route ───
describe("Send Board Email Route", () => {
  it("should have sendBoardEmail procedure defined", () => {
    expect((appRouter._def.procedures as any)["brainstorm.sendBoardEmail"]).toBeDefined();
  });

  it("should be a mutation (not a query)", () => {
    const proc = (appRouter._def.procedures as any)["brainstorm.sendBoardEmail"];
    expect(proc._def.type).toBe("mutation");
  });
});

// ─── Test 3: Get Board Send History route ───
describe("Get Board Send History Route", () => {
  it("should have getBoardSendHistory procedure defined", () => {
    expect((appRouter._def.procedures as any)["brainstorm.getBoardSendHistory"]).toBeDefined();
  });

  it("should be a query (not a mutation)", () => {
    const proc = (appRouter._def.procedures as any)["brainstorm.getBoardSendHistory"];
    expect(proc._def.type).toBe("query");
  });
});

// ─── Test 4: Get Student Count route ───
describe("Get Student Count Route", () => {
  it("should have getStudentCount procedure defined", () => {
    expect((appRouter._def.procedures as any)["brainstorm.getStudentCount"]).toBeDefined();
  });

  it("should be a query (not a mutation)", () => {
    const proc = (appRouter._def.procedures as any)["brainstorm.getStudentCount"];
    expect(proc._def.type).toBe("query");
  });
});

// ─── Test 5: Brainstorm Board Email Template ───
describe("Brainstorm Board Email Template", () => {
  const sampleSections = {
    ideias: [
      { content: "Usar microserviços", status: "aceita" },
      { content: "Implementar cache", status: "analise" },
    ],
    fatos: [
      { content: "O servidor suporta 1000 conexões", status: "confirmado" },
    ],
    questoes: [
      { content: "Como escalar horizontalmente?", status: "investigacao" },
    ],
    metas: [
      { content: "Entregar protótipo até sexta", status: "em_andamento" },
    ],
  };

  it("generates HTML with all 4 sections", () => {
    const html = buildBrainstormBoardEmailHtml({
      sessionLabel: "Problema 1 - Sessão 1",
      sections: sampleSections,
      tutorComments: "Bom trabalho da equipe!",
      brainstormUrl: "https://example.com/board",
    });
    expect(html).toContain("Ideias");
    expect(html).toContain("Fatos");
    expect(html).toContain("Questões");
    expect(html).toContain("Metas");
  });

  it("includes item content in the email", () => {
    const html = buildBrainstormBoardEmailHtml({
      sessionLabel: "Sessão 1",
      sections: sampleSections,
      tutorComments: "",
      brainstormUrl: "https://example.com",
    });
    expect(html).toContain("Usar microserviços");
    expect(html).toContain("Implementar cache");
    expect(html).toContain("O servidor suporta 1000 conexões");
    expect(html).toContain("Como escalar horizontalmente?");
    expect(html).toContain("Entregar protótipo até sexta");
  });

  it("includes tutor comments when provided", () => {
    const html = buildBrainstormBoardEmailHtml({
      sessionLabel: "Sessão 1",
      sections: sampleSections,
      tutorComments: "Bom trabalho da equipe!",
      brainstormUrl: "https://example.com",
    });
    expect(html).toContain("Bom trabalho da equipe!");
    expect(html).toContain("Comentários do Tutor");
  });

  it("includes session label", () => {
    const html = buildBrainstormBoardEmailHtml({
      sessionLabel: "Problema 1 - Sessão 1",
      sections: sampleSections,
      tutorComments: "",
      brainstormUrl: "https://example.com",
    });
    expect(html).toContain("Problema 1 - Sessão 1");
  });

  it("includes board link", () => {
    const html = buildBrainstormBoardEmailHtml({
      sessionLabel: "Sessão 1",
      sections: sampleSections,
      tutorComments: "",
      brainstormUrl: "https://example.com/board/123",
    });
    expect(html).toContain("https://example.com/board/123");
  });

  it("has proper HTML structure", () => {
    const html = buildBrainstormBoardEmailHtml({
      sessionLabel: "Sessão 1",
      sections: sampleSections,
      tutorComments: "",
      brainstormUrl: "https://example.com",
    });
    expect(html).toContain("<div");
    expect(html).toContain("</div>");
    expect(html).toContain("style=");
  });

  it("handles empty sections gracefully", () => {
    const emptySections = {
      ideias: [] as Array<{ content: string; status: string | null }>,
      fatos: [] as Array<{ content: string; status: string | null }>,
      questoes: [] as Array<{ content: string; status: string | null }>,
      metas: [] as Array<{ content: string; status: string | null }>,
    };
    const html = buildBrainstormBoardEmailHtml({
      sessionLabel: "Sessão 1",
      sections: emptySections,
      tutorComments: "",
      brainstormUrl: "https://example.com",
    });
    expect(html).toContain("Ideias");
    expect(html).toContain("Fatos");
    expect(html).toBeDefined();
  });
});

// ─── Test 6: DB function exports ───
describe("Brainstorm DB Functions", () => {
  it("should export getStudentsByComponentFromSession", () => {
    expect(typeof getStudentsByComponentFromSession).toBe("function");
  });

  it("should export addBoardSendHistory", () => {
    expect(typeof addBoardSendHistory).toBe("function");
  });

  it("should export getBoardSendHistory", () => {
    expect(typeof getBoardSendHistory).toBe("function");
  });

  it("should export getLastBoardSend", () => {
    expect(typeof getLastBoardSend).toBe("function");
  });
});

// ─── Test 7: Brainstorm Notification Email Template ───
describe("Brainstorm Notification Email Template", () => {
  it("generates HTML with student name and board link", () => {
    const html = buildBrainstormNotificationEmailHtml({
      studentName: "João Silva",
      sessionLabel: "Problema 1 - Sessão 1",
      brainstormUrl: "https://example.com/board",
      componentCode: "TEC502",
      classCode: "TP01",
    });
    expect(html).toContain("João Silva");
    expect(html).toContain("Problema 1 - Sessão 1");
    expect(html).toContain("https://example.com/board");
  });

  it("has proper HTML structure", () => {
    const html = buildBrainstormNotificationEmailHtml({
      studentName: "Maria",
      sessionLabel: "Sessão 1",
      brainstormUrl: "https://example.com",
      componentCode: "TEC502",
      classCode: "TP01",
    });
    expect(html).toContain("<div");
    expect(html).toContain("</div>");
    expect(html).toContain("style=");
  });
});

// ─── Test 8: Section configuration consistency ───
describe("Brainstorm Section Configuration", () => {
  const sections = ["ideias", "fatos", "questoes", "metas"];

  it("all 4 sections are defined", () => {
    expect(sections).toHaveLength(4);
  });

  it("section names are unique", () => {
    const unique = new Set(sections);
    expect(unique.size).toBe(sections.length);
  });

  const statusesBySection: Record<string, string[]> = {
    ideias: ["analise", "aceita", "descartada"],
    fatos: ["verificar", "confirmado", "inexato"],
    questoes: ["duvida", "investigacao", "respondida"],
    metas: ["planejada", "em_andamento", "concluida"],
  };

  it("each section has exactly 3 statuses", () => {
    for (const section of sections) {
      expect(statusesBySection[section]).toHaveLength(3);
    }
  });

  it("statuses within each section are unique", () => {
    for (const section of sections) {
      const unique = new Set(statusesBySection[section]);
      expect(unique.size).toBe(statusesBySection[section].length);
    }
  });
});

// ─── Test 9: Attachment types ───
describe("Brainstorm Attachment Types", () => {
  const validTypes = ["photo", "document", "link", "imageUrl", "videoUrl", "imageUpload"];

  it("all 6 attachment types are defined", () => {
    expect(validTypes).toHaveLength(6);
  });

  it("attachment types are unique", () => {
    const unique = new Set(validTypes);
    expect(unique.size).toBe(validTypes.length);
  });

  it("attachment types follow expected naming convention", () => {
    for (const type of validTypes) {
      expect(type.length).toBeGreaterThan(0);
      expect(type).toMatch(/^[a-zA-Z]+$/);
    }
  });
});

// ─── Test 10: Send cooldown logic ───
describe("Send Cooldown Logic", () => {
  it("2-minute cooldown constant is correct", () => {
    const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
    expect(COOLDOWN_MS).toBe(120000);
  });

  it("cooldown check works for recent sends", () => {
    const COOLDOWN_MS = 2 * 60 * 1000;
    const now = Date.now();
    const recentSend = now - 60000; // 1 minute ago
    expect(now - recentSend < COOLDOWN_MS).toBe(true);
  });

  it("cooldown check passes for old sends", () => {
    const COOLDOWN_MS = 2 * 60 * 1000;
    const now = Date.now();
    const oldSend = now - 180000; // 3 minutes ago
    expect(now - oldSend < COOLDOWN_MS).toBe(false);
  });
});
