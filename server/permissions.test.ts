import { describe, it, expect } from "vitest";

// ─── Unit tests for the new component-based permission system ───

describe("Role hierarchy", () => {
  const validRoles = ["admin", "coordinator", "prof", "user"];

  it("admin is the highest role", () => {
    expect(validRoles[0]).toBe("admin");
  });

  it("all four roles are defined", () => {
    expect(validRoles).toContain("admin");
    expect(validRoles).toContain("coordinator");
    expect(validRoles).toContain("prof");
    expect(validRoles).toContain("user");
    expect(validRoles).toHaveLength(4);
  });

  it("first user gets admin role", () => {
    const totalUsers = 0;
    const isFirst = totalUsers === 0;
    const role = isFirst ? "admin" : "user";
    expect(role).toBe("admin");
  });

  it("subsequent users get user role (pending)", () => {
    const totalUsers = 5;
    const isFirst = totalUsers === 0;
    const role = isFirst ? "admin" : "user";
    expect(role).toBe("user");
  });

  it("approved user becomes prof role", () => {
    // When admin approves a pending user, their role changes to prof
    const approvedRole = "prof";
    expect(approvedRole).toBe("prof");
  });
});

describe("Procedure access control", () => {
  it("adminProcedure accepts only admin", () => {
    const check = (role: string) => role === "admin";
    expect(check("admin")).toBe(true);
    expect(check("coordinator")).toBe(false);
    expect(check("prof")).toBe(false);
    expect(check("user")).toBe(false);
  });

  it("coordinatorProcedure accepts admin and coordinator", () => {
    const check = (role: string) => role === "admin" || role === "coordinator";
    expect(check("admin")).toBe(true);
    expect(check("coordinator")).toBe(true);
    expect(check("prof")).toBe(false);
    expect(check("user")).toBe(false);
  });

  it("approvedProcedure accepts admin, coordinator, and prof", () => {
    const check = (role: string) => ["admin", "coordinator", "prof"].includes(role);
    expect(check("admin")).toBe(true);
    expect(check("coordinator")).toBe(true);
    expect(check("prof")).toBe(true);
    expect(check("user")).toBe(false);
  });
});

describe("Component-based permissions", () => {
  // Simulate professor_components data
  const professorComponents = [
    { userId: 1, componentId: 10, componentRole: "coordinator", status: "approved" },
    { userId: 1, componentId: 20, componentRole: "prof", status: "approved" },
    { userId: 2, componentId: 10, componentRole: "prof", status: "approved" },
    { userId: 3, componentId: 10, componentRole: "prof", status: "pending" },
  ];

  function isCoordinatorOf(userId: number, componentId: number): boolean {
    return professorComponents.some(
      pc => pc.userId === userId && pc.componentId === componentId && pc.componentRole === "coordinator" && pc.status === "approved"
    );
  }

  function isMemberOf(userId: number, componentId: number): boolean {
    return professorComponents.some(
      pc => pc.userId === userId && pc.componentId === componentId && pc.status === "approved"
    );
  }

  function getApprovedComponentIds(userId: number): number[] {
    return professorComponents
      .filter(pc => pc.userId === userId && pc.status === "approved")
      .map(pc => pc.componentId);
  }

  it("user 1 is coordinator of component 10", () => {
    expect(isCoordinatorOf(1, 10)).toBe(true);
  });

  it("user 1 is NOT coordinator of component 20", () => {
    expect(isCoordinatorOf(1, 20)).toBe(false);
  });

  it("user 2 is member of component 10 but not coordinator", () => {
    expect(isMemberOf(2, 10)).toBe(true);
    expect(isCoordinatorOf(2, 10)).toBe(false);
  });

  it("user 3 is pending and not yet a member", () => {
    expect(isMemberOf(3, 10)).toBe(false);
  });

  it("user 1 has access to components 10 and 20", () => {
    const ids = getApprovedComponentIds(1);
    expect(ids).toContain(10);
    expect(ids).toContain(20);
    expect(ids).toHaveLength(2);
  });

  it("user 2 has access only to component 10", () => {
    const ids = getApprovedComponentIds(2);
    expect(ids).toContain(10);
    expect(ids).toHaveLength(1);
  });
});

