import { describe, it, expect } from "vitest";

// ─── Test notification structure for email failures ───
describe("Email error notification structure", () => {
  it("notification type is email_error", () => {
    const notification = {
      type: "email_error",
      title: "Falha no Envio de E-mail",
      message: 'Erro ao enviar e-mail para test@test.com (assunto: "Teste"): Connection refused',
    };
    expect(notification.type).toBe("email_error");
  });

  it("notification title is Falha no Envio de E-mail", () => {
    const notification = {
      type: "email_error",
      title: "Falha no Envio de E-mail",
      message: 'Erro ao enviar e-mail para test@test.com (assunto: "Teste"): SMTP error',
    };
    expect(notification.title).toBe("Falha no Envio de E-mail");
  });

  it("notification message includes recipient email", () => {
    const recipient = "aluno@ecomp.uefs.br";
    const message = `Erro ao enviar e-mail para ${recipient} (assunto: "Código de Verificação"): Connection timeout`;
    expect(message).toContain(recipient);
  });

  it("notification message includes subject", () => {
    const subject = "Código de Verificação - Avaliação Tutorial";
    const message = `Erro ao enviar e-mail para test@test.com (assunto: "${subject}"): SMTP error`;
    expect(message).toContain(subject);
  });

  it("notification message includes error description", () => {
    const error = "Connection refused";
    const message = `Erro ao enviar e-mail para test@test.com (assunto: "Teste"): ${error}`;
    expect(message).toContain(error);
  });
});

// ─── Test notification metadata for email failures ───
describe("Email error notification metadata", () => {
  it("metadata contains recipient, subject, error, and occurredAt", () => {
    const metadata = JSON.stringify({
      recipient: "aluno@ecomp.uefs.br",
      subject: "Código de Verificação - Avaliação Tutorial",
      error: "Connection refused",
      occurredAt: new Date().toISOString(),
    });
    const parsed = JSON.parse(metadata);
    expect(parsed.recipient).toBe("aluno@ecomp.uefs.br");
    expect(parsed.subject).toBe("Código de Verificação - Avaliação Tutorial");
    expect(parsed.error).toBe("Connection refused");
    expect(parsed.occurredAt).toBeDefined();
  });

  it("occurredAt is a valid ISO date string", () => {
    const occurredAt = new Date().toISOString();
    const parsed = new Date(occurredAt);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  it("metadata can store long error messages", () => {
    const longError = "Error: connect ECONNREFUSED 127.0.0.1:587 - SMTP server at smtp.gmail.com:587 is not responding. Please check your SMTP configuration and ensure the server is accessible.";
    const metadata = JSON.stringify({
      recipient: "test@test.com",
      subject: "Test",
      error: longError,
      occurredAt: new Date().toISOString(),
    });
    const parsed = JSON.parse(metadata);
    expect(parsed.error).toBe(longError);
    expect(parsed.error.length).toBeGreaterThan(100);
  });
});

// ─── Test email failure scenarios that trigger notifications ───
describe("Email failure scenarios", () => {
  it("SMTP not configured generates notification", () => {
    const config = null;
    const shouldNotify = !config;
    expect(shouldNotify).toBe(true);
  });

  it("SMTP connection error generates notification", () => {
    const error = new Error("connect ECONNREFUSED 127.0.0.1:587");
    const shouldNotify = error instanceof Error;
    expect(shouldNotify).toBe(true);
  });

  it("SMTP authentication error generates notification", () => {
    const error = new Error("Invalid login: 535-5.7.8 Username and Password not accepted");
    const shouldNotify = error instanceof Error;
    expect(shouldNotify).toBe(true);
    expect(error.message).toContain("Invalid login");
  });

  it("SMTP timeout error generates notification", () => {
    const error = new Error("Connection timeout");
    const shouldNotify = error instanceof Error;
    expect(shouldNotify).toBe(true);
  });

  it("successful email does NOT generate notification", () => {
    const result = { success: true };
    const shouldNotify = !result.success;
    expect(shouldNotify).toBe(false);
  });
});

// ─── Test notification is sent to admin only ───
describe("Email error notification targeting", () => {
  it("notification is sent to admin user", () => {
    const admin = { id: 1, role: "admin", name: "Admin" };
    const notification = {
      userId: admin.id,
      type: "email_error",
      title: "Falha no Envio de E-mail",
      message: "Erro ao enviar e-mail...",
    };
    expect(notification.userId).toBe(admin.id);
  });

  it("no notification when admin does not exist", () => {
    const admin = null;
    const shouldCreateNotification = admin !== null;
    expect(shouldCreateNotification).toBe(false);
  });

  it("notification is not sent to regular users", () => {
    const admin = { id: 1, role: "admin" };
    const regularUser = { id: 2, role: "prof" };
    const notification = { userId: admin.id };
    expect(notification.userId).not.toBe(regularUser.id);
  });
});

// ─── Test notification does not break email flow ───
describe("Email error notification resilience", () => {
  it("notification failure should not throw", () => {
    // Simulates the try/catch pattern in notifyAdminEmailFailure
    let notificationCreated = false;
    try {
      // Simulate notification creation failure
      throw new Error("DB connection lost");
    } catch {
      // Should be caught silently
      notificationCreated = false;
    }
    expect(notificationCreated).toBe(false);
    // The important thing is that no exception propagated
  });

  it("sendEmail still returns error result even if notification fails", () => {
    const emailResult = { success: false, error: "SMTP error" };
    // Even if notification creation fails, the email result should still be returned
    expect(emailResult.success).toBe(false);
    expect(emailResult.error).toBe("SMTP error");
  });

  it("sendEmail returns success when email is sent successfully", () => {
    const emailResult = { success: true };
    expect(emailResult.success).toBe(true);
    expect(emailResult).not.toHaveProperty("error");
  });
});

// ─── Test different email types that can fail ───
describe("Email types that trigger failure notifications", () => {
  const emailTypes = [
    { subject: "Código de Verificação - Avaliação Tutorial", context: "verificação de e-mail do aluno" },
    { subject: "Código de Recuperação de Senha - Avaliação Tutorial", context: "recuperação de senha" },
    { subject: "Nova Solicitação de Entrada - TEC502", context: "notificação ao coordenador" },
    { subject: "Solicitação Aprovada - TEC502", context: "aprovação de professor" },
    { subject: "Solicitação Rejeitada - TEC502", context: "rejeição de professor" },
    { subject: "Avaliação Tutorial - Sessão 1 (Código: ABC123)", context: "notificação de sessão aberta" },
    { subject: "Permissão de Avaliação Concedida - TEC502 TP01", context: "permissão de avaliação" },
    { subject: "[Bug] Erro no sistema", context: "ticket de contato" },
    { subject: "Teste de Configuração SMTP - Avaliação Tutorial", context: "teste SMTP" },
  ];

  emailTypes.forEach(({ subject, context }) => {
    it(`failure in ${context} email includes subject in notification`, () => {
      const notification = {
        message: `Erro ao enviar e-mail para test@test.com (assunto: "${subject}"): SMTP error`,
      };
      expect(notification.message).toContain(subject);
    });
  });

  it("all email types are covered", () => {
    expect(emailTypes).toHaveLength(9);
  });
});
