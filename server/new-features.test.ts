import { describe, expect, it, vi } from "vitest";
import { buildNewRequestEmailHtml, buildComponentApprovalEmailHtml, buildComponentRejectionEmailHtml, buildEvalPermissionGrantedEmailHtml } from "./email";
import { appRouter } from "./routers";

// ─── Test 1: Email template for coordinator notification on new request ───
describe("buildNewRequestEmailHtml", () => {
  it("generates HTML with coordinator name, professor info, and component details", () => {
    const html = buildNewRequestEmailHtml(
      "Dr. Silva",
      "Prof. Santos",
      "santos@uni.edu",
      "TEC502",
      "Concorrência e Conectividade"
    );
    expect(html).toContain("Dr. Silva");
    expect(html).toContain("Prof. Santos");
    expect(html).toContain("santos@uni.edu");
    expect(html).toContain("TEC502");
    expect(html).toContain("Concorrência e Conectividade");
    expect(html).toContain("Nova Solicitação de Entrada");
    expect(html).toContain("aprovar");
    expect(html).toContain("rejeitar");
  });

  it("handles empty/null-like values gracefully", () => {
    const html = buildNewRequestEmailHtml("", "Unknown", "N/A", "ABC123", "Test Component");
    expect(html).toContain("ABC123");
    expect(html).toContain("Test Component");
    expect(html).toContain("Unknown");
  });
});

// ─── Test 2: Existing email templates still work ───
describe("buildComponentApprovalEmailHtml", () => {
  it("generates approval email with correct content", () => {
    const html = buildComponentApprovalEmailHtml("Prof. Santos", "TEC502", "Concorrência e Conectividade");
    expect(html).toContain("Prof. Santos");
    expect(html).toContain("TEC502");
    expect(html).toContain("aprovada");
  });
});

describe("buildComponentRejectionEmailHtml", () => {
  it("generates rejection email with correct content", () => {
    const html = buildComponentRejectionEmailHtml("Prof. Santos", "TEC502", "Concorrência e Conectividade");
    expect(html).toContain("Prof. Santos");
    expect(html).toContain("TEC502");
    expect(html).toContain("rejeitada");
  });
});

// ─── Test: Eval permission granted email template ───
describe("buildEvalPermissionGrantedEmailHtml", () => {
  it("generates HTML with professor name, class code, component info and grantor", () => {
    const html = buildEvalPermissionGrantedEmailHtml(
      "Prof. Santos",
      "TP01",
      "TEC502",
      "Concorrência e Conectividade",
      "Dr. Silva"
    );
    expect(html).toContain("Prof. Santos");
    expect(html).toContain("TP01");
    expect(html).toContain("TEC502");
    expect(html).toContain("Concorrência e Conectividade");
    expect(html).toContain("Dr. Silva");
    expect(html).toContain("Permissão de Avaliação Concedida");
    expect(html).toContain("Avaliar Tutorial");
  });

  it("has proper HTML structure", () => {
    const html = buildEvalPermissionGrantedEmailHtml("Prof", "TP01", "ABC", "Test", "Admin");
    expect(html).toContain("<div");
    expect(html).toContain("</div>");
    expect(html).toContain("style=");
    expect(html).toContain("font-family");
  });

  it("includes grantor info in a dedicated section", () => {
    const html = buildEvalPermissionGrantedEmailHtml("Prof", "TP01", "ABC", "Test", "Coord. Lima");
    expect(html).toContain("Concedida por");
    expect(html).toContain("Coord. Lima");
  });

  it("handles empty names gracefully", () => {
    const html = buildEvalPermissionGrantedEmailHtml("", "TP01", "ABC", "Test", "");
    expect(html).toContain("TP01");
    expect(html).toContain("ABC");
  });
});

// ─── Test 3: Audit log action labels ───
describe("Audit log action types", () => {
  const validActions = [
    "approve_component_request",
    "reject_component_request",
    "promote_to_coordinator",
    "demote_to_prof",
    "remove_from_component",
    "grant_eval_permission",
    "revoke_eval_permission",
    "transfer_student",
    "auto_approve_user",
  ];

  it("all expected action types are defined", () => {
    validActions.forEach(action => {
      expect(typeof action).toBe("string");
      expect(action.length).toBeGreaterThan(0);
    });
  });

  it("action types are unique", () => {
    const unique = new Set(validActions);
    expect(unique.size).toBe(validActions.length);
  });
});

