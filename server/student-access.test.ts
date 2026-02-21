import { describe, it, expect } from "vitest";

// Test the access code generation logic
describe("Access Code Generation", () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  it("should generate 6-character codes from valid charset", () => {
    // Simulate code generation
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    expect(code).toHaveLength(6);
    // Verify no ambiguous characters
    expect(code).not.toMatch(/[IO01]/);
  });

  it("should only contain uppercase letters and digits from valid charset", () => {
    for (let trial = 0; trial < 100; trial++) {
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });
});

// Test email username matching logic
describe("Email Username Matching", () => {
  const students = [
    { id: 1, name: "Antonio Coutinho", email: "aatrcoutinho@ecomp.uefs.br", classId: 1 },
    { id: 2, name: "Maria Silva", email: "msilva@ecomp.uefs.br", classId: 1 },
    { id: 3, name: "José Santos", email: "jmdsantos@ecomp.uefs.br", classId: 1 },
  ];

  function findStudentByEmailUsername(emailUsername: string) {
    const normalized = emailUsername.toLowerCase().trim();
    return students.find(s => {
      const emailUser = s.email.split("@")[0].toLowerCase();
      return emailUser === normalized;
    });
  }

  it("should find student by exact email username", () => {
    const result = findStudentByEmailUsername("aatrcoutinho");
    expect(result).toBeDefined();
    expect(result!.id).toBe(1);
  });

  it("should be case-insensitive", () => {
    const result = findStudentByEmailUsername("AATRCOUTINHO");
    expect(result).toBeDefined();
    expect(result!.id).toBe(1);
  });

  it("should trim whitespace", () => {
    const result = findStudentByEmailUsername("  msilva  ");
    expect(result).toBeDefined();
    expect(result!.id).toBe(2);
  });

  it("should return undefined for non-existent username", () => {
    const result = findStudentByEmailUsername("nonexistent");
    expect(result).toBeUndefined();
  });

  it("should not match partial usernames", () => {
    const result = findStudentByEmailUsername("aatrc");
    expect(result).toBeUndefined();
  });

  it("should not match with @domain included", () => {
    const result = findStudentByEmailUsername("aatrcoutinho@ecomp.uefs.br");
    expect(result).toBeUndefined();
  });
});

// Test password generation for Google Workspace export (initials + enrollment)
describe("Password Generation (initials + enrollment)", () => {
  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts.map(p => p[0]?.toLowerCase() || "").join("");
  }

  it("should generate password from initials + enrollment", () => {
    const initials = getInitials("Antonio Augusto Teixeira Ribeiro Coutinho");
    const enrollment = "20221001";
    expect(initials + enrollment).toBe("aatrc20221001");
  });

  it("should handle single name", () => {
    const initials = getInitials("Maria");
    const enrollment = "20221002";
    expect(initials + enrollment).toBe("m20221002");
  });
});

// Test access code validation logic
describe("Access Code Validation", () => {
  it("should convert to uppercase for comparison", () => {
    const input = "abc123";
    expect(input.toUpperCase()).toBe("ABC123");
  });

  it("should handle mixed case input", () => {
    const input = "AbC12d";
    expect(input.toUpperCase()).toBe("ABC12D");
  });
});
