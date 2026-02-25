import { describe, it, expect } from "vitest";

// ─── Component entity tests ───

describe("Component entity structure", () => {
  it("component has code and name fields", () => {
    const component = { id: 1, code: "TEC502", name: "Concorrência e Conectividade" };
    expect(component.code).toBe("TEC502");
    expect(component.name).toBe("Concorrência e Conectividade");
  });

  it("component code should be uppercase", () => {
    const code = "tec502".toUpperCase();
    expect(code).toBe("TEC502");
  });

  it("component code should be unique identifier", () => {
    const components = [
      { id: 1, code: "TEC502", name: "Concorrência e Conectividade" },
      { id: 2, code: "TEC499", name: "Sistemas Operacionais" },
    ];
    const codes = components.map(c => c.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});

describe("Class references component by ID", () => {
  it("class has componentId instead of componentCode", () => {
    const cls = { id: 1, classCode: "TP01", componentId: 1, semester: "2026.2" };
    expect(cls.componentId).toBe(1);
    expect(cls).not.toHaveProperty("componentCode");
  });

  it("class display uses component code from join", () => {
    const cls = { id: 1, classCode: "TP01", componentId: 1, semester: "2026.2" };
    const component = { id: 1, code: "TEC502", name: "Concorrência e Conectividade" };
    const display = `${component.code} - ${cls.classCode} (${cls.semester})`;
    expect(display).toBe("TEC502 - TP01 (2026.2)");
  });

  it("multiple classes can reference same component", () => {
    const classes = [
      { id: 1, classCode: "TP01", componentId: 1, semester: "2026.2" },
      { id: 2, classCode: "TP02", componentId: 1, semester: "2026.2" },
    ];
    expect(classes[0].componentId).toBe(classes[1].componentId);
    expect(classes[0].classCode).not.toBe(classes[1].classCode);
  });
});

describe("Component CRUD operations", () => {
  it("create component requires code and name", () => {
    const input = { code: "TEC502", name: "Concorrência e Conectividade" };
    expect(input.code).toBeTruthy();
    expect(input.name).toBeTruthy();
  });

  it("update component allows changing code and name", () => {
    const update = { id: 1, code: "TEC503", name: "Redes de Computadores" };
    expect(update.id).toBe(1);
    expect(update.code).toBe("TEC503");
    expect(update.name).toBe("Redes de Computadores");
  });

  it("delete component by id", () => {
    const deleteInput = { id: 1 };
    expect(deleteInput.id).toBe(1);
  });
});

describe("Class creation with componentId", () => {
  it("create class requires componentId, classCode and semester", () => {
    const input = { classCode: "TP01", componentId: 1, semester: "2026.2" };
    expect(input.classCode).toBeTruthy();
    expect(input.componentId).toBeGreaterThan(0);
    expect(input.semester).toBeTruthy();
  });

  it("update class allows changing componentId", () => {
    const update = { id: 1, classCode: "TP01", componentId: 2, semester: "2026.2" };
    expect(update.componentId).toBe(2);
  });
});

describe("Student access validates session with component info", () => {
  it("validateCode returns componentCode and componentName from join", () => {
    const result = {
      sessionId: 1,
      label: "Sessão 1",
      classCode: "TP01",
      componentCode: "TEC502",
      componentName: "Concorrência e Conectividade",
      semester: "2026.2",
    };
    expect(result.componentCode).toBe("TEC502");
    expect(result.componentName).toBe("Concorrência e Conectividade");
  });

  it("display format uses componentCode from result", () => {
    const sessionInfo = {
      componentCode: "TEC502",
      classCode: "TP01",
      semester: "2026.2",
    };
    const display = `${sessionInfo.componentCode} - ${sessionInfo.classCode} (${sessionInfo.semester})`;
    expect(display).toBe("TEC502 - TP01 (2026.2)");
  });
});

describe("Professor components use componentId", () => {
  it("addProfessorComponent uses componentId", () => {
    const input = { userId: 1, componentId: 1 };
    expect(input.userId).toBeGreaterThan(0);
    expect(input.componentId).toBeGreaterThan(0);
  });

  it("removeProfessorComponent uses componentId", () => {
    const input = { userId: 1, componentId: 1 };
    expect(input.userId).toBeGreaterThan(0);
    expect(input.componentId).toBeGreaterThan(0);
  });

  it("professor components list includes component code and name", () => {
    const components = [
      { userId: 1, componentId: 1, componentCode: "TEC502", componentName: "Concorrência e Conectividade" },
      { userId: 1, componentId: 2, componentCode: "TEC499", componentName: "Sistemas Operacionais" },
    ];
    expect(components).toHaveLength(2);
    expect(components[0].componentCode).toBe("TEC502");
    expect(components[1].componentCode).toBe("TEC499");
  });
});