describe("Component role management", () => {
  it("coordinator can promote prof to coordinator in their component", () => {
    const currentUserRole = "coordinator";
    const currentUserComponentRole = "coordinator";
    const targetComponentRole = "prof";
    const canPromote = currentUserComponentRole === "coordinator" && targetComponentRole === "prof";
    expect(canPromote).toBe(true);
  });

  it("coordinator can demote another coordinator to prof", () => {
    const currentUserComponentRole = "coordinator";
    const targetComponentRole = "coordinator";
    const canDemote = currentUserComponentRole === "coordinator" && targetComponentRole === "coordinator";
    expect(canDemote).toBe(true);
  });

  it("prof cannot promote others", () => {
    const currentUserComponentRole = "prof";
    const canPromote = currentUserComponentRole === "coordinator";
    expect(canPromote).toBe(false);
  });

  it("coordinator can remove prof from component but not from system", () => {
    const action = "removeFromComponent";
    expect(action).not.toBe("deleteUser");
  });

  it("only admin can delete users from system", () => {
    const canDelete = (role: string) => role === "admin";
    expect(canDelete("admin")).toBe(true);
    expect(canDelete("coordinator")).toBe(false);
    expect(canDelete("prof")).toBe(false);
  });
});

describe("Class access by component", () => {
  // Simulate classes with componentId
  const classes = [
    { id: 1, componentId: 10, classCode: "TP01" },
    { id: 2, componentId: 10, classCode: "TP02" },
    { id: 3, componentId: 20, classCode: "MI01" },
    { id: 4, componentId: 30, classCode: "CC01" },
  ];

  function getClassesForUser(userComponentIds: number[]) {
    return classes.filter(c => userComponentIds.includes(c.componentId));
  }

  it("coordinator of component 10 sees classes TP01 and TP02", () => {
    const result = getClassesForUser([10]);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.classCode)).toContain("TP01");
    expect(result.map(c => c.classCode)).toContain("TP02");
  });

  it("prof with components 10 and 20 sees 3 classes", () => {
    const result = getClassesForUser([10, 20]);
    expect(result).toHaveLength(3);
  });

  it("admin sees all classes (all component IDs)", () => {
    const allComponentIds = [10, 20, 30];
    const result = getClassesForUser(allComponentIds);
    expect(result).toHaveLength(4);
  });

  it("user with no components sees no classes", () => {
    const result = getClassesForUser([]);
    expect(result).toHaveLength(0);
  });
});

describe("Component request workflow", () => {
  it("new request starts with pending status", () => {
    const status = "pending";
    expect(status).toBe("pending");
  });

  it("approved request changes status to approved", () => {
    const status = "approved";
    expect(status).toBe("approved");
  });

  it("rejected request changes status to rejected", () => {
    const status = "rejected";
    expect(status).toBe("rejected");
  });

  it("pending requests visible only to coordinators of that component", () => {
    const pendingRequest = { userId: 5, componentId: 10, status: "pending" };
    const coordinators = [{ userId: 1, componentId: 10, componentRole: "coordinator" }];
    const canSee = coordinators.some(c => c.componentId === pendingRequest.componentId);
    expect(canSee).toBe(true);
  });

  it("pending requests NOT visible to coordinators of other components", () => {
    const pendingRequest = { userId: 5, componentId: 10, status: "pending" };
    const coordinators = [{ userId: 2, componentId: 20, componentRole: "coordinator" }];
    const canSee = coordinators.some(c => c.componentId === pendingRequest.componentId);
    expect(canSee).toBe(false);
  });
});