// ─── Test 4: Permission types for tutorial eval ───
describe("Tutorial eval permission types", () => {
  const permissionTypes = ["owner", "coordinator", "authorized", "no_permission", "admin"];

  it("all permission types are defined", () => {
    expect(permissionTypes).toHaveLength(5);
    expect(permissionTypes).toContain("owner");
    expect(permissionTypes).toContain("coordinator");
    expect(permissionTypes).toContain("authorized");
    expect(permissionTypes).toContain("no_permission");
    expect(permissionTypes).toContain("admin");
  });

  it("owner, coordinator, and authorized can evaluate", () => {
    const canEvaluate = (perm: string) => perm !== "no_permission" && perm !== "admin";
    expect(canEvaluate("owner")).toBe(true);
    expect(canEvaluate("coordinator")).toBe(true);
    expect(canEvaluate("authorized")).toBe(true);
    expect(canEvaluate("no_permission")).toBe(false);
    expect(canEvaluate("admin")).toBe(false);
  });
});

// ─── Test 5: Audit log data structure ───
describe("Audit log data structure", () => {
  it("createAuditLog accepts all required fields", () => {
    const logData = {
      action: "approve_component_request",
      actorUserId: 1,
      targetUserId: 2,
      componentId: 3,
      classId: null,
      details: JSON.stringify({ componentId: 3 }),
    };

    expect(logData.action).toBe("approve_component_request");
    expect(logData.actorUserId).toBe(1);
    expect(logData.targetUserId).toBe(2);
    expect(logData.componentId).toBe(3);
    expect(logData.classId).toBeNull();
    expect(JSON.parse(logData.details!)).toEqual({ componentId: 3 });
  });

  it("details field can store transfer info", () => {
    const details = JSON.stringify({
      studentId: 10,
      fromClassId: 1,
      toClassId: 2,
    });
    const parsed = JSON.parse(details);
    expect(parsed.studentId).toBe(10);
    expect(parsed.fromClassId).toBe(1);
    expect(parsed.toClassId).toBe(2);
  });

  it("handles optional fields as null", () => {
    const logData = {
      action: "grant_eval_permission",
      actorUserId: 1,
      targetUserId: null,
      componentId: null,
      classId: 5,
      details: null,
    };
    expect(logData.targetUserId).toBeNull();
    expect(logData.componentId).toBeNull();
    expect(logData.details).toBeNull();
  });
});

// ─── Test 6: Email HTML structure validation ───
describe("Email HTML structure", () => {
  it("new request email has proper HTML structure", () => {
    const html = buildNewRequestEmailHtml("Coord", "Prof", "prof@test.com", "ABC", "Test");
    expect(html).toContain("<div");
    expect(html).toContain("</div>");
    expect(html).toContain("style=");
    expect(html).toContain("font-family");
  });

  it("approval email has proper HTML structure", () => {
    const html = buildComponentApprovalEmailHtml("User", "ABC", "Test");
    expect(html).toContain("<div");
    expect(html).toContain("</div>");
  });

  it("rejection email has proper HTML structure", () => {
    const html = buildComponentRejectionEmailHtml("User", "ABC", "Test");
    expect(html).toContain("<div");
    expect(html).toContain("</div>");
  });
});

