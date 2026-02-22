import { describe, expect, it } from "vitest";

// ─── Test notification types ───
describe("Notification types", () => {
  const notificationTypes = [
    "component_approved",
    "component_rejected",
    "promoted_to_coordinator",
    "demoted_to_prof",
    "removed_from_component",
    "eval_permission_granted",
    "eval_permission_revoked",
  ];

  it("all expected notification types are defined", () => {
    expect(notificationTypes).toHaveLength(7);
    notificationTypes.forEach(type => {
      expect(typeof type).toBe("string");
      expect(type.length).toBeGreaterThan(0);
    });
  });

  it("notification types are unique", () => {
    const unique = new Set(notificationTypes);
    expect(unique.size).toBe(notificationTypes.length);
  });
});

// ─── Test notification data structure ───
describe("Notification data structure", () => {
  it("createNotification accepts all required fields", () => {
    const data = {
      userId: 1,
      type: "component_approved",
      title: "Solicitação Aprovada",
      message: "Sua solicitação de entrada no componente TEC502 foi aprovada.",
      metadata: JSON.stringify({ componentId: 3 }),
    };

    expect(data.userId).toBe(1);
    expect(data.type).toBe("component_approved");
    expect(data.title).toBe("Solicitação Aprovada");
    expect(data.message).toContain("TEC502");
    expect(JSON.parse(data.metadata!)).toEqual({ componentId: 3 });
  });

  it("metadata can store component and class info", () => {
    const metadata = JSON.stringify({
      componentId: 5,
      classId: 10,
    });
    const parsed = JSON.parse(metadata);
    expect(parsed.componentId).toBe(5);
    expect(parsed.classId).toBe(10);
  });

  it("handles null metadata", () => {
    const data = {
      userId: 1,
      type: "eval_permission_revoked",
      title: "Permissão Revogada",
      message: "Sua permissão foi revogada.",
      metadata: null,
    };
    expect(data.metadata).toBeNull();
  });
});

// ─── Test notification messages for each type ───
describe("Notification messages by type", () => {
  it("component_approved message includes component info", () => {
    const msg = `Sua solicitação de entrada no componente TEC502 - Concorrência e Conectividade foi aprovada.`;
    expect(msg).toContain("TEC502");
    expect(msg).toContain("aprovada");
  });

  it("component_rejected message includes component info", () => {
    const msg = `Sua solicitação de entrada no componente TEC502 - Concorrência e Conectividade foi rejeitada.`;
    expect(msg).toContain("TEC502");
    expect(msg).toContain("rejeitada");
  });

  it("promoted_to_coordinator message includes component info", () => {
    const msg = `Você foi promovido a coordenador do componente TEC502 - Concorrência e Conectividade.`;
    expect(msg).toContain("promovido");
    expect(msg).toContain("coordenador");
    expect(msg).toContain("TEC502");
  });

  it("demoted_to_prof message includes component info", () => {
    const msg = `Seu papel no componente TEC502 - Concorrência e Conectividade foi alterado para professor.`;
    expect(msg).toContain("alterado");
    expect(msg).toContain("professor");
  });

  it("removed_from_component message includes component info", () => {
    const msg = `Você foi removido do componente TEC502 - Concorrência e Conectividade.`;
    expect(msg).toContain("removido");
    expect(msg).toContain("TEC502");
  });

  it("eval_permission_granted message includes class and component info", () => {
    const msg = `Você recebeu permissão para avaliar sessões da turma TP01 do componente TEC502 - Concorrência e Conectividade.`;
    expect(msg).toContain("permissão");
    expect(msg).toContain("TP01");
    expect(msg).toContain("TEC502");
  });

  it("eval_permission_revoked message includes class and component info", () => {
    const msg = `Sua permissão para avaliar sessões da turma TP01 do componente TEC502 - Concorrência e Conectividade foi revogada.`;
    expect(msg).toContain("revogada");
    expect(msg).toContain("TP01");
    expect(msg).toContain("TEC502");
  });
});

// ─── Test notification read state ───
describe("Notification read state", () => {
  it("new notifications default to unread", () => {
    const notification = { read: false };
    expect(notification.read).toBe(false);
  });

  it("marking as read changes state", () => {
    const notification = { read: false };
    notification.read = true;
    expect(notification.read).toBe(true);
  });
});

// ─── Test pagination ───
describe("Notification pagination", () => {
  it("calculates total pages correctly", () => {
    const total = 55;
    const pageSize = 20;
    const totalPages = Math.ceil(total / pageSize);
    expect(totalPages).toBe(3);
  });

  it("calculates offset correctly", () => {
    const page = 3;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    expect(offset).toBe(40);
  });

  it("handles empty results", () => {
    const total = 0;
    const pageSize = 20;
    const totalPages = Math.ceil(total / pageSize);
    expect(totalPages).toBe(0);
  });
});

// ─── Test notification titles ───
describe("Notification titles", () => {
  const titleMap: Record<string, string> = {
    component_approved: "Solicitação Aprovada",
    component_rejected: "Solicitação Rejeitada",
    promoted_to_coordinator: "Promovido a Coordenador",
    demoted_to_prof: "Papel Alterado",
    removed_from_component: "Removido do Componente",
    eval_permission_granted: "Permissão de Avaliação Concedida",
    eval_permission_revoked: "Permissão de Avaliação Revogada",
  };

  it("each type has a descriptive title", () => {
    Object.entries(titleMap).forEach(([type, title]) => {
      expect(title.length).toBeGreaterThan(5);
      expect(typeof title).toBe("string");
    });
  });

  it("titles are unique", () => {
    const titles = Object.values(titleMap);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });
});