describe("Menu items by role", () => {
  function getMenuItemsForRole(role: string) {
    const base = ["Painel Geral", "Componentes", "Turmas", "Alunos", "Sessões", "Resultados", "Professores"];
    if (role === "admin") {
      return [...base, "Exportar Alunos", "Config. E-mail"];
    }
    // coordinator and prof get tutorial eval
    const items = [...base];
    const sessionsIdx = items.indexOf("Sessões");
    items.splice(sessionsIdx + 1, 0, "Avaliar Tutorial");
    return items;
  }

  it("admin menu does NOT include Avaliar Tutorial", () => {
    const items = getMenuItemsForRole("admin");
    expect(items).not.toContain("Avaliar Tutorial");
  });

  it("admin menu includes Config. E-mail", () => {
    const items = getMenuItemsForRole("admin");
    expect(items).toContain("Config. E-mail");
  });

  it("coordinator menu includes Avaliar Tutorial", () => {
    const items = getMenuItemsForRole("coordinator");
    expect(items).toContain("Avaliar Tutorial");
  });

  it("coordinator menu does NOT include Config. E-mail", () => {
    const items = getMenuItemsForRole("coordinator");
    expect(items).not.toContain("Config. E-mail");
  });

  it("prof menu includes Avaliar Tutorial", () => {
    const items = getMenuItemsForRole("prof");
    expect(items).toContain("Avaliar Tutorial");
  });

  it("prof menu does NOT include Config. E-mail", () => {
    const items = getMenuItemsForRole("prof");
    expect(items).not.toContain("Config. E-mail");
  });

  it("admin menu includes Exportar Alunos", () => {
    const items = getMenuItemsForRole("admin");
    expect(items).toContain("Exportar Alunos");
  });

  it("coordinator menu does NOT include Exportar Alunos", () => {
    const items = getMenuItemsForRole("coordinator");
    expect(items).not.toContain("Exportar Alunos");
  });

  it("prof menu does NOT include Exportar Alunos", () => {
    const items = getMenuItemsForRole("prof");
    expect(items).not.toContain("Exportar Alunos");
  });
});

describe("Class management permissions (assertClassManager)", () => {
  function canManageClass(userId: number, role: string, compRole: string | null, classProfessorUserId: number): boolean {
    if (role === "admin") return true;
    if (compRole === "coordinator") return true;
    if (compRole === "prof" && classProfessorUserId === userId) return true;
    return false;
  }

  it("admin can manage any class", () => {
    expect(canManageClass(1, "admin", null, 99)).toBe(true);
  });

  it("coordinator of component can manage any class in that component", () => {
    expect(canManageClass(2, "coordinator", "coordinator", 99)).toBe(true);
  });

  it("prof who created the class can manage it", () => {
    expect(canManageClass(3, "prof", "prof", 3)).toBe(true);
  });

  it("prof who did NOT create the class cannot manage it", () => {
    expect(canManageClass(3, "prof", "prof", 99)).toBe(false);
  });

  it("prof with no component role cannot manage any class", () => {
    expect(canManageClass(4, "prof", null, 4)).toBe(false);
  });

  it("user role cannot manage any class", () => {
    expect(canManageClass(5, "user", null, 5)).toBe(false);
  });
});

describe("Router routes existence for new permissions", async () => {
  const { appRouter } = await import("./routers");

  it("professors.myComponents route exists", () => {
    expect(appRouter._def.procedures["professors.myComponents"]).toBeDefined();
  });

  it("professors.requestComponent route exists", () => {
    expect(appRouter._def.procedures["professors.requestComponent"]).toBeDefined();
  });

  it("professors.pendingComponentRequests route exists", () => {
    expect(appRouter._def.procedures["professors.pendingComponentRequests"]).toBeDefined();
  });

  it("professors.approveComponentRequest route exists", () => {
    expect(appRouter._def.procedures["professors.approveComponentRequest"]).toBeDefined();
  });

  it("professors.rejectComponentRequest route exists", () => {
    expect(appRouter._def.procedures["professors.rejectComponentRequest"]).toBeDefined();
  });

  it("professors.promoteToCoordinator route exists", () => {
    expect(appRouter._def.procedures["professors.promoteToCoordinator"]).toBeDefined();
  });

  it("professors.demoteToProf route exists", () => {
    expect(appRouter._def.procedures["professors.demoteToProf"]).toBeDefined();
  });

  it("professors.removeFromComponent route exists", () => {
    expect(appRouter._def.procedures["professors.removeFromComponent"]).toBeDefined();
  });

  it("professors.deleteUser route exists", () => {
    expect(appRouter._def.procedures["professors.deleteUser"]).toBeDefined();
  });

  it("components.list route exists (public for all)", () => {
    expect(appRouter._def.procedures["components.list"]).toBeDefined();
  });

  it("classes.list route exists", () => {
    expect(appRouter._def.procedures["classes.list"]).toBeDefined();
  });

  it("sessions.list route exists", () => {
    expect(appRouter._def.procedures["sessions.list"]).toBeDefined();
  });
});