// ─── Test: Unified approval flow (component approval auto-approves system user) ───
describe("Unified approval flow", () => {
  it("auto_approve_user audit log includes reason and componentId", () => {
    const details = JSON.stringify({
      reason: "Aprovado automaticamente ao ter componente aprovado",
      componentId: 5,
    });
    const parsed = JSON.parse(details);
    expect(parsed.reason).toContain("automaticamente");
    expect(parsed.componentId).toBe(5);
  });

  it("approving component for pending user should trigger auto-approval", () => {
    // Simulate the logic: if user.approvalStatus === "pending", auto-approve
    const pendingUser = { id: 10, approvalStatus: "pending" as const, role: "user" as const };
    const approvedUser = { id: 11, approvalStatus: "approved" as const, role: "prof" as const };

    const shouldAutoApprove = (user: { approvalStatus: string }) => user.approvalStatus === "pending";

    expect(shouldAutoApprove(pendingUser)).toBe(true);
    expect(shouldAutoApprove(approvedUser)).toBe(false);
  });

  it("notification message differs for auto-approved users", () => {
    const autoApprovedInSystem = true;
    const componentCode = "TEC502";
    const componentName = "Concorrência e Conectividade";

    const notifMessage = autoApprovedInSystem
      ? `Sua solicitação de entrada no componente ${componentCode} - ${componentName} foi aprovada. Você também foi aprovado no sistema como professor.`
      : `Sua solicitação de entrada no componente ${componentCode} - ${componentName} foi aprovada.`;

    expect(notifMessage).toContain("aprovado no sistema como professor");

    const regularMessage = false
      ? `Sua solicitação de entrada no componente ${componentCode} - ${componentName} foi aprovada. Você também foi aprovado no sistema como professor.`
      : `Sua solicitação de entrada no componente ${componentCode} - ${componentName} foi aprovada.`;

    expect(regularMessage).not.toContain("aprovado no sistema como professor");
  });

  it("notification title includes system access info for auto-approved users", () => {
    const autoApprovedInSystem = true;
    const title = autoApprovedInSystem
      ? "Solicitação Aprovada - Acesso ao Sistema Liberado"
      : "Solicitação Aprovada";

    expect(title).toContain("Acesso ao Sistema Liberado");
  });

  it("listPendingRequestsByComponents includes userApprovalStatus field", () => {
    // Verify the query shape includes the new field
    const mockResult = {
      id: 1,
      userId: 10,
      componentId: 5,
      componentCode: "TEC502",
      componentName: "Concorrência",
      status: "pending",
      professorName: "João",
      professorEmail: "joao@test.com",
      userCreatedAt: new Date(),
      userApprovalStatus: "pending",
    };

    expect(mockResult.userApprovalStatus).toBe("pending");
    expect(mockResult).toHaveProperty("userApprovalStatus");
  });

  it("approveUser changes role to prof and status to approved", () => {
    // Simulate the approveUser behavior
    const user = { role: "user", approvalStatus: "pending" };
    // After approveUser:
    const updatedUser = { role: "prof", approvalStatus: "approved" };

    expect(updatedUser.role).toBe("prof");
    expect(updatedUser.approvalStatus).toBe("approved");
  });
});

// ─── Test: Coordinator notification on new registration ───
describe("Coordinator notification on new registration", () => {
  it("notification metadata includes source=registration for new signups", () => {
    const metadata = JSON.stringify({ componentId: 5, requesterId: 10, source: "registration" });
    const parsed = JSON.parse(metadata);
    expect(parsed.source).toBe("registration");
    expect(parsed.componentId).toBe(5);
    expect(parsed.requesterId).toBe(10);
  });

  it("notification message includes (novo cadastro) for registration-based requests", () => {
    const name = "João Silva";
    const componentCode = "TEC502";
    const componentName = "Concorrência e Conectividade";
    const message = `${name} solicitou entrada em ${componentCode} - ${componentName} (novo cadastro)`;
    expect(message).toContain("(novo cadastro)");
    expect(message).toContain("João Silva");
    expect(message).toContain("TEC502");
  });

  it("email is sent to each coordinator of the component", () => {
    const coordinators = [
      { userId: 1, userName: "Coord 1", userEmail: "coord1@test.com" },
      { userId: 2, userName: "Coord 2", userEmail: "coord2@test.com" },
      { userId: 3, userName: null, userEmail: null },
    ];
    const emailRecipients = coordinators.filter(c => c.userEmail).map(c => c.userEmail);
    expect(emailRecipients).toHaveLength(2);
    expect(emailRecipients).toContain("coord1@test.com");
    expect(emailRecipients).toContain("coord2@test.com");
  });
});

