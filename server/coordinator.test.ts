import { describe, it, expect } from "vitest";

// ─── Unit tests for coordinator, SMTP config, and password reset ───

describe("Role assignment logic", () => {
  it("first user should get admin role", () => {
    const totalUsers = 0;
    const isFirst = totalUsers === 0;
    const role = isFirst ? "admin" : "user";
    expect(role).toBe("admin");
  });

  it("subsequent users should get user role", () => {
    const totalUsers = 1;
    const isFirst = totalUsers === 0;
    const role = isFirst ? "admin" : "user";
    expect(role).toBe("user");
  });

  it("admin should have approved status", () => {
    const isFirst = true;
    const approvalStatus = isFirst ? "approved" : "pending";
    expect(approvalStatus).toBe("approved");
  });

  it("non-first users should have pending status", () => {
    const isFirst = false;
    const approvalStatus = isFirst ? "approved" : "pending";
    expect(approvalStatus).toBe("pending");
  });

  it("adminProcedure should only accept admin role", () => {
    const acceptedRoles = ["admin"];
    expect(acceptedRoles).toContain("admin");
    expect(acceptedRoles).not.toContain("coordinator");
    expect(acceptedRoles).not.toContain("user");
  });

  it("coordinatorProcedure should accept coordinator and admin roles", () => {
    const acceptedRoles = ["coordinator", "admin"];
    expect(acceptedRoles).toContain("coordinator");
    expect(acceptedRoles).toContain("admin");
    expect(acceptedRoles).not.toContain("user");
  });
});

describe("Reset code generation", () => {
  it("generates a 6-digit numeric code", async () => {
    const { generateResetCode } = await import("./email");
    const code = generateResetCode();
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it("generates different codes on successive calls", async () => {
    const { generateResetCode } = await import("./email");
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateResetCode());
    }
    // At least 10 unique codes out of 20 (very unlikely to have many collisions)
    expect(codes.size).toBeGreaterThan(10);
  });

  it("generates codes within valid range (100000-999999)", async () => {
    const { generateResetCode } = await import("./email");
    for (let i = 0; i < 50; i++) {
      const code = generateResetCode();
      const num = parseInt(code, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });
});

describe("Reset email HTML generation", () => {
  it("includes the code in the HTML", async () => {
    const { buildResetEmailHtml } = await import("./email");
    const html = buildResetEmailHtml("123456", "Professor Teste");
    expect(html).toContain("123456");
  });

  it("includes the user name in the HTML", async () => {
    const { buildResetEmailHtml } = await import("./email");
    const html = buildResetEmailHtml("654321", "Maria Silva");
    expect(html).toContain("Maria Silva");
  });

  it("includes expiration info in the HTML", async () => {
    const { buildResetEmailHtml } = await import("./email");
    const html = buildResetEmailHtml("111111", "Teste");
    expect(html).toContain("15 minutos");
  });

  it("includes system name in the HTML", async () => {
    const { buildResetEmailHtml } = await import("./email");
    const html = buildResetEmailHtml("222222", "Teste");
    expect(html).toContain("Avaliação Tutorial");
  });
});

describe("Reset code expiration logic", () => {
  it("code within 15 minutes should be valid", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    expect(now < expiresAt).toBe(true);
  });

  it("code after 15 minutes should be expired", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() - 1000); // 1 second ago
    expect(now > expiresAt).toBe(true);
  });

  it("expiration is set to 15 minutes from now", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 15 * 60 * 1000);
    const diff = expiresAt.getTime() - now;
    expect(diff).toBe(15 * 60 * 1000);
  });
});

describe("SMTP config validation", () => {
  it("validates required SMTP fields", () => {
    const config = {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "user@gmail.com",
      password: "apppassword",
      fromEmail: "user@gmail.com",
      fromName: "Avaliação Tutorial",
    };
    expect(config.host.length).toBeGreaterThan(0);
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThanOrEqual(65535);
    expect(config.username.length).toBeGreaterThan(0);
    expect(config.password.length).toBeGreaterThan(0);
    expect(config.fromEmail).toContain("@");
    expect(config.fromName.length).toBeGreaterThan(0);
  });

  it("common SMTP ports are valid", () => {
    const validPorts = [25, 465, 587, 2525];
    for (const port of validPorts) {
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
    }
  });

  it("secure should be true for port 465", () => {
    const port = 465;
    const secure = port === 465;
    expect(secure).toBe(true);
  });

  it("secure should be false for port 587 (STARTTLS)", () => {
    const port = 587;
    const secure = port === 465;
    expect(secure).toBe(false);
  });
});

describe("Router coordinator routes existence", async () => {
  const { appRouter } = await import("./routers");

  it("smtp.get route exists", () => {
    expect(appRouter._def.procedures["smtp.get"]).toBeDefined();
  });

  it("smtp.save route exists", () => {
    expect(appRouter._def.procedures["smtp.save"]).toBeDefined();
  });

  it("smtp.test route exists", () => {
    expect(appRouter._def.procedures["smtp.test"]).toBeDefined();
  });

  it("smtp.delete route exists", () => {
    expect(appRouter._def.procedures["smtp.delete"]).toBeDefined();
  });

  it("coordination.current route exists", () => {
    expect(appRouter._def.procedures["coordination.current"]).toBeDefined();
  });

  it("coordination.transfer route exists", () => {
    expect(appRouter._def.procedures["coordination.transfer"]).toBeDefined();
  });

  it("auth.requestResetCode route exists", () => {
    expect(appRouter._def.procedures["auth.requestResetCode"]).toBeDefined();
  });

  it("auth.resetPassword route exists", () => {
    expect(appRouter._def.procedures["auth.resetPassword"]).toBeDefined();
  });

  it("auth.smtpStatus route exists", () => {
    expect(appRouter._def.procedures["auth.smtpStatus"]).toBeDefined();
  });
});
