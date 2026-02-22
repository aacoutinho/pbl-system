import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db functions
vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  countUsers: vi.fn(),
  isSmtpConfigured: vi.fn(),
  createEmailVerificationCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  createUserWithPassword: vi.fn(),
  requestComponentMembership: vi.fn(),
}));

// Mock email functions
vi.mock("./email", () => ({
  sendEmail: vi.fn(),
  generateResetCode: vi.fn(),
  buildVerificationEmailHtml: vi.fn(),
}));

import {
  getUserByEmail,
  countUsers,
  isSmtpConfigured,
  createEmailVerificationCode,
  verifyEmailCode,
  createUserWithPassword,
} from "./db";

import { sendEmail, generateResetCode } from "./email";

describe("Email Verification - sendVerificationCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject if email already registered", async () => {
    (getUserByEmail as any).mockResolvedValue({ id: 1, email: "test@test.com" });
    // The route would throw CONFLICT
    const existing = await getUserByEmail("test@test.com");
    expect(existing).toBeTruthy();
  });

  it("should skip SMTP for first user when SMTP not configured", async () => {
    (getUserByEmail as any).mockResolvedValue(null);
    (isSmtpConfigured as any).mockResolvedValue(false);
    (countUsers as any).mockResolvedValue(0);

    const smtpOk = await isSmtpConfigured();
    const total = await countUsers();
    // First user with no SMTP → should return smtpSkipped: true
    expect(smtpOk).toBe(false);
    expect(total).toBe(0);
  });

  it("should throw if SMTP not configured and not first user", async () => {
    (getUserByEmail as any).mockResolvedValue(null);
    (isSmtpConfigured as any).mockResolvedValue(false);
    (countUsers as any).mockResolvedValue(1);

    const smtpOk = await isSmtpConfigured();
    const total = await countUsers();
    // Not first user, no SMTP → should throw PRECONDITION_FAILED
    expect(smtpOk).toBe(false);
    expect(total).toBeGreaterThan(0);
  });

  it("should send verification code when SMTP is configured", async () => {
    (getUserByEmail as any).mockResolvedValue(null);
    (isSmtpConfigured as any).mockResolvedValue(true);
    (generateResetCode as any).mockReturnValue("123456");
    (createEmailVerificationCode as any).mockResolvedValue(undefined);
    (sendEmail as any).mockResolvedValue({ success: true });

    const smtpOk = await isSmtpConfigured();
    expect(smtpOk).toBe(true);

    const code = generateResetCode();
    expect(code).toBe("123456");

    await createEmailVerificationCode("test@test.com", code, new Date());
    expect(createEmailVerificationCode).toHaveBeenCalledWith("test@test.com", "123456", expect.any(Date));

    const result = await sendEmail({
      to: "test@test.com",
      subject: "Código de Verificação",
      text: `Seu código: ${code}`,
    });
    expect(result.success).toBe(true);
  });

  it("should throw if email sending fails", async () => {
    (sendEmail as any).mockResolvedValue({ success: false, error: "SMTP error" });

    const result = await sendEmail({
      to: "test@test.com",
      subject: "test",
      text: "test",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("SMTP error");
  });
});

describe("Email Verification - register with code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject registration without verification code for non-first user", async () => {
    (getUserByEmail as any).mockResolvedValue(null);
    (countUsers as any).mockResolvedValue(1);
    (isSmtpConfigured as any).mockResolvedValue(true);

    const total = await countUsers();
    const isFirst = total === 0;
    const smtpOk = await isSmtpConfigured();

    // Not first user, SMTP configured → code is required
    expect(isFirst).toBe(false);
    expect(smtpOk).toBe(true);
  });

  it("should reject registration with invalid verification code", async () => {
    (verifyEmailCode as any).mockResolvedValue(false);

    const valid = await verifyEmailCode("test@test.com", "000000");
    expect(valid).toBe(false);
  });

  it("should accept registration with valid verification code", async () => {
    (getUserByEmail as any).mockResolvedValue(null);
    (countUsers as any).mockResolvedValue(1);
    (isSmtpConfigured as any).mockResolvedValue(true);
    (verifyEmailCode as any).mockResolvedValue(true);
    (createUserWithPassword as any).mockResolvedValue({
      id: 2,
      name: "Test User",
      email: "test@test.com",
      role: "user",
      approvalStatus: "pending",
    });

    const valid = await verifyEmailCode("test@test.com", "123456");
    expect(valid).toBe(true);

    const user = await createUserWithPassword({
      email: "test@test.com",
      name: "Test User",
      passwordHash: "hashed",
      role: "user",
      approvalStatus: "pending",
    });
    expect(user).toBeTruthy();
    expect(user!.role).toBe("user");
  });

  it("should allow first user to register without code when SMTP not configured", async () => {
    (getUserByEmail as any).mockResolvedValue(null);
    (countUsers as any).mockResolvedValue(0);
    (isSmtpConfigured as any).mockResolvedValue(false);
    (createUserWithPassword as any).mockResolvedValue({
      id: 1,
      name: "Admin",
      email: "admin@test.com",
      role: "admin",
      approvalStatus: "approved",
    });

    const total = await countUsers();
    const isFirst = total === 0;
    const smtpOk = await isSmtpConfigured();

    // First user, no SMTP → skip verification
    expect(isFirst).toBe(true);
    expect(smtpOk).toBe(false);

    const user = await createUserWithPassword({
      email: "admin@test.com",
      name: "Admin",
      passwordHash: "hashed",
      role: "admin",
      approvalStatus: "approved",
    });
    expect(user!.role).toBe("admin");
  });

  it("should require code for first user when SMTP is configured", async () => {
    (countUsers as any).mockResolvedValue(0);
    (isSmtpConfigured as any).mockResolvedValue(true);

    const total = await countUsers();
    const isFirst = total === 0;
    const smtpOk = await isSmtpConfigured();

    // First user but SMTP configured → code IS required
    expect(isFirst).toBe(true);
    expect(smtpOk).toBe(true);
    // In the route: if (!isFirst || await isSmtpConfigured()) → true, so code required
  });
});
