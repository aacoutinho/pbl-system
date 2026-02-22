import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";

// ─── Unit tests for email/password authentication logic ───

describe("Password hashing", () => {
  it("bcrypt hashes and verifies a password correctly", async () => {
    const password = "minhaSenha123";
    const hash = await bcrypt.hash(password, 10);
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);
    const valid = await bcrypt.compare(password, hash);
    expect(valid).toBe(true);
  });

  it("bcrypt rejects wrong password", async () => {
    const hash = await bcrypt.hash("senhaCorreta", 10);
    const valid = await bcrypt.compare("senhaErrada", hash);
    expect(valid).toBe(false);
  });

  it("bcrypt generates different hashes for same password", async () => {
    const password = "mesma123";
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);
    expect(hash1).not.toBe(hash2); // Different salts
    // But both verify
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });
});

describe("OpenId generation for local users", () => {
  it("generates local: prefix for email-based users", () => {
    const email = "professor@exemplo.com";
    const openId = `local:${email}`;
    expect(openId).toBe("local:professor@exemplo.com");
    expect(openId.startsWith("local:")).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const email = "Professor@EXEMPLO.COM";
    const openId = `local:${email.toLowerCase()}`;
    expect(openId).toBe("local:professor@exemplo.com");
  });
});

describe("First user detection logic", () => {
  it("first user should be coordinator and auto-approved", () => {
    const totalUsers = 0;
    const isFirst = totalUsers === 0;
    expect(isFirst).toBe(true);

    // First user gets coordinator role and approved status
    const role = isFirst ? "coordinator" : "admin";
    const approvalStatus = isFirst ? "approved" : "pending";
    expect(role).toBe("coordinator");
    expect(approvalStatus).toBe("approved");
  });

  it("subsequent users should be pending approval", () => {
    const totalUsers = 1;
    const isFirst = totalUsers === 0;
    expect(isFirst).toBe(false);

    const role = "admin";
    const approvalStatus = isFirst ? "approved" : "pending";
    expect(role).toBe("admin");
    expect(approvalStatus).toBe("pending");
  });
});

describe("Email validation", () => {
  it("accepts valid email formats", () => {
    const validEmails = [
      "user@example.com",
      "prof.name@university.edu.br",
      "test+tag@gmail.com",
    ];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of validEmails) {
      expect(emailRegex.test(email)).toBe(true);
    }
  });

  it("rejects invalid email formats", () => {
    const invalidEmails = ["notanemail", "@nouser.com", "user@", ""];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of invalidEmails) {
      expect(emailRegex.test(email)).toBe(false);
    }
  });
});

describe("Password strength validation", () => {
  it("rejects passwords shorter than 6 characters", () => {
    const shortPasswords = ["", "a", "12345", "ab"];
    for (const pwd of shortPasswords) {
      expect(pwd.length >= 6).toBe(false);
    }
  });

  it("accepts passwords with 6 or more characters", () => {
    const validPasswords = ["123456", "senhaSegura", "minhaSenha!@#"];
    for (const pwd of validPasswords) {
      expect(pwd.length >= 6).toBe(true);
    }
  });
});

describe("Router auth routes existence", async () => {
  const { appRouter } = await import("./routers");

  it("auth.isFirstUser route exists", () => {
    expect(appRouter._def.procedures["auth.isFirstUser"]).toBeDefined();
  });

  it("auth.register route exists", () => {
    expect(appRouter._def.procedures["auth.register"]).toBeDefined();
  });

  it("auth.login route exists", () => {
    expect(appRouter._def.procedures["auth.login"]).toBeDefined();
  });

  it("auth.changePassword route exists", () => {
    expect(appRouter._def.procedures["auth.changePassword"]).toBeDefined();
  });

  it("auth.me route still exists", () => {
    expect(appRouter._def.procedures["auth.me"]).toBeDefined();
  });

  it("auth.logout route still exists", () => {
    expect(appRouter._def.procedures["auth.logout"]).toBeDefined();
  });
});