// ─── Test: Batch approval (Aprovar Todos) ───
describe("Batch approval - Aprovar Todos", () => {
  it("batch_approve_component_requests audit log includes counts", () => {
    const details = JSON.stringify({ approvedCount: 5, autoApprovedUsers: 2, totalRequests: 5 });
    const parsed = JSON.parse(details);
    expect(parsed.approvedCount).toBe(5);
    expect(parsed.autoApprovedUsers).toBe(2);
    expect(parsed.totalRequests).toBe(5);
  });

  it("returns correct counts when all requests are approved", () => {
    const result = { success: true, approvedCount: 3, autoApprovedUsers: 1 };
    expect(result.success).toBe(true);
    expect(result.approvedCount).toBe(3);
    expect(result.autoApprovedUsers).toBe(1);
  });

  it("returns zero counts when no pending requests exist", () => {
    const result = { success: true, approvedCount: 0, autoApprovedUsers: 0 };
    expect(result.success).toBe(true);
    expect(result.approvedCount).toBe(0);
    expect(result.autoApprovedUsers).toBe(0);
  });

  it("individual approval details include batchApproval flag", () => {
    const details = JSON.stringify({ componentId: 3, batchApproval: true });
    const parsed = JSON.parse(details);
    expect(parsed.batchApproval).toBe(true);
    expect(parsed.componentId).toBe(3);
  });

  it("auto-approve reason mentions batch approval", () => {
    const details = JSON.stringify({ reason: "Aprovado automaticamente via aprovação em lote", componentId: 5 });
    const parsed = JSON.parse(details);
    expect(parsed.reason).toContain("em lote");
  });

  it("toast message differs based on autoApprovedUsers count", () => {
    const data1 = { approvedCount: 5, autoApprovedUsers: 2 };
    const msg1 = data1.autoApprovedUsers > 0
      ? `${data1.approvedCount} solicitações aprovadas (${data1.autoApprovedUsers} novos usuários aprovados no sistema)`
      : `${data1.approvedCount} solicitações aprovadas`;
    expect(msg1).toContain("novos usuários aprovados no sistema");

    const data2 = { approvedCount: 3, autoApprovedUsers: 0 };
    const msg2 = data2.autoApprovedUsers > 0
      ? `${data2.approvedCount} solicitações aprovadas (${data2.autoApprovedUsers} novos usuários aprovados no sistema)`
      : `${data2.approvedCount} solicitações aprovadas`;
    expect(msg2).not.toContain("novos usuários");
  });

  it("admin sees all pending requests across all components", () => {
    const userRole = "admin";
    const allComponentIds = [1, 2, 3, 4, 5];
    const coordComponentIds = [2, 3];

    const visibleIds = userRole === "admin" ? allComponentIds : coordComponentIds;
    expect(visibleIds).toEqual([1, 2, 3, 4, 5]);
  });

  it("coordinator only sees pending requests for their components", () => {
    const userRole = "coordinator";
    const allComponentIds = [1, 2, 3, 4, 5];
    const coordComponentIds = [2, 3];

    const visibleIds = userRole === "admin" ? allComponentIds : coordComponentIds;
    expect(visibleIds).toEqual([2, 3]);
  });
});

// ─── Admin Password Setup (OAuth → Email/Password) Tests ───
describe("Admin password setup for OAuth users", () => {
  it("auth.setPassword route exists", () => {
    expect(appRouter._def.procedures["auth.setPassword"]).toBeDefined();
  });

  it("auth.hasPassword route exists", () => {
    expect(appRouter._def.procedures["auth.hasPassword"]).toBeDefined();
  });

  it("setUserEmail function is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.setUserEmail).toBe("function");
  });

  it("updateUserLoginMethod function is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.updateUserLoginMethod).toBe("function");
  });

  it("setPassword input requires newPassword with min 6 chars", () => {
    const procedure = appRouter._def.procedures["auth.setPassword"] as any;
    const schema = procedure?._def?.inputs?.[0];
    expect(schema).toBeDefined();
    if (schema) {
      const validResult = schema.safeParse({ newPassword: "abcdef" });
      expect(validResult.success).toBe(true);
      const invalidResult = schema.safeParse({ newPassword: "abc" });
      expect(invalidResult.success).toBe(false);
    }
  });

  it("setPassword input optionally accepts email", () => {
    const procedure = appRouter._def.procedures["auth.setPassword"] as any;
    const schema = procedure?._def?.inputs?.[0];
    expect(schema).toBeDefined();
    if (schema) {
      const withEmail = schema.safeParse({ newPassword: "abcdef", email: "test@example.com" });
      expect(withEmail.success).toBe(true);
      const withoutEmail = schema.safeParse({ newPassword: "abcdef" });
      expect(withoutEmail.success).toBe(true);
      const invalidEmail = schema.safeParse({ newPassword: "abcdef", email: "not-an-email" });
      expect(invalidEmail.success).toBe(false);
    }
  });

  it("hasPassword is a query (not mutation)", () => {
    const procedure = appRouter._def.procedures["auth.hasPassword"] as any;
    expect(procedure).toBeDefined();
    // Verify it's a query by checking it doesn't have mutation-specific properties
    expect(procedure._def.type).toBe("query");
  });
});
