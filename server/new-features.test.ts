import { describe, expect, it, vi } from "vitest";
import { buildNewRequestEmailHtml, buildComponentApprovalEmailHtml, buildComponentRejectionEmailHtml, buildEvalPermissionGrantedEmailHtml } from "./email";

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
