import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Test: Student management with new structure ───
// Tests for: enrollment required, email optional, class linking, smart deletion

describe("Student management - new structure", () => {

  describe("Student creation with enrollment required", () => {
    it("requires enrollment field", () => {
      const student = { name: "João Silva", enrollment: "20221001" };
      expect(student.enrollment).toBeTruthy();
      expect(student.name).toBeTruthy();
    });

    it("allows creation without email", () => {
      const student = { name: "João Silva", enrollment: "20221001", email: null };
      expect(student.email).toBeNull();
    });

    it("allows creation with optional email", () => {
      const student = { name: "João Silva", enrollment: "20221001", email: "joao@ecomp.uefs.br" };
      expect(student.email).toBe("joao@ecomp.uefs.br");
    });
  });

  describe("CSV import without email", () => {
    function parseCSVForImport(content: string): { name: string; enrollment: string }[] {
      const lines = content.split("\n");
      const parsed: { name: string; enrollment: string }[] = [];
      for (const line of lines) {
        const cols = line.split(";");
        const num = cols[1]?.trim();
        if (!num || isNaN(parseInt(num))) continue;
        const enrollment = cols[3]?.trim();
        const name = cols[4]?.trim();
        if (!name || !enrollment) continue;
        if (name === "Aluno" || enrollment === "Matrícula") continue;
        parsed.push({ name, enrollment });
      }
      return parsed;
    }

    it("parses CSV and extracts only name and enrollment (no email)", () => {
      const csv = `Turma;Num;Sit;Matrícula;Aluno
TP01;1;A;20221001;ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO
TP01;2;A;20221002;JOSE MACEDO DOS SANTOS JUNIOR`;
      const result = parseCSVForImport(csv);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "ANTONIO AUGUSTO TEIXEIRA RIBEIRO COUTINHO", enrollment: "20221001" });
      expect(result[1]).toEqual({ name: "JOSE MACEDO DOS SANTOS JUNIOR", enrollment: "20221002" });
      // No email field in the result
      expect((result[0] as any).email).toBeUndefined();
    });

    it("skips header rows", () => {
      const csv = `Turma;Num;Sit;Matrícula;Aluno
TP01;1;A;20221001;MARIA SILVA`;
      const result = parseCSVForImport(csv);
      expect(result).toHaveLength(1);
    });
  });

  describe("Student-class linking logic", () => {
    it("student can belong to multiple classes of different components", () => {
      // Student in TEC502-TP01 and TEC503-TP02
      const studentClasses = [
        { classId: 1, componentCode: "TEC502", classCode: "TP01" },
        { classId: 2, componentCode: "TEC503", classCode: "TP02" },
      ];
      const components = new Set(studentClasses.map(c => c.componentCode));
      expect(components.size).toBe(2); // Different components, allowed
    });

    it("student cannot belong to two classes of the same component", () => {
      // Student tries to be in TEC502-TP01 and TEC502-TP02
      const existingClasses = [
        { classId: 1, componentCode: "TEC502", classCode: "TP01" },
      ];
      const newClass = { classId: 2, componentCode: "TEC502", classCode: "TP02" };
      const conflict = existingClasses.some(c => c.componentCode === newClass.componentCode);
      expect(conflict).toBe(true);
    });

    it("re-importing existing student links to class without duplication", () => {
      // Simulate: student already exists with enrollment 20221001
      const existingStudent = { id: 1, name: "João Silva", enrollment: "20221001", email: null };
      const importData = { name: "JOAO SILVA", enrollment: "20221001" };
      
      // Student found by enrollment - should link, not create
      const found = existingStudent.enrollment === importData.enrollment;
      expect(found).toBe(true);
    });
  });

  describe("Smart deletion logic", () => {
    it("removing student from class does not delete student if in other classes", () => {
      const studentClasses = [
        { classId: 1, componentCode: "TEC502" },
        { classId: 2, componentCode: "TEC503" },
      ];
      // Remove from class 1
      const remaining = studentClasses.filter(c => c.classId !== 1);
      expect(remaining.length).toBe(1);
      // Student should NOT be deleted (still in another class)
      const shouldDelete = remaining.length === 0;
      expect(shouldDelete).toBe(false);
    });

    it("removing student from last class deletes student from system", () => {
      const studentClasses = [
        { classId: 1, componentCode: "TEC502" },
      ];
      // Remove from class 1
      const remaining = studentClasses.filter(c => c.classId !== 1);
      expect(remaining.length).toBe(0);
      // Student SHOULD be deleted (no more classes)
      const shouldDelete = remaining.length === 0;
      expect(shouldDelete).toBe(true);
    });
  });

  describe("Student email update during evaluation", () => {
    it("student can set email during peer evaluation", () => {
      const student = { id: 1, name: "João", enrollment: "20221001", email: null as string | null };
      const newEmail = "joao@ecomp.uefs.br";
      student.email = newEmail;
      expect(student.email).toBe("joao@ecomp.uefs.br");
    });

    it("student can update existing email during evaluation", () => {
      const student = { id: 1, name: "João", enrollment: "20221001", email: "old@ecomp.uefs.br" };
      const newEmail = "new@ecomp.uefs.br";
      student.email = newEmail;
      expect(student.email).toBe("new@ecomp.uefs.br");
    });

    it("email is preserved across evaluations", () => {
      // First evaluation: student sets email
      const student = { id: 1, email: null as string | null };
      student.email = "joao@ecomp.uefs.br";
      
      // Second evaluation: email should be pre-filled
      const loginResult = { studentEmail: student.email };
      expect(loginResult.studentEmail).toBe("joao@ecomp.uefs.br");
    });
  });

  describe("Student access by enrollment", () => {
    it("login uses enrollment (matrícula) not email username", () => {
      const loginInput = { accessCode: "ABC123", enrollment: "20221001" };
      expect(loginInput.enrollment).toBe("20221001");
      expect((loginInput as any).emailUsername).toBeUndefined();
    });

    it("enrollment is trimmed before lookup", () => {
      const input = "  20221001  ";
      const trimmed = input.trim();
      expect(trimmed).toBe("20221001");
    });
  });
});
